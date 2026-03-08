import type { ConnectionProfile } from '../../../types';
import type { ExtensionAPI } from '../../../types/ExtensionAPI';
import type { ApiChatMessage, GenerationResponse } from '../../../types/generation';
import type { MultiModelSettings, ParallelGenerationState } from './types';

interface ProfileResult {
  response: GenerationResponse;
  profileId: string;
}

interface ProfileError {
  error: unknown;
  profileId: string;
}

export class ParallelGenerationService {
  private api: ExtensionAPI<MultiModelSettings>;
  private state: ParallelGenerationState;

  constructor(api: ExtensionAPI<MultiModelSettings>) {
    this.api = api;
    this.state = {
      isGenerating: false,
      profiles: [],
      messageIndex: null,
      controller: null,
    };
  }

  get isGenerating(): boolean {
    return this.state.isGenerating;
  }

  async generateParallel(profiles: ConnectionProfile[], messages: ApiChatMessage[], id: string): Promise<void> {
    if (profiles.length === 0) {
      this.api.ui.showToast(this.api.i18n.t('extensionsBuiltin.multiModelParallel.toast.noProfiles'), 'warning');
      return;
    }

    const settings = this.api.settings.get();
    const maxSwipes = Math.min(profiles.length, settings.maxSwipes);

    // Set generating state
    this.state.isGenerating = true;
    this.state.profiles = profiles.map((p) => p.id);
    this.state.controller = new AbortController();
    this.api.chat.setGeneratingState(true);

    console.log(`[Multi-Model Parallel] Starting parallel generation with ${profiles.length} models`);

    try {
      // Build prompt once
      const itemizedPrompt = await this.api.chat.buildPrompt({
        generationId: id,
        chatHistory: messages,
      });

      // Calculate total tokens for the prompt
      const totalTokens = this.calculateTokenCount(itemizedPrompt.messages);
      console.log(`[Multi-Model Parallel] Total prompt tokens: ${totalTokens}`);

      // Create all requests with stream: false (non-streaming)
      const requestPromises = profiles.map((profile) =>
        this.generateForProfile(profile, itemizedPrompt.messages, this.state.controller!.signal)
          .then((response) => ({ response, profileId: profile.id }) as ProfileResult)
          .catch((error) => ({ error, profileId: profile.id }) as ProfileError),
      );

      // Wait for first successful response
      const firstResult = await this.waitForFirstSuccess(requestPromises);

      if (!firstResult) {
        throw new Error('All generation requests failed');
      }

      const firstProfile = profiles.find((p) => p.id === firstResult.profileId);
      console.log(
        `[Multi-Model Parallel] First response received from: ${firstProfile?.name || firstResult.profileId} (${firstResult.response.content?.length || 0} chars)`,
      );

      // Handle first response
      await this.handleFirstResponse(firstResult.response);

      // Wait for all remaining requests to complete
      const allResults = await Promise.all(requestPromises);

      // Process additional responses as swipes
      let swipeCount = 1; // First response is already handled
      for (const result of allResults) {
        if (swipeCount >= maxSwipes) {
          break;
        }

        if ('response' in result && result.profileId !== firstResult.profileId) {
          const profile = profiles.find((p) => p.id === result.profileId);
          console.log(
            `[Multi-Model Parallel] Additional response received from: ${profile?.name || result.profileId} (${result.response.content?.length || 0} chars)`,
          );
          await this.handleAdditionalResponse(result.response);
          swipeCount++;
        }
      }

      this.api.ui.showToast(
        this.api.i18n.t('extensionsBuiltin.multiModelParallel.toast.generationComplete'),
        'success',
      );
    } catch (error) {
      this.api.ui.showToast(
        this.api.i18n.t('extensionsBuiltin.multiModelParallel.toast.generationFailed', {
          error: error instanceof Error ? error.message : String(error),
        }),
        'error',
      );
    } finally {
      // Reset state
      this.state.isGenerating = false;
      this.state.profiles = [];
      this.state.messageIndex = null;
      this.state.controller = null;
      this.api.chat.setGeneratingState(false);
    }
  }

