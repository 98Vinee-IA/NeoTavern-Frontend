<script setup lang="ts">
import { computed, isProxy, isReactive, isRef, markRaw, onMounted, ref, toRaw, watch } from 'vue';
import { ConnectionProfileSelector } from '../../../components/common';
import { FormItem, Select, Tabs } from '../../../components/UI';
import type { Character, ExtensionAPI, Persona, WorldInfoBook, WorldInfoHeader } from '../../../types';
import ContextPromptSection from './components/ContextPromptSection.vue';
import OneShotTab from './components/OneShotTab.vue';
import RewriteView from './components/RewriteView.vue';
import SessionTab from './components/SessionTab.vue';
import { RewriteService } from './RewriteService';
import {
  DEFAULT_TEMPLATES,
  type RewriteLLMResponse,
  type RewriteSession,
  type RewriteSettings,
  type RewriteTemplateOverride,
  type StructuredResponseFormat,
} from './types';

const props = defineProps<{
  api: ExtensionAPI<RewriteSettings>;
  originalText: string;
  identifier: string;
  referenceMessageIndex?: number;
  onApply: (text: string) => void;
  onCancel: () => void;
  closePopup?: () => void;
}>();

const t = props.api.i18n.t;
const service = new RewriteService(props.api);

// TODO: i18n

// Settings State
const settings = ref<RewriteSettings>(
  props.api.settings.get() || {
    templates: [...DEFAULT_TEMPLATES],
    lastUsedTemplates: {},
    templateOverrides: {},
  },
);

// UI State
const activeTab = ref<string>('one-shot');
const selectedTemplateId = ref<string>('');
const selectedProfile = ref<string>('');
const promptOverride = ref<string>('');
const contextMessageCount = ref<number>(0);
const escapeMacros = ref<boolean>(true);
const argOverrides = ref<Record<string, boolean | number | string>>({});
const structuredResponseFormat = ref<StructuredResponseFormat>('native');

const selectedContextLorebooks = ref<string[]>([]);
const selectedContextEntries = ref<Record<string, number[]>>({});
const selectedContextCharacters = ref<string[]>([]);

const isCharacterContextOpen = ref(false);
const isWorldInfoContextOpen = ref(false);

// Data Cache
const allBookHeaders = ref<WorldInfoHeader[]>([]);
const bookCache = ref<Record<string, WorldInfoBook>>({});
const allCharacters = ref<Character[]>([]);

// Generation State (One-Shot)
const oneShotGeneratedText = ref<string>('');
const isGenerating = ref<boolean>(false);
const abortController = ref<AbortController | null>(null);

// Session State
const sessions = ref<RewriteSession[]>([]);
const activeSession = ref<RewriteSession | null>(null);

// Constants
const IS_CHARACTER_FIELD = computed(() => props.identifier.startsWith('character.'));
const IS_WORLD_INFO_FIELD = computed(() => props.identifier.startsWith('world_info.'));
const IGNORE_INPUT = computed(() => currentTemplate.value?.ignoreInput === true);

// Derived UI State for World Info
const selectedEntryContext = ref<{ bookName: string; entry: { uid: number; comment: string } } | null>(null);

onMounted(async () => {
  if (!settings.value.lastUsedTemplates) settings.value.lastUsedTemplates = {};
  if (!settings.value.templateOverrides) settings.value.templateOverrides = {};

  // Auto-select template
  const lastUsedTpl = settings.value.lastUsedTemplates[props.identifier];
  if (lastUsedTpl && settings.value.templates.find((t) => t.id === lastUsedTpl)) {
    selectedTemplateId.value = lastUsedTpl;
  } else {
    // Smart defaults
    if (IS_WORLD_INFO_FIELD.value) {
      const wiTpl = settings.value.templates.find((t) => t.id === 'world-info-refiner');
      if (wiTpl) selectedTemplateId.value = wiTpl.id;
    } else if (IS_CHARACTER_FIELD.value) {
      const charTpl = settings.value.templates.find((t) => t.id === 'character-polisher');
      if (charTpl) selectedTemplateId.value = charTpl.id;
    } else {
      if (settings.value.templates.length > 0) {
        selectedTemplateId.value = settings.value.templates[0].id;
      }
    }
  }

  loadTemplateOverrides();

  // Load world info data
  allBookHeaders.value = props.api.worldInfo.getAllBookNames();
  allCharacters.value = props.api.character.getAll();

  // Get current context if available
  const currentCtx = props.api.worldInfo.getSelectedEntry();
  if (currentCtx) {
    selectedEntryContext.value = {
      bookName: currentCtx.bookName,
      entry: {
        uid: currentCtx.entry.uid,
        comment: currentCtx.entry.comment,
      },
    };
  }

  // Ensure selected books are loaded
  for (const book of selectedContextLorebooks.value) {
    await ensureBookLoaded(book);
  }

  // Load Sessions
  await refreshSessions();
});

