<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { Button, FormItem, Input, Select, Textarea, Toggle } from '../../../../components/UI';
import { useStrictI18n } from '../../../../composables/useStrictI18n';
import type { ApiChatMessage, ChatMessage, ExtensionAPI } from '../../../../types';
import { POPUP_RESULT, POPUP_TYPE } from '../../../../types';
import type { TextareaToolDefinition } from '../../../../types/ExtensionAPI';
import type { WorldInfoEntry } from '../../../../types/world-info';
import {
  DEFAULT_PROMPT,
  EXTENSION_KEY,
  type ChatMemoryMetadata,
  type ChatMemoryRecord,
  type ExtensionSettings,
  type MemoryMessageExtra,
} from '../types';
import TimelineVisualizer, { type TimelineSegment } from './TimelineVisualizer.vue';

const props = defineProps<{
  api: ExtensionAPI<ExtensionSettings>;
  connectionProfile?: string;
}>();

const { t } = useStrictI18n();

// State
const startIndex = ref<number>(0);
const endIndex = ref<number>(0);
const lorebookPrompt = ref<string>(DEFAULT_PROMPT);
const summaryResult = ref<string>('');
const isGenerating = ref(false);
const isSaving = ref(false);
const autoHideMessages = ref(true);
const selectedLorebook = ref<string>('');
const availableLorebooks = ref<{ label: string; value: string }[]>([]);
const abortController = ref<AbortController | null>(null);

// Computed
const chatHistory = computed(() => props.api.chat.getHistory());
const maxIndex = computed(() => {
  const history = chatHistory.value;
  return history.length > 0 ? history.length - 1 : 0;
});
const hasMessages = computed(() => chatHistory.value.length > 0);

const startIndexError = computed(() => {
  if (!hasMessages.value) return 'No messages available';
  if (startIndex.value === undefined || startIndex.value === null) return 'Value is required';
  if (startIndex.value < 0) return 'Cannot be negative';
  if (startIndex.value > maxIndex.value) return 'Index out of bounds';
  if (startIndex.value > endIndex.value) return 'Start cannot be greater than End';
  return undefined;
});

const endIndexError = computed(() => {
  if (!hasMessages.value) return 'No messages available';
  if (endIndex.value === undefined || endIndex.value === null) return 'Value is required';
  if (endIndex.value < 0) return 'Cannot be negative';
  if (endIndex.value > maxIndex.value) return 'Cannot exceed total messages';
  if (endIndex.value < startIndex.value) return 'End cannot be less than Start';
  return undefined;
});

const isValidRange = computed(() => hasMessages.value && !startIndexError.value && !endIndexError.value);

const existingMemories = computed(() => {
  const currentMetadata = props.api.chat.metadata.get();
  if (!currentMetadata) return [];
  const memoryExtra = (currentMetadata.extra?.[EXTENSION_KEY] as ChatMemoryMetadata) || { memories: [] };
  return memoryExtra.memories || [];
});

const hasMemories = computed(() => existingMemories.value.length > 0);

const overlapWarning = computed(() => {
  if (!isValidRange.value) return null;
  const start = startIndex.value;
  const end = endIndex.value;
  for (const memory of existingMemories.value) {
    const [mStart, mEnd] = memory.range;
    if (Math.max(start, mStart) <= Math.min(end, mEnd)) {
      return t('extensionsBuiltin.chatMemory.overlapWarning');
    }
  }
  return null;
});

const timelineSegments = computed<TimelineSegment[]>(() => {
  const segments: TimelineSegment[] = [];
  existingMemories.value.forEach((mem) => {
    const [s, e] = mem.range;
    segments.push({
      start: s,
      end: e,
      type: 'memory',
      title: `Memory: ${s} - ${e}`,
    });
  });

  if (isValidRange.value) {
    segments.push({
      start: startIndex.value,
      end: endIndex.value,
      type: overlapWarning.value ? 'overlap' : 'selection',
      title: `Current Selection: ${startIndex.value} - ${endIndex.value}`,
    });
  }
  return segments;
});

const promptTools = computed<TextareaToolDefinition[]>(() => [
  {
    id: 'reset',
    icon: 'fa-rotate-left',
    title: t('common.reset'),
    onClick: ({ setValue }) => {
      setValue(DEFAULT_PROMPT);
    },
  },
]);