  private async waitForFirstSuccess(promises: Promise<ProfileResult | ProfileError>[]): Promise<ProfileResult | null> {
    // Create a wrapper that resolves when we get a successful result
    const successPromises = promises.map((p) => p.then((result) => ('response' in result ? result : null)));

    // Wait for first non-null result
    const remaining = [...successPromises];

    while (remaining.length > 0) {
      try {
        const result = await Promise.race(remaining);
        if (result) {
          return result;
        }
      } catch {
        // Ignore errors and continue waiting
      }

      // Remove completed promises by checking which are still pending
      // We can't directly check pending status, so we use a timeout approach
      const settled = await Promise.race([
        Promise.allSettled(remaining),
        new Promise<never>((resolve) => setTimeout(() => resolve([] as never), 10)),
      ]);

      if (Array.isArray(settled) && settled.length === remaining.length) {
        // All settled, no more pending
        break;
      }

      // If we got here, we timed out, meaning some are still pending
      // Continue the loop to race again
    }

    return null;
  }

  private async generateForProfile(
    profile: ConnectionProfile,
    messages: ApiChatMessage[],
    signal: AbortSignal,
  ): Promise<GenerationResponse> {
    const tokenCount = this.calculateTokenCount(messages);
    console.log(`[Multi-Model Parallel] Sending request to: ${profile.name || profile.id} (${tokenCount} tokens)`);

    const response = await this.api.llm.generate(messages, {
      connectionProfile: profile.id,
      signal,
    });

    // Handle both streaming and non-streaming responses
    if (response && typeof response === 'object' && 'content' in response) {
      return response as GenerationResponse;
    }

    // Handle streaming response (shouldn't happen with stream: false, but just in case)
    let content = '';
    if (response && typeof response === 'object' && Symbol.asyncIterator in response) {
      for await (const chunk of response as AsyncIterable<{ delta?: string }>) {
        if (chunk.delta) {
          content += chunk.delta;
        }
      }
      return { content } as GenerationResponse;
    }

    return { content: '' } as GenerationResponse;
  }

  private calculateTokenCount(messages: ApiChatMessage[]): number {
    // Simple token estimation: ~4 characters per token
    // This is a rough estimate - for accurate counting, you'd need to use the tokenizer API
    const totalChars = messages.reduce((sum, msg) => sum + (msg.content?.length || 0), 0);
    return Math.ceil(totalChars / 4);
  }

  private async handleFirstResponse(response: GenerationResponse): Promise<void> {
    const content = response.content || '';
    const history = this.api.chat.getHistory();
    const lastMessage = history[history.length - 1];

    if (!lastMessage || lastMessage.is_user) {
      // Create new message
      await this.api.chat.createMessage({
        role: 'assistant',
        content,
        name: 'Assistant',
      });
      this.state.messageIndex = history.length;
    } else if (lastMessage && !lastMessage.is_user) {
      // Update existing message (for REGENERATE mode)
      await this.api.chat.updateMessageObject(history.length - 1, {
        mes: content,
        swipes: [content],
        swipe_id: 0,
        swipe_info: [{ send_date: new Date().toISOString(), extra: {} }],
      });
      this.state.messageIndex = history.length - 1;
    }
  }

  private async handleAdditionalResponse(response: GenerationResponse): Promise<void> {
    const content = response.content || '';
    const history = this.api.chat.getHistory();
    const messageIndex = this.state.messageIndex;

    if (messageIndex === null || messageIndex >= history.length) {
      return;
    }

    const message = history[messageIndex];
    if (!message) {
      return;
    }

    // Add as swipe
    const swipes = message.swipes || [message.mes];
    const swipeInfo = message.swipe_info || [{ send_date: message.send_date || new Date().toISOString(), extra: {} }];

    swipes.push(content);
    swipeInfo.push({ send_date: new Date().toISOString(), extra: {} });

    await this.api.chat.updateMessageObject(messageIndex, {
      swipes,
      swipe_info: swipeInfo,
    });
  }

  abort(): void {
    if (this.state.controller) {
      this.state.controller.abort();
    }
  }
}