watch(selectedContextLorebooks, async (newBooks) => {
  for (const book of newBooks) {
    await ensureBookLoaded(book);
  }
  for (const key of Object.keys(selectedContextEntries.value)) {
    if (!newBooks.includes(key)) {
      delete selectedContextEntries.value[key];
    }
  }
});

watch(
  [
    selectedProfile,
    promptOverride,
    contextMessageCount,
    escapeMacros,
    structuredResponseFormat,
    isCharacterContextOpen,
    isWorldInfoContextOpen,
  ],
  () => {
    saveState();
  },
);

watch(
  [selectedContextLorebooks, selectedContextEntries, selectedContextCharacters, argOverrides],
  () => {
    saveState();
  },
  { deep: true },
);

async function ensureBookLoaded(bookName: string) {
  if (!bookCache.value[bookName]) {
    try {
      const book = await props.api.worldInfo.getBook(bookName);
      if (book) {
        bookCache.value[bookName] = book;
      }
    } catch (error) {
      console.error(`Failed to load book ${bookName}`, error);
    }
  }
}

const templateOptions = computed(() => {
  return settings.value.templates.map((t) => ({ label: t.name, value: t.id }));
});

const currentTemplate = computed(() => settings.value.templates.find((t) => t.id === selectedTemplateId.value));

const canResetPrompt = computed(() => {
  if (!currentTemplate.value) return false;
  return promptOverride.value !== currentTemplate.value.prompt;
});

const availableLorebooks = computed(() => {
  return allBookHeaders.value.map((b) => ({ label: b.name, value: b.name }));
});

const availableCharacters = computed(() => {
  let excludeAvatar = '';
  if (IS_CHARACTER_FIELD.value) {
    const editing = props.api.character.getEditing();
    if (editing) excludeAvatar = editing.avatar;
  }
  return allCharacters.value.filter((c) => c.avatar !== excludeAvatar).map((c) => ({ label: c.name, value: c.avatar }));
});

function loadTemplateOverrides() {
  const tplId = selectedTemplateId.value;
  if (!tplId) return;

  const overrides = settings.value.templateOverrides[tplId] || {};
  const tpl = settings.value.templates.find((t) => t.id === tplId);

  selectedProfile.value = overrides.lastUsedProfile || settings.value.defaultConnectionProfile || '';
  promptOverride.value = overrides.prompt ?? tpl?.prompt ?? '';
  contextMessageCount.value = overrides.lastUsedXMessages ?? 0;
  escapeMacros.value = overrides.escapeInputMacros ?? true;
  selectedContextLorebooks.value = overrides.selectedContextLorebooks || [];
  selectedContextEntries.value = overrides.selectedContextEntries ? { ...overrides.selectedContextEntries } : {};
  selectedContextCharacters.value = overrides.selectedContextCharacters || [];
  structuredResponseFormat.value = overrides.structuredResponseFormat || 'native';
  isCharacterContextOpen.value = !(overrides.isCharacterContextCollapsed ?? true);
  isWorldInfoContextOpen.value = !(overrides.isWorldInfoContextCollapsed ?? true);

  const args: Record<string, boolean | number | string> = {};
  if (tpl?.args) {
    tpl.args.forEach((arg) => {
      args[arg.key] = overrides.args?.[arg.key] ?? arg.defaultValue;
    });
  }
  argOverrides.value = args;
}

function resetPrompt() {
  if (currentTemplate.value) {
    promptOverride.value = currentTemplate.value.prompt;
  }
}