// Methods
function refreshLorebooks() {
  const books = props.api.worldInfo.getAllBookNames();
  availableLorebooks.value = books.map((b) => ({
    label: b.name,
    value: b.file_id,
  }));

  if (!selectedLorebook.value) {
    const activeBooks = props.api.worldInfo.getActiveBookNames();
    if (activeBooks.length > 0) {
      selectedLorebook.value = activeBooks[0];
    } else if (availableLorebooks.value.length > 0) {
      selectedLorebook.value = availableLorebooks.value[0].value;
    }
  }
}

function loadSettings() {
  const settings = props.api.settings.get();
  if (settings) {
    if (settings.prompt) lorebookPrompt.value = settings.prompt;
    if (settings.autoHideMessages !== undefined) autoHideMessages.value = settings.autoHideMessages;
    if (settings.lastLorebook && availableLorebooks.value.some((b) => b.value === settings.lastLorebook)) {
      selectedLorebook.value = settings.lastLorebook;
    }
  }
}

function saveSettings() {
  props.api.settings.set('prompt', lorebookPrompt.value);
  props.api.settings.set('autoHideMessages', autoHideMessages.value);
  props.api.settings.set('lastLorebook', selectedLorebook.value);
  props.api.settings.save();
}

function cancelGeneration() {
  if (abortController.value) {
    abortController.value.abort();
    abortController.value = null;
    isGenerating.value = false;
    props.api.ui.showToast(t('common.cancelled'), 'info');
  }
}

