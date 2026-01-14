import { isCapabilitySupported } from '../api/provider-definitions';
import { CustomPromptPostProcessing } from '../constants';
import { useApiStore } from '../stores/api.store';
import { useToolStore } from '../stores/tool.store';
import { type ApiProvider } from '../types/api';
import type { ApiChatToolCall, ApiToolDefinition } from '../types/generation';
import type { ToolDefinition, ToolInvocation } from '../types/tools';

export class ToolService {
  /**
   * Converts a single tool definition to the API format.
   */
  static toApiTool(tool: ToolDefinition): ApiToolDefinition {
    return {
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    };
  }

  /**
   * Converts registered enabled tools to the OpenAI API tool definition format.
   */
  static getTools(): ApiToolDefinition[] {
    const toolStore = useToolStore();
    const result: ApiToolDefinition[] = [];

    for (const tool of toolStore.toolList) {
      // Default to enabled if undefined
      if (tool.disabled !== true) {
        result.push(this.toApiTool(tool));
      }
    }

    return result;
  }

  /**
   * Invokes a single tool by name with provided arguments.
   * Checks both registered tools and optionally provided ad-hoc tools (if we passed them to a context, but here we just check store).
   * For ad-hoc tools execution, the caller usually handles it or registers them temporarily.
   * This service primarily handles global tools.
   */
  static async invokeTool(name: string, argsJson: string): Promise<string> {
    const toolStore = useToolStore();
    const tool = toolStore.getTool(name);

    if (!tool) {
      throw new Error(`Tool not found: ${name}`);
    }

    try {
      // Parse arguments if string, or keep if already object (depending on provider output quirks)
      // Usually LLM output is a JSON string.
      const args = argsJson ? JSON.parse(argsJson) : {};
      const result = await tool.action(args);

      if (typeof result === 'string') return result;
      return JSON.stringify(result);
    } catch (error) {
      console.error(`[ToolService] Error invoking tool ${name}:`, error);
      if (error instanceof Error) {
        return `Error: ${error.message}`;
      }
      return 'Unknown error occurred during tool execution.';
    }
  }

  /**
   * Formats the tool invocation for display (e.g. system message).
   */
  static async formatToolMessage(name: string, argsJson: string): Promise<string> {
    const toolStore = useToolStore();
    const tool = toolStore.getTool(name);

    if (!tool) return `Invoking tool: ${name}`;

    try {
      const args = argsJson ? JSON.parse(argsJson) : {};
      if (tool.formatMessage) {
        return await tool.formatMessage(args);
      }
      return `Invoking tool: ${tool.displayName || tool.name}`;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      return `Invoking tool: ${tool.displayName || tool.name}`;
    }
  }

  /**
   * Processes a list of raw tool calls from the API, invokes them, and returns the results.
   */
  static async processToolCalls(toolCalls: ApiChatToolCall[]): Promise<{
    invocations: ToolInvocation[];
    stealthCalls: string[];
    errors: Error[];
  }> {
    const invocations: ToolInvocation[] = [];
    const stealthCalls: string[] = [];
    const errors: Error[] = [];
    const toolStore = useToolStore();

    for (const call of toolCalls) {
      if (call.type !== 'function') continue;

      const { name, arguments: args } = call.function;
      const tool = toolStore.getTool(name);

      if (!tool) {
        errors.push(new Error(`Unknown tool: ${name}`));
        continue;
      }

      try {
        const result = await this.invokeTool(name, args);

        if (tool.stealth) {
          stealthCalls.push(name);
        } else {
          invocations.push({
            id: call.id,
            name: name,
            displayName: tool.displayName || name,
            parameters: args,
            result: result,
            // @ts-expect-error custom field potentially added by provider handlers
            signature: call.signature,
          });
        }
      } catch (err) {
        errors.push(err as Error);
      }
    }

    return { invocations, stealthCalls, errors };
  }

  /**
   * Checks if tool calling is supported for the current configuration.
   */
  static isToolCallingSupported(
    provider: ApiProvider,
    model: string,
    customPromptPostProcessing: CustomPromptPostProcessing,
  ): boolean {
    const apiStore = useApiStore();

    // 1. Check if globally enabled in settings (if we add a toggle later)
    // For now assume if tools are registered, we want them.

    // 2. Check Custom Prompt Post Processing compatibility
    const allowed = [
      CustomPromptPostProcessing.NONE,
      CustomPromptPostProcessing.MERGE_TOOLS,
      CustomPromptPostProcessing.SEMI_TOOLS,
      CustomPromptPostProcessing.STRICT_TOOLS,
    ];

    // If the current post-processing method is NOT in the allowed list,
    // it means it likely strips tools or format, so we disable tool calling.
    if (!allowed.includes(customPromptPostProcessing)) {
      return false;
    }

    // 3. Provider/Model Check using Capability Definitions
    // We pass the full model list from the store to allow metadata checks (e.g. OpenRouter/ElectronHub)
    return isCapabilitySupported('tools', provider, model, apiStore.modelList);
  }
}