function saveState() {
  const tplId = selectedTemplateId.value;
  if (!tplId) return;

  settings.value.lastUsedTemplates[props.identifier] = tplId;

  const overrides: RewriteTemplateOverride = {
    lastUsedProfile: selectedProfile.value,
    prompt: promptOverride.value,
    lastUsedXMessages: Number(contextMessageCount.value),
    escapeInputMacros: escapeMacros.value,
    args: argOverrides.value,
    selectedContextLorebooks: selectedContextLorebooks.value,
    selectedContextEntries: { ...selectedContextEntries.value },
    selectedContextCharacters: selectedContextCharacters.value,
    structuredResponseFormat: structuredResponseFormat.value,
    isCharacterContextCollapsed: !isCharacterContextOpen.value,
    isWorldInfoContextCollapsed: !isWorldInfoContextOpen.value,
  };

  settings.value.templateOverrides[tplId] = overrides;

  props.api.settings.set(undefined, settings.value);
  props.api.settings.save();
}

watch(selectedTemplateId, () => {
  loadTemplateOverrides();
});

// --- One-Shot Generation ---

function getContextData() {
  let activeCharacter: Character | undefined;
  const persona: Persona | undefined = props.api.persona.getActive() || undefined;

  if (IS_CHARACTER_FIELD.value) {
    activeCharacter = props.api.character.getEditing() || undefined;
  } else {
    const actives = props.api.character.getActives();
    if (actives.length > 0) activeCharacter = actives[0];
  }
  return { activeCharacter, persona };
}

function getContextMessagesString(): string {
  if (contextMessageCount.value <= 0) return '';
  const history = props.api.chat.getHistory();
  if (history.length === 0) return '';
  const endIndex = props.referenceMessageIndex !== undefined ? props.referenceMessageIndex : history.length;
  const startIndex = Math.max(0, endIndex - contextMessageCount.value);
  const slice = history.slice(startIndex, endIndex);
  return slice.map((m) => `${m.name}: ${m.mes}`).join('\n');
}

function getAdditionalCharactersContext(): string {
  if (selectedContextCharacters.value.length === 0) return '';
  const chars = selectedContextCharacters.value
    .map((avatar) => props.api.character.get(avatar))
    .filter((c) => c !== null) as Character[];
  return chars
    .map((c) => {
      let text = `Name: ${c.name}`;
      if (c.description) text += `\nDescription: ${c.description}`;
      if (c.personality) text += `\nPersonality: ${c.personality}`;
      if (c.scenario) text += `\nScenario: ${c.scenario}`;
      if (c.mes_example) text += `\nExample Messages: ${c.mes_example}`;
      return text;
    })
    .join('\n\n');
}

async function getWorldInfoContext() {
  const macros: Record<string, unknown> = {};
  const currentFilename = props.api.worldInfo.getSelectedBookName();
  let currentBookUid: number | null = null;
  let currentBookName: string | null = null;

  if (currentFilename) {
    macros.selectedBook = { name: currentFilename };
    currentBookName = currentFilename;
  }

  const currentEntryCtx = props.api.worldInfo.getSelectedEntry();
  if (currentEntryCtx) {
    macros.selectedEntry = {
      uid: currentEntryCtx.entry.uid,
      key: currentEntryCtx.entry.key.join(', '),
      comment: currentEntryCtx.entry.comment,
      content: currentEntryCtx.entry.content,
    };
    currentBookUid = currentEntryCtx.entry.uid;
    currentBookName = currentEntryCtx.bookName;
  }

  if (selectedContextLorebooks.value.length > 0) {
    const otherBooksContent: string[] = [];
    for (const bookName of selectedContextLorebooks.value) {
      await ensureBookLoaded(bookName);
      const book = bookCache.value[bookName];
      if (book) {
        const entryIds = selectedContextEntries.value[bookName] || [];
        let entriesToInclude = book.entries;
        if (entryIds.length > 0) {
          entriesToInclude = book.entries.filter((e) => entryIds.includes(e.uid));
        }
        if (currentBookName === bookName && currentBookUid !== null) {
          entriesToInclude = entriesToInclude.filter((e) => e.uid !== currentBookUid);
        }
        if (entriesToInclude.length > 0) {
          const entriesSummary = entriesToInclude
            .map((e) => `- [${e.uid}] Keys: ${e.key.join(', ')} | Comment: ${e.comment}\n  Content: ${e.content}`)
            .join('\n');
          otherBooksContent.push(`Book: ${book.name}\n${entriesSummary}`);
        }
      }
    }
    macros.otherWorldInfo = otherBooksContent.join('\n\n');
  }
  return macros;
}