async function handleLorebookSummarize() {
  if (!props.connectionProfile) {
    props.api.ui.showToast(t('extensionsBuiltin.chatMemory.noProfile'), 'error');
    return;
  }
  if (!isValidRange.value) return;

  isGenerating.value = true;
  summaryResult.value = '';
  abortController.value = new AbortController();

  try {
    const messagesSlice = chatHistory.value.slice(startIndex.value, endIndex.value + 1);
    const textToSummarize = messagesSlice.map((m) => `${m.name}: ${m.mes}`).join('\n\n');

    const compiledPrompt = props.api.macro.process(lorebookPrompt.value, undefined, {
      text: textToSummarize,
    });
    const messages: Array<ApiChatMessage> = [{ role: 'system', content: compiledPrompt, name: 'System' }];

    const response = await props.api.llm.generate(messages, {
      connectionProfileName: props.connectionProfile,
      signal: abortController.value.signal,
    });

    let fullContent = '';
    if (typeof response === 'function') {
      const generator = response();
      for await (const chunk of generator) {
        if (!isGenerating.value) break;
        fullContent += chunk.delta;
        summaryResult.value = fullContent;
      }
    } else {
      fullContent = response.content;
    }

    if (isGenerating.value) {
      const codeBlockRegex = /```(?:[\w]*\n)?([\s\S]*?)```/i;
      const match = fullContent.match(codeBlockRegex);
      summaryResult.value = match && match[1] ? match[1].trim() : fullContent.trim();
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    if (error.name !== 'AbortError') {
      console.error('Summarization failed', error);
      props.api.ui.showToast('Summarization failed', 'error');
    }
  } finally {
    isGenerating.value = false;
    abortController.value = null;
  }
}

async function createEntry() {
  if (isSaving.value) return;
  if (!selectedLorebook.value) {
    props.api.ui.showToast('Please select a Lorebook', 'error');
    return;
  }
  if (!summaryResult.value.trim()) {
    props.api.ui.showToast('Summary is empty', 'error');
    return;
  }

  isSaving.value = true;

  try {
    const book = await props.api.worldInfo.getBook(selectedLorebook.value);
    if (!book) {
      props.api.ui.showToast('Selected Lorebook not found', 'error');
      return;
    }

    const newUid = props.api.worldInfo.getNewUid(book);
    const newEntry: WorldInfoEntry = {
      ...props.api.worldInfo.createDefaultEntry(newUid),
      comment: `Memory: Msg ${startIndex.value}-${endIndex.value}`,
      content: summaryResult.value,
      constant: true,
      order: endIndex.value,
    };

    await props.api.worldInfo.createEntry(selectedLorebook.value, newEntry);

    const currentMetadata = props.api.chat.metadata.get();
    if (currentMetadata) {
      const memoryExtra = (currentMetadata.extra?.[EXTENSION_KEY] as ChatMemoryMetadata) || { memories: [] };
      const memoryRecord: ChatMemoryRecord = {
        bookName: selectedLorebook.value,
        entryUid: newEntry.uid,
        range: [startIndex.value, endIndex.value],
        timestamp: Date.now(),
      };
      const updatedExtra = {
        ...currentMetadata.extra,
        [EXTENSION_KEY]: { ...memoryExtra, memories: [...memoryExtra.memories, memoryRecord] },
      };
      props.api.chat.metadata.update({ extra: updatedExtra });
    }

    for (let i = startIndex.value; i <= endIndex.value; i++) {
      const msg = chatHistory.value[i];
      const extraUpdate: MemoryMessageExtra = {
        summarized: true,
        original_is_system: msg.is_system,
        summary: (msg.extra?.[EXTENSION_KEY] as MemoryMessageExtra)?.summary,
      };
      const updates: Partial<ChatMessage> = {
        extra: { ...msg.extra, [EXTENSION_KEY]: extraUpdate },
      };
      if (autoHideMessages.value) {
        updates.is_system = true;
      }
      await props.api.chat.updateMessageObject(i, updates);
    }
    props.api.ui.showToast('Memory created', 'success');
  } catch (error) {
    console.error('Failed to create memory entry', error);
    props.api.ui.showToast('Failed to create memory entry', 'error');
  } finally {
    isSaving.value = false;
  }
}

async function handleLorebookReset() {
  const { result } = await props.api.ui.showPopup({
    title: 'Reset Memory',
    content:
      'This will remove all auto-generated memory entries for this chat and unhide the original messages. Are you sure?',
    type: POPUP_TYPE.CONFIRM,
    okButton: 'common.confirm',
    cancelButton: 'common.cancel',
  });

  if (result !== POPUP_RESULT.AFFIRMATIVE) return;

  const currentMetadata = props.api.chat.metadata.get();
  if (!currentMetadata) {
    props.api.ui.showToast('No chat metadata found', 'error');
    return;
  }

  let restoredCount = 0;
  let entriesRemoved = 0;

  try {
    const memoryExtra = currentMetadata.extra?.[EXTENSION_KEY] as ChatMemoryMetadata | undefined;
    if (memoryExtra && Array.isArray(memoryExtra.memories)) {
      for (const record of memoryExtra.memories) {
        try {
          await props.api.worldInfo.deleteEntry(record.bookName, record.entryUid);
          entriesRemoved++;
        } catch (err) {
          console.warn('Failed to cleanup memory entry', record, err);
        }
      }
      const updatedExtra = { ...currentMetadata.extra };
      delete updatedExtra[EXTENSION_KEY];
      props.api.chat.metadata.update({ extra: updatedExtra });
    }

    const history = chatHistory.value;
    for (let i = 0; i < history.length; i++) {
      const msg = history[i];
      const memExtra = msg.extra?.[EXTENSION_KEY] as MemoryMessageExtra | undefined;
      if (memExtra && memExtra.summarized) {
        await props.api.chat.updateMessageObject(i, {
          is_system: memExtra.original_is_system ?? false,
          extra: {
            ...msg.extra,
            [EXTENSION_KEY]: { ...memExtra, summarized: false },
          },
        });
        restoredCount++;
      }
    }
    props.api.ui.showToast(`Restored ${restoredCount} messages, deleted ${entriesRemoved} entries.`, 'success');
  } catch (error) {
    console.error('Reset failed', error);
    props.api.ui.showToast('Reset failed', 'error');
  }
}

onMounted(() => {
  endIndex.value = maxIndex.value;
  const memories = existingMemories.value;
  let suggestedStart = 0;
  if (memories.length > 0) {
    const lastMemoryEnd = Math.max(...memories.map((m) => m.range[1]));
    suggestedStart = Math.min(lastMemoryEnd + 1, endIndex.value);
  } else {
    suggestedStart = Math.max(0, endIndex.value - 20);
  }
  startIndex.value = suggestedStart;

  refreshLorebooks();
  loadSettings();
});

onUnmounted(() => {
  if (abortController.value) {
    abortController.value.abort();
  }
});

watch(
  [lorebookPrompt, autoHideMessages, selectedLorebook],
  () => {
    saveSettings();
  },
  { deep: true },
);
</script>

<template>
  <div class="lorebook-tab">
    <div class="section">
      <div class="section-title">1. {{ t('common.select') }} Range</div>
      <TimelineVisualizer :total-items="maxIndex + 1" :segments="timelineSegments" />
      <div class="row">
        <FormItem label="Start Index" style="flex: 1" :error="startIndexError">
          <Input v-model.number="startIndex" type="number" :min="0" :max="endIndex" />
        </FormItem>
        <FormItem label="End Index" style="flex: 1" :error="endIndexError">
          <Input v-model.number="endIndex" type="number" :min="startIndex" :max="maxIndex" />
        </FormItem>
      </div>
      <div v-if="overlapWarning" class="warning-banner">
        <i class="fa-solid fa-triangle-exclamation"></i>
        <span>{{ overlapWarning }}</span>
      </div>
    </div>

    <div class="section">
      <div class="section-title">2. Summarize</div>
      <FormItem label="Lorebook Summarization Prompt">
        <Textarea
          v-model="lorebookPrompt"
          :rows="4"
          allow-maximize
          :tools="promptTools"
          identifier="extension.chat-memory.prompt"
        />
      </FormItem>
      <div class="actions">
        <Button v-if="isGenerating" variant="danger" icon="fa-stop" @click="cancelGeneration">
          {{ t('common.cancel') }}
        </Button>
        <Button
          v-else
          :loading="isGenerating"
          :disabled="!isValidRange || !connectionProfile"
          icon="fa-wand-magic-sparkles"
          @click="handleLorebookSummarize"
        >
          Generate Summary
        </Button>
      </div>
      <FormItem label="Result">
        <Textarea
          v-model="summaryResult"
          :rows="6"
          placeholder="Generated summary will appear here..."
          allow-maximize
        />
      </FormItem>
    </div>

    <div class="section highlight">
      <div class="section-title">3. Create Memory</div>
      <div class="row">
        <FormItem label="Target Lorebook" style="flex: 1">
          <Select v-model="selectedLorebook" :options="availableLorebooks" placeholder="Select a Lorebook" />
        </FormItem>
      </div>
      <FormItem label="Auto-hide messages">
        <Toggle v-model="autoHideMessages" label="Auto-hide messages" />
      </FormItem>
      <div class="actions">
        <Button
          variant="confirm"
          icon="fa-save"
          :loading="isSaving"
          :disabled="!summaryResult || !selectedLorebook"
          @click="createEntry"
        >
          Create Constant Entry & Hide Messages
        </Button>
      </div>
    </div>

    <div class="section danger-zone">
      <div class="section-title">Manage</div>
      <div class="actions">
        <Button
          variant="danger"
          icon="fa-rotate-left"
          :disabled="!hasMemories"
          :title="!hasMemories ? 'No memories to reset for this chat' : ''"
          @click="handleLorebookReset"
        >
          Reset Memories for Current Chat
        </Button>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.lorebook-tab {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.section {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-bottom: 15px;
  border-bottom: 1px solid var(--theme-border-color);

  &:last-child {
    border-bottom: none;
  }

  &.highlight {
    background-color: var(--black-30a);
    padding: 15px;
    border-radius: var(--base-border-radius);
    border: 1px solid var(--theme-underline-color);
  }

  &.danger-zone {
    margin-top: 10px;
    border: 1px solid var(--color-accent-red);
    padding: 15px;
    border-radius: var(--base-border-radius);

    .section-title {
      color: var(--color-accent-red);
    }
  }
}

.section-title {
  font-weight: bold;
  font-size: 1.1em;
  color: var(--theme-text-color);
  margin-bottom: 5px;
}

.row {
  display: flex;
  gap: 15px;
  width: 100%;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin: 5px 0;
}

.warning-banner {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  background-color: var(--black-30a);
  border-left: 3px solid var(--color-warning);
  border-radius: var(--base-border-radius);
  color: var(--color-warning-amber);

  i {
    font-size: 1.2em;
  }
}
</style>