function handleAbort() {
  if (abortController.value) {
    abortController.value.abort();
    abortController.value = null;
  }
}

async function handleGenerateOneShot() {
  if (!selectedProfile.value) {
    props.api.ui.showToast(t('extensionsBuiltin.rewrite.errors.selectProfile'), 'error');
    return;
  }
  saveState();
  isGenerating.value = true;
  abortController.value = new AbortController();
  oneShotGeneratedText.value = '';

  try {
    const contextData = getContextData();
    const contextMessagesStr = getContextMessagesString();
    const worldInfoMacros = await getWorldInfoContext();
    const otherCharactersStr = getAdditionalCharactersContext();

    let inputToProcess = props.originalText;
    let promptToUse = promptOverride.value;
    if (escapeMacros.value) {
      inputToProcess = `{{#raw}}${props.originalText}{{/raw}}`;
      promptToUse = `{{#raw}}${promptOverride.value}{{/raw}}`;
    }

    const response = await service.generateRewrite(
      inputToProcess,
      selectedTemplateId.value,
      selectedProfile.value || props.api.settings.getGlobal('api.selectedConnectionProfile'),
      promptToUse,
      contextData,
      {
        contextMessages: contextMessagesStr,
        fieldName: props.identifier,
        otherCharacters: otherCharactersStr,
        ...worldInfoMacros,
      },
      argOverrides.value,
      abortController.value?.signal,
    );

    if (Symbol.asyncIterator in response) {
      let rawAcc = '';
      for await (const chunk of response) {
        rawAcc += chunk.delta;
        oneShotGeneratedText.value = service.extractCodeBlock(rawAcc);
      }
    } else {
      oneShotGeneratedText.value = service.extractCodeBlock(response.content);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error(error);
    if (error?.name === 'AbortError' || error?.message?.includes('abort')) {
      props.api.ui.showToast(t('extensionsBuiltin.rewrite.messages.generationAborted'), 'info');
    } else {
      props.api.ui.showToast(t('extensionsBuiltin.rewrite.messages.generationFailed') + ': ' + error.message, 'error');
    }
  } finally {
    isGenerating.value = false;
    abortController.value = null;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function deepToRaw<T extends Record<string, any>>(sourceObj: T): T {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const objectIterator = (input: any): any => {
    if (Array.isArray(input)) {
      return input.map((item) => objectIterator(item));
    }
    if (isRef(input) || isReactive(input) || isProxy(input)) {
      return objectIterator(toRaw(input));
    }
    if (input && typeof input === 'object') {
      return Object.keys(input).reduce((acc, key) => {
        acc[key as keyof typeof acc] = objectIterator(input[key]);
        return acc;
      }, {} as T);
    }
    return input;
  };

  return objectIterator(sourceObj);
}

// --- Session Logic ---

async function refreshSessions() {
  sessions.value = await service.getSessions(props.identifier);
}

async function handleNewSession() {
  saveState();
  try {
    const contextData = getContextData();
    const contextMessagesStr = getContextMessagesString();
    const worldInfoMacros = await getWorldInfoContext();
    const otherCharactersStr = getAdditionalCharactersContext();

    const additionalMacros = {
      contextMessages: contextMessagesStr,
      fieldName: props.identifier,
      otherCharacters: otherCharactersStr,
      ...worldInfoMacros,
    };

    activeSession.value = await service.createSession(
      selectedTemplateId.value,
      props.identifier,
      props.originalText,
      contextData,
      additionalMacros,
      argOverrides.value,
    );
    await refreshSessions();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (e: any) {
    console.error(e);
    props.api.ui.showToast(t('extensionsBuiltin.rewrite.session.createFailed') + ': ' + e.message, 'error');
  }
}

async function handleLoadSession(id: string) {
  activeSession.value = await service.getSession(id);
}

async function handleDeleteSession(id: string) {
  await service.deleteSession(id);
  if (activeSession.value?.id === id) {
    activeSession.value = null;
  }
  await refreshSessions();
}

async function handleSessionSend(text: string) {
  if (!activeSession.value || !selectedProfile.value) return;

  isGenerating.value = true;
  abortController.value = new AbortController();

  // Add User Message
  activeSession.value.messages.push({
    id: props.api.uuid(),
    role: 'user',
    content: text,
    timestamp: Date.now(),
  });
  await service.saveSession(deepToRaw(activeSession.value));

  await executeSessionGeneration();
}

async function executeSessionGeneration() {
  if (!activeSession.value || !selectedProfile.value) return;

  try {
    const response = await service.generateSessionResponse(
      activeSession.value.messages,
      structuredResponseFormat.value,
      selectedProfile.value || props.api.settings.getGlobal('api.selectedConnectionProfile'),
      abortController.value?.signal,
    );

    activeSession.value.messages.push({
      id: props.api.uuid(),
      role: 'assistant',
      content: response,
      timestamp: Date.now(),
    });

    await service.saveSession(deepToRaw(activeSession.value));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error(error);
    if (error?.name === 'AbortError') {
      props.api.ui.showToast(t('extensionsBuiltin.rewrite.messages.generationAborted'), 'info');
    } else {
      props.api.ui.showToast(t('extensionsBuiltin.rewrite.messages.generationFailed') + ': ' + error.message, 'error');
    }
  } finally {
    isGenerating.value = false;
    abortController.value = null;
  }
}

async function handleSessionDeleteFrom(msgId: string) {
  if (!activeSession.value) return;
  const index = activeSession.value.messages.findIndex((m) => m.id === msgId);
  if (index !== -1) {
    activeSession.value.messages = activeSession.value.messages.slice(0, index);
    await service.saveSession(deepToRaw(activeSession.value));
  }
}

async function handleEditMessage(msgId: string, newContent: string) {
  if (!activeSession.value) return;
  const msg = activeSession.value.messages.find((m) => m.id === msgId);
  if (msg) {
    msg.content = newContent;
    await service.saveSession(deepToRaw(activeSession.value));
  }
}

async function handleRegenerate() {
  if (!activeSession.value) return;

  const lastMsg = activeSession.value.messages[activeSession.value.messages.length - 1];
  if (!lastMsg) return;

  if (lastMsg.role === 'assistant') {
    // Remove last assistant message
    activeSession.value.messages.pop();
    await service.saveSession(deepToRaw(activeSession.value));
  }

  // Generate
  isGenerating.value = true;
  abortController.value = new AbortController();
  await executeSessionGeneration();
}

// --- Common ---

function handleApply(text: string) {
  saveState();
  props.onApply(text);
  props.closePopup?.();
}

function handleApplyLatestSession() {
  if (latestSessionText.value) {
    handleApply(latestSessionText.value);
  }
}

function handleCancel() {
  props.onCancel();
  props.closePopup?.();
}

function handleCopyOutput() {
  if (!oneShotGeneratedText.value) return;
  navigator.clipboard.writeText(oneShotGeneratedText.value).then(
    () => props.api.ui.showToast(t('extensionsBuiltin.rewrite.messages.copiedToClipboard'), 'success'),
    () => props.api.ui.showToast(t('extensionsBuiltin.rewrite.messages.copyFailed'), 'error'),
  );
}

// --- Diff Logic ---

const latestSessionText = computed(() => {
  if (!activeSession.value || activeSession.value.messages.length === 0) return '';
  // Iterate backwards to find last assistant message with a response
  const messages = activeSession.value.messages;
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role === 'assistant') {
      const content = m.content;
      if (typeof content === 'string') return content;
      if ((content as RewriteLLMResponse).response) {
        return (content as RewriteLLMResponse).response as string;
      }
    }
  }
  return '';
});

function openDiffPopup(original: string, modified: string) {
  props.api.ui
    .showPopup({
      title: t('extensionsBuiltin.rewrite.popup.diff'),
      component: markRaw(RewriteView),
      componentProps: {
        originalText: original,
        generatedText: modified,
        isGenerating: false,
        ignoreInput: false,
      },
      wide: true,
      large: true,
      customButtons: [
        {
          text: t('extensionsBuiltin.rewrite.popup.apply'),
          result: 1, // Positive result
          classes: ['btn-confirm'],
        },
        {
          text: t('common.close'),
          result: 0,
          classes: ['btn-ghost'],
        },
      ],
    })
    .then(({ result }) => {
      if (result === 1) {
        handleApply(modified);
      }
    });
}

function handleShowDiff(previous: string, current: string) {
  openDiffPopup(previous, current);
}

function handleGeneralDiff() {
  if (!activeSession.value) return;
  // Diff Original vs Latest
  openDiffPopup(props.originalText, latestSessionText.value);
}
</script>

<template>
  <div class="rewrite-popup-content">
    <div class="controls-row">
      <div style="flex: 1">
        <FormItem :label="t('extensionsBuiltin.rewrite.popup.template')">
          <Select v-model="selectedTemplateId" :options="templateOptions" />
        </FormItem>
      </div>
      <div style="flex: 1">
        <FormItem :label="t('extensionsBuiltin.rewrite.popup.connectionProfile')">
          <ConnectionProfileSelector v-model="selectedProfile" />
        </FormItem>
      </div>
    </div>

    <ContextPromptSection
      :api="api"
      :active-tab="activeTab"
      :current-template="currentTemplate"
      :arg-overrides="argOverrides"
      :escape-macros="escapeMacros"
      :context-message-count="contextMessageCount"
      :is-character-context-open="isCharacterContextOpen"
      :is-world-info-context-open="isWorldInfoContextOpen"
      :selected-context-characters="selectedContextCharacters"
      :selected-context-lorebooks="selectedContextLorebooks"
      :selected-context-entries="selectedContextEntries"
      :available-lorebooks="availableLorebooks"
      :available-characters="availableCharacters"
      :selected-entry-context="selectedEntryContext"
      :is-world-info-field="IS_WORLD_INFO_FIELD"
      :prompt-override="promptOverride"
      :structured-response-format="structuredResponseFormat"
      :can-reset-prompt="canResetPrompt"
      :book-cache="bookCache"
      @update:arg-overrides="argOverrides = $event"
      @update:escape-macros="escapeMacros = $event"
      @update:context-message-count="contextMessageCount = $event"
      @update:is-character-context-open="isCharacterContextOpen = $event"
      @update:is-world-info-context-open="isWorldInfoContextOpen = $event"
      @update:selected-context-characters="selectedContextCharacters = $event"
      @update:selected-context-lorebooks="selectedContextLorebooks = $event"
      @update:selected-context-entries="selectedContextEntries = $event"
      @update:prompt-override="promptOverride = $event"
      @update:structured-response-format="structuredResponseFormat = $event as StructuredResponseFormat"
      @reset-prompt="resetPrompt"
    />

    <!-- Tabs -->
    <Tabs
      v-model="activeTab"
      :options="[
        { label: t('extensionsBuiltin.rewrite.popup.oneShot'), value: 'one-shot', icon: 'fa-wand-magic-sparkles' },
        { label: t('extensionsBuiltin.rewrite.popup.sessions'), value: 'session', icon: 'fa-comments' },
      ]"
    />

    <div class="tab-content">
      <!-- One-Shot View -->
      <OneShotTab
        v-show="activeTab === 'one-shot'"
        :original-text="originalText"
        :one-shot-generated-text="oneShotGeneratedText"
        :is-generating="isGenerating"
        :ignore-input="!!IGNORE_INPUT"
        :api="api"
        @generate="handleGenerateOneShot"
        @abort="handleAbort"
        @cancel="handleCancel"
        @apply="handleApply"
        @copy-output="handleCopyOutput"
      />

      <!-- Session View -->
      <SessionTab
        v-show="activeTab === 'session'"
        :api="api"
        :sessions="sessions"
        :active-session="activeSession"
        :is-generating="isGenerating"
        :original-text="originalText"
        :latest-session-text="latestSessionText"
        @new-session="handleNewSession"
        @load-session="handleLoadSession"
        @delete-session="handleDeleteSession"
        @send="handleSessionSend"
        @delete-from="handleSessionDeleteFrom"
        @edit-message="handleEditMessage"
        @apply="handleApply"
        @show-diff="handleShowDiff"
        @abort="handleAbort"
        @regenerate="handleRegenerate"
        @cancel="handleCancel"
        @apply-latest="handleApplyLatestSession"
        @general-diff="handleGeneralDiff"
      />
    </div>
  </div>
</template>

<style scoped lang="scss">
.rewrite-popup-content {
  display: flex;
  flex-direction: column;
  gap: 15px;
  height: 100%;
}

.controls-row {
  display: flex;
  gap: 10px;
}

.tab-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
</style>
