<script setup lang="ts">
import { ref, watch, computed, nextTick, onUnmounted } from 'vue';
import { useCharacterStore } from '../../stores/character.store';
import { useSettingsStore } from '../../stores/settings.store';
import type { Character, MessageRole } from '../../types';
import Popup from '../Popup/Popup.vue';
import { POPUP_TYPE, type PopupOptions } from '../../types';
import { getThumbnailUrl } from '../../utils/image';
import { useStrictI18n } from '../../composables/useStrictI18n';
import { slideTransitionHooks } from '../../utils/dom';
import { get, set } from 'lodash-es';
import {
  default_avatar,
  depth_prompt_depth_default,
  depth_prompt_role_default,
  talkativeness_default,
} from '../../constants';
import type { Path, ValueForPath } from '../../types/utils';
import { toast } from '../../composables/useToast';
import { usePopupStore } from '../../stores/popup.store';

type CharacterFormData = Omit<Character, 'data'> & {
  data: Omit<NonNullable<Character['data']>, 'depth_prompt'> & {
    depth_prompt?: {
      prompt: string;
      depth: number;
      role: MessageRole;
    };
  };
};

type CharacterFormDataPath = Path<CharacterFormData>;

const { t } = useStrictI18n();
const characterStore = useCharacterStore();
const settingsStore = useSettingsStore();
const popupStore = usePopupStore();
const tokenCounts = computed(() => characterStore.tokenCounts.fields);
const activeCharacter = computed(() => characterStore.activeCharacter);
const isCreating = computed(() => characterStore.isCreating);

const formData = ref<CharacterFormData>({} as CharacterFormData);
const isUpdatingFromStore = ref(false);

// --- State for new features ---
const isPeeking = ref(false);
const isSpoilerModeActive = computed(() => settingsStore.settings.character.spoilerFreeMode);
const areDetailsHidden = computed(() => isSpoilerModeActive.value && !isPeeking.value && !isCreating.value);

// --- Drawer States ---
const isCreatorNotesOpen = ref(false);
const isPromptOverridesOpen = ref(false);
const isMetadataOpen = ref(false);

// --- Popup state for maximizing editors ---
type EditableField =
  | 'description'
  | 'first_mes'
  | 'data.creator_notes'
  | 'personality'
  | 'scenario'
  | 'mes_example'
  | 'data.system_prompt'
  | 'data.post_history_instructions'
  | 'data.depth_prompt.prompt';
const isEditorPopupVisible = ref(false);
const editorPopupValue = ref('');
const editingFieldName = ref<EditableField | null>(null);
const editorPopupOptions = ref<PopupOptions>({});
const editorPopupTitle = ref('');

// --- Creation State ---
const avatarPreviewUrl = ref<string | null>(null);
const selectedAvatarFile = ref<File | null>(null);
const isSubmitting = ref(false);

// --- Transition Hooks ---
const { beforeEnter, enter, afterEnter, beforeLeave, leave, afterLeave } = slideTransitionHooks;

// --- Computed properties for form fields ---
const joinedTags = computed({
  get: () => formData.value.tags?.join(', ') || '',
  set: (value) => {
    updateValue(
      'tags',
      value.split(',').map((t) => t.trim()),
    );
  },
});

// --- Watchers to sync form data with store ---
watch(
  activeCharacter,
  (newChar) => {
    if (newChar) {
      if (JSON.stringify(newChar) !== JSON.stringify(formData.value)) {
        isUpdatingFromStore.value = true;

        const charCopy = JSON.parse(JSON.stringify(newChar));

        // Ensure data structures exist for the template
        if (!charCopy.data) charCopy.data = {};
        if (!charCopy.data.creator_notes) charCopy.data.creator_notes = charCopy.creatorcomment || '';
        if (!charCopy.data.depth_prompt) {
          charCopy.data.depth_prompt = {
            prompt: '',
            depth: depth_prompt_depth_default,
            role: depth_prompt_role_default,
          };
        }
        if (charCopy.talkativeness === undefined) charCopy.talkativeness = talkativeness_default;

        formData.value = charCopy;
        characterStore.calculateAllTokens(charCopy);
        isPeeking.value = false;

        if (!isCreating.value) {
          revokePreviewUrl();
          selectedAvatarFile.value = null;
        }

        nextTick(() => {
          isUpdatingFromStore.value = false;
        });
      }
    } else {
      formData.value = { data: {} } as CharacterFormData;
      revokePreviewUrl();
    }
  },
  { immediate: true, deep: true },
);

watch(
  formData,
  (newData, oldData) => {
    if (isUpdatingFromStore.value) return;
    if (oldData && Object.keys(oldData).length === 0) return; // Prevent saving on initial hydration

    // If creating, update the draft in store but don't call save API
    if (isCreating.value) {
      characterStore.saveActiveCharacter(newData); // This updates the draft state in store without API call
      return;
    }

    if (newData.avatar === oldData?.avatar) {
      characterStore.saveCharacterDebounced(newData);
      characterStore.calculateAllTokens(newData);
    }
  },
  { deep: true },
);

onUnmounted(() => {
  revokePreviewUrl();
});

// --- Methods ---
function updateValue<P extends CharacterFormDataPath>(path: P, value: ValueForPath<CharacterFormData, P>) {
  set(formData.value, path, value);
}

function toggleFavorite() {
  formData.value.fav = !formData.value.fav;
}

function peekSpoilerMode() {
  isPeeking.value = !isPeeking.value;
}

function openMaximizeEditor(fieldName: EditableField, title: string) {
  editingFieldName.value = fieldName;
  editorPopupTitle.value = t('characterEditor.advanced.editingTitle', { title });
  editorPopupValue.value = get(formData.value, fieldName) ?? '';
  editorPopupOptions.value = { wide: true, large: true, okButton: 'common.ok', cancelButton: false };
  isEditorPopupVisible.value = true;
}

function handleEditorSubmit({ value }: { value: string }) {
  if (editingFieldName.value) {
    set(formData.value, editingFieldName.value, value);
  }
}

function revokePreviewUrl() {
  if (avatarPreviewUrl.value) {
    URL.revokeObjectURL(avatarPreviewUrl.value);
    avatarPreviewUrl.value = null;
  }
}

async function handleAvatarFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  if (input.files && input.files[0]) {
    const file = input.files[0];

    // If in creation mode, show preview
    if (isCreating.value) {
      revokePreviewUrl();
      avatarPreviewUrl.value = URL.createObjectURL(file);
      selectedAvatarFile.value = file;
      // Also update name if empty
      if (!formData.value.name) {
        const name = file.name.replace(/\.[^/.]+$/, '');
        updateValue('name', name);
      }
    } else {
      await characterStore.updateCharacterImage(formData.value.avatar, file);
    }
  }
}

async function handleCreate() {
  if (!formData.value.name) {
    toast.error(t('characterEditor.validation.nameRequired'));
    return;
  }
  if (!selectedAvatarFile.value) {
    try {
      const res = await fetch(default_avatar);
      const blob = await res.blob();
      selectedAvatarFile.value = new File([blob], 'avatar.png', { type: 'image/png' });
    } catch {
      alert('Please select an avatar.'); // TODO: Add i18n, use toast, show error
      return;
    }
  }

  isSubmitting.value = true;
  try {
    await characterStore.createNewCharacter(formData.value as Character, selectedAvatarFile.value);
  } finally {
    isSubmitting.value = false;
  }
}

async function handleDelete() {
  const charName = formData.value.name;
  const avatar = formData.value.avatar;

  const RESULT_CANCEL = -1;
  const RESULT_DELETE_ONLY = 1;
  const RESULT_DELETE_WITH_CHATS = 2;

  const result = await popupStore.show({
    title: t('character.delete.confirmTitle'),
    content: t('character.delete.confirmMessage', { name: charName }),
    type: POPUP_TYPE.TEXT,
    okButton: false,
    cancelButton: false,
    customButtons: [
      {
        text: t('common.cancel'),
        result: RESULT_CANCEL,
      },
      {
        text: t('common.delete'),
        result: RESULT_DELETE_ONLY,
        classes: 'menu-button--danger',
      },
      {
        text: t('character.delete.deleteChats'),
        result: RESULT_DELETE_WITH_CHATS,
        classes: 'menu-button--danger',
      },
    ],
  });

  if (result.result === RESULT_DELETE_ONLY) {
    await characterStore.deleteCharacter(avatar, false);
  } else if (result.result === RESULT_DELETE_WITH_CHATS) {
    await characterStore.deleteCharacter(avatar, true);
  }
}

const displayAvatarUrl = computed(() => {
  if (isCreating.value && avatarPreviewUrl.value) {
    return avatarPreviewUrl.value;
  }
  return getThumbnailUrl('avatar', formData.value.avatar);
});
</script>

<template>
  <div v-show="activeCharacter && formData.data" class="character-edit-form">
    <form id="character-editor-form" action="javascript:void(null);" method="post" enctype="multipart/form-data">
      <div id="character-editor-header" class="character-edit-form-header">
        <div id="character-editor-name-container" class="character-edit-form-header-main">
          <h2 v-show="!isCreating" class="interactable" tabindex="0">{{ formData.name }}</h2>
          <input
            v-show="isCreating"
            v-model="formData.name"
            class="text-pole"
            :placeholder="t('characterEditor.namePlaceholder')"
            style="font-size: 1.2em; font-weight: bold"
          />
        </div>
        <div class="character-edit-form-header-info">
          <div id="character-editor-token-info" class="result_info" :title="t('characterEditor.tokenCounts.title')">
            <div>
              <strong id="character-editor-total-tokens" :title="t('characterEditor.tokenCounts.total')">{{
                characterStore.totalTokens
              }}</strong
              >&nbsp;<span>{{ t('common.tokens') }}</span>
            </div>
            <div>
              <small :title="t('characterEditor.tokenCounts.permanent')">
                (<span id="character-editor-permanent-tokens">{{ characterStore.permanentTokens }}</span
                >&nbsp;<span>{{ t('characterEditor.tokenCounts.permanent') }}</span
                >)
              </small>
            </div>
          </div>
          <!-- TODO: Implement token warning visibility logic -->
          <a
            v-show="!isCreating"
            id="character-editor-token-warning"
            class="menu-button-icon fa-solid fa-triangle-exclamation"
            style="display: none"
            href="https://docs.sillytavern.app/usage/core-concepts/characterdesign/#character-tokens"
            target="_blank"
            :title="t('characterEditor.tokenCounts.warningTooltip')"
          ></a>
          <i
            v-show="!isCreating"
            id="character-editor-stats-button"
            class="menu-button-icon fa-solid fa-ranking-star"
            :title="t('characterEditor.stats.title')"
          ></i>
        </div>
      </div>

      <div class="character-edit-form-avatar-name-block">
        <div class="character-edit-form-avatar-area">
          <label for="add_avatar_button" class="character-edit-form-avatar-label" :title="t('characterEditor.avatar')">
            <img
              id="character-editor-avatar"
              :src="displayAvatarUrl"
              :alt="`${formData.name} Avatar`"
              class="character-edit-form-avatar-img"
            />
            <input
              id="add_avatar_button"
              hidden
              type="file"
              name="avatar"
              accept="image/*"
              @change="handleAvatarFileChange"
            />
          </label>
        </div>
        <div class="character-edit-form-controls">
          <!-- Creation Controls -->
          <div v-show="isCreating" class="character-edit-form-buttons">
            <button class="menu-button menu-button--confirm" :disabled="isSubmitting" @click="handleCreate">
              <i v-show="isSubmitting" class="fa-solid fa-spinner fa-spin"></i>
              {{ t('common.save') }}
            </button>
            <button class="menu-button" :disabled="isSubmitting" @click="characterStore.cancelCreating">
              {{ t('common.cancel') }}
            </button>
          </div>

          <!-- Existing Character Controls -->
          <div v-show="!isCreating" class="character-edit-form-buttons">
            <div
              class="menu-button fa-solid fa-star"
              :class="{ 'is-favorite': formData.fav }"
              :title="t('characterEditor.favorite')"
              @click="toggleFavorite"
            ></div>
            <div class="menu-button fa-solid fa-globe" :title="t('characterEditor.lore')"></div>
            <div class="menu-button fa-solid fa-passport" :title="t('characterEditor.chatLore')"></div>
            <div class="menu-button fa-solid fa-face-smile" :title="t('characterEditor.personas')"></div>
            <div class="menu-button fa-solid fa-file-export" :title="t('characterEditor.export')"></div>
            <div class="menu-button fa-solid fa-clone" :title="t('characterEditor.duplicate')"></div>
            <div
              class="menu-button fa-solid fa-skull menu-button--danger"
              :title="t('characterEditor.delete')"
              @click="handleDelete"
            ></div>
          </div>

          <label v-show="!isCreating">
            <select class="text-pole">
              <option value="default" disabled selected>{{ t('characterEditor.more') }}</option>
              <option>{{ t('characterEditor.moreOptions.linkWorldInfo') }}</option>
              <option>{{ t('characterEditor.moreOptions.importCardLore') }}</option>
              <option>{{ t('characterEditor.moreOptions.characterSettingsOverrides') }}</option>
              <option>{{ t('characterEditor.moreOptions.convertToPersona') }}</option>
              <option>{{ t('characterEditor.moreOptions.rename') }}</option>
              <option>{{ t('characterEditor.moreOptions.linkToSource') }}</option>
              <option>{{ t('characterEditor.moreOptions.replaceUpdate') }}</option>
              <option>{{ t('characterEditor.moreOptions.importTags') }}</option>
              <option>{{ t('characterEditor.moreOptions.setAsWelcomeAssistant') }}</option>
            </select>
          </label>
        </div>
      </div>

      <div class="character-edit-form-tags-block">
        <div class="tag-controls">
          <input class="text-pole" :placeholder="t('characterEditor.searchTags')" />
          <div class="menu-button fa-solid fa-tags" :title="t('characterEditor.viewAllTags')"></div>
        </div>
        <div class="tags">
          <span v-for="tag in formData.tags" :key="tag" class="tag">{{ tag }}</span>
        </div>
      </div>

      <!-- Creator's Notes Inline Drawer -->
      <div class="inline-drawer">
        <div class="inline-drawer-header" @click="isCreatorNotesOpen = !isCreatorNotesOpen">
          <span class="inline-drawer-header-title">{{ t('characterEditor.creatorNotes') }}</span>
          <div
            class="menu-button fa-solid fa-palette fa-fw"
            :title="t('characterEditor.toggleStyles')"
            @click.stop="() => {}"
          ></div>
          <div
            class="menu-button fa-solid fa-eye fa-fw"
            :title="t('characterEditor.toggleSpoiler')"
            @click.stop="peekSpoilerMode"
          ></div>
          <i
            class="fa-solid fa-circle-chevron-down inline-drawer-header-icon"
            :class="{ 'is-open': isCreatorNotesOpen }"
          ></i>
        </div>
        <Transition
          name="slide-js"
          @before-enter="beforeEnter"
          @enter="enter"
          @after-enter="afterEnter"
          @before-leave="beforeLeave"
          @leave="leave"
          @after-leave="afterLeave"
        >
          <div v-show="isCreatorNotesOpen">
            <div class="inline-drawer-content">
              <!-- TODO: We should make sure this is sanitized when we loading the character eslint-disable-next-line vue/no-v-html -->
              <div v-show="formData.data.creator_notes" v-html="formData.data.creator_notes"></div>
              <div v-show="!formData.data.creator_notes">{{ t('characterEditor.noCreatorNotes') }}</div>
            </div>
          </div>
        </Transition>
      </div>

      <small v-show="areDetailsHidden">{{ t('characterEditor.detailsHidden') }}</small>

      <div v-show="!areDetailsHidden" class="character-edit-form-main-content">
        <div class="form-section form-section--text-area" data-field-name="description">
          <label for="description_textarea">
            <span>{{ t('characterEditor.description') }}</span>
            <i
              class="editor-maximize-icon fa-solid fa-maximize"
              :title="t('characterEditor.expandEditor')"
              @click="openMaximizeEditor('description', t('characterEditor.description'))"
            ></i>
          </label>
          <textarea
            id="description_textarea"
            class="text-pole"
            rows="12"
            :value="formData.description"
            :placeholder="t('characterEditor.descriptionPlaceholder')"
            @input="updateValue('description', ($event.target as HTMLTextAreaElement).value)"
          ></textarea>
          <div class="token-counter">
            {{ t('common.tokens') }}: <span>{{ tokenCounts['description'] || 0 }}</span>
          </div>
        </div>

        <div class="form-section form-section--text-area" data-field-name="first_mes">
          <label for="firstmessage_textarea">
            <span>{{ t('characterEditor.firstMessage') }}</span>
            <i
              class="editor-maximize-icon fa-solid fa-maximize"
              :title="t('characterEditor.expandEditor')"
              @click="openMaximizeEditor('first_mes', t('characterEditor.firstMessage'))"
            ></i>
          </label>
          <textarea
            id="firstmessage_textarea"
            class="text-pole"
            rows="10"
            :value="formData.first_mes"
            :placeholder="t('characterEditor.firstMessagePlaceholder')"
            @input="updateValue('first_mes', ($event.target as HTMLTextAreaElement).value)"
          ></textarea>
          <div class="token-counter">
            {{ t('common.tokens') }}: <span>{{ tokenCounts['first_mes'] || 0 }}</span>
          </div>
        </div>
        <hr />
        <div class="form-section" data-field-name="personality">
          <label>
            <span>{{ t('characterEditor.advanced.personality') }}</span>
            <i
              class="editor-maximize-icon fa-solid fa-maximize"
              :title="t('characterEditor.expandEditor')"
              @click="openMaximizeEditor('personality', t('characterEditor.advanced.personality'))"
            ></i>
          </label>
          <textarea
            :value="formData.personality"
            class="text-pole"
            rows="4"
            :placeholder="t('characterEditor.advanced.personalityPlaceholder')"
            @input="updateValue('personality', ($event.target as HTMLTextAreaElement).value)"
          ></textarea>
          <div class="token-counter">
            {{ t('common.tokens') }}: <span>{{ tokenCounts['personality'] || 0 }}</span>
          </div>
        </div>
        <div class="form-section" data-field-name="scenario">
          <label>
            <span>{{ t('characterEditor.advanced.scenario') }}</span>
            <i
              class="editor-maximize-icon fa-solid fa-maximize"
              :title="t('characterEditor.expandEditor')"
              @click="openMaximizeEditor('scenario', t('characterEditor.advanced.scenario'))"
            ></i>
          </label>
          <textarea
            :value="formData.scenario"
            class="text-pole"
            rows="4"
            :placeholder="t('characterEditor.advanced.scenarioPlaceholder')"
            @input="updateValue('scenario', ($event.target as HTMLTextAreaElement).value)"
          ></textarea>
          <div class="token-counter">
            {{ t('common.tokens') }}: <span>{{ tokenCounts['scenario'] || 0 }}</span>
          </div>
        </div>
        <div class="form-section character-note" data-field-name="data.depth_prompt.prompt">
          <div class="character-note-main">
            <label>
              <span>{{ t('characterEditor.advanced.characterNote') }}</span>
              <i
                class="editor-maximize-icon fa-solid fa-maximize"
                :title="t('characterEditor.expandEditor')"
                @click="openMaximizeEditor('data.depth_prompt.prompt', t('characterEditor.advanced.characterNote'))"
              ></i>
            </label>
            <!-- @vue-ignore -->
            <textarea
              :value="formData.data.depth_prompt?.prompt"
              class="text-pole"
              rows="5"
              :placeholder="t('characterEditor.advanced.characterNotePlaceholder')"
              @input="updateValue('data.depth_prompt.prompt', ($event.target as HTMLTextAreaElement).value)"
            ></textarea>
          </div>
          <div class="character-note-controls">
            <label>{{ t('characterEditor.advanced.depth') }}</label>
            <!-- @vue-ignore -->
            <input
              :value="formData.data.depth_prompt?.depth"
              type="number"
              min="0"
              max="9999"
              class="text-pole"
              @input="updateValue('data.depth_prompt.depth', ($event.target as HTMLInputElement).valueAsNumber)"
            />
            <label>{{ t('characterEditor.advanced.role') }}</label>
            <!-- @vue-ignore -->
            <select
              :value="formData.data.depth_prompt?.role"
              class="text-pole"
              @change="updateValue('data.depth_prompt.role', ($event.target as HTMLSelectElement).value as MessageRole)"
            >
              <option value="system">{{ t('characterEditor.advanced.roles.system') }}</option>
              <option value="user">{{ t('characterEditor.advanced.roles.user') }}</option>
              <option value="assistant">{{ t('characterEditor.advanced.roles.assistant') }}</option>
            </select>
          </div>
        </div>
        <div class="form-section">
          <label>{{ t('characterEditor.advanced.talkativeness') }}</label>
          <small>{{ t('characterEditor.advanced.talkativenessHint') }}</small>
          <input
            :value="formData.talkativeness"
            type="range"
            min="0"
            max="1"
            step="0.05"
            @input="updateValue('talkativeness', ($event.target as HTMLInputElement).valueAsNumber)"
          />
          <div class="slider-hint">
            <span>{{ t('characterEditor.advanced.talkativenessShy') }}</span>
            <span>{{ t('characterEditor.advanced.talkativenessNormal') }}</span>
            <span>{{ t('characterEditor.advanced.talkativenessChatty') }}</span>
          </div>
        </div>
        <hr />
        <div class="form-section" data-field-name="mes_example">
          <label>
            <span>{{ t('characterEditor.advanced.dialogueExamples') }}</span>
            <i
              class="editor-maximize-icon fa-solid fa-maximize"
              :title="t('characterEditor.expandEditor')"
              @click="openMaximizeEditor('mes_example', t('characterEditor.advanced.dialogueExamples'))"
            ></i>
          </label>
          <small>{{ t('characterEditor.advanced.dialogueExamplesHint') }}</small>
          <textarea
            :value="formData.mes_example"
            class="text-pole"
            rows="6"
            :placeholder="t('characterEditor.advanced.dialogueExamplesPlaceholder')"
            @input="updateValue('mes_example', ($event.target as HTMLTextAreaElement).value)"
          ></textarea>
          <div class="token-counter">
            {{ t('common.tokens') }}: <span>{{ tokenCounts['mes_example'] || 0 }}</span>
          </div>
        </div>
        <hr />
        <div class="inline-drawer">
          <div class="inline-drawer-header" @click="isPromptOverridesOpen = !isPromptOverridesOpen">
            <h4 class="inline-drawer-header-title">
              {{ t('characterEditor.advanced.promptOverrides') }}
              <small>{{ t('characterEditor.advanced.promptOverridesHint') }}</small>
            </h4>
            <i
              class="fa-solid fa-circle-chevron-down inline-drawer-header-icon"
              :class="{ 'is-open': isPromptOverridesOpen }"
            ></i>
          </div>
          <Transition
            name="slide-js"
            @before-enter="beforeEnter"
            @enter="enter"
            @after-enter="afterEnter"
            @before-leave="beforeLeave"
            @leave="leave"
            @after-leave="afterLeave"
          >
            <div v-show="isPromptOverridesOpen">
              <div class="inline-drawer-content inline-drawer-content--column">
                <small>{{ t('characterEditor.advanced.promptHint') }}</small>
                <div data-field-name="data.system_prompt">
                  <label>
                    <span>{{ t('characterEditor.advanced.mainPrompt') }}</span>
                    <i
                      class="editor-maximize-icon fa-solid fa-maximize"
                      :title="t('characterEditor.expandEditor')"
                      @click="openMaximizeEditor('data.system_prompt', t('characterEditor.advanced.mainPrompt'))"
                    ></i>
                  </label>
                  <textarea
                    :value="formData.data.system_prompt"
                    class="text-pole"
                    rows="3"
                    :placeholder="t('characterEditor.advanced.mainPromptPlaceholder')"
                    @input="updateValue('data.system_prompt', ($event.target as HTMLTextAreaElement).value)"
                  ></textarea>
                  <div class="token-counter">
                    {{ t('common.tokens') }}: <span>{{ tokenCounts['data.system_prompt'] || 0 }}</span>
                  </div>
                </div>
                <div data-field-name="data.post_history_instructions">
                  <label>
                    <span>{{ t('characterEditor.advanced.postHistoryInstructions') }}</span>
                    <i
                      class="editor-maximize-icon fa-solid fa-maximize"
                      :title="t('characterEditor.expandEditor')"
                      @click="
                        openMaximizeEditor(
                          'data.post_history_instructions',
                          t('characterEditor.advanced.postHistoryInstructions'),
                        )
                      "
                    ></i>
                  </label>
                  <textarea
                    :value="formData.data.post_history_instructions"
                    class="text-pole"
                    rows="3"
                    :placeholder="t('characterEditor.advanced.postHistoryInstructionsPlaceholder')"
                    @input="updateValue('data.post_history_instructions', ($event.target as HTMLTextAreaElement).value)"
                  ></textarea>
                  <div class="token-counter">
                    {{ t('common.tokens') }}: <span>{{ tokenCounts['data.post_history_instructions'] || 0 }}</span>
                  </div>
                </div>
              </div>
            </div>
          </Transition>
        </div>
        <hr />
        <div class="inline-drawer">
          <div class="inline-drawer-header" @click="isMetadataOpen = !isMetadataOpen">
            <h4 class="inline-drawer-header-title">
              {{ t('characterEditor.advanced.metadata') }}
              <small>{{ t('characterEditor.advanced.metadataHint') }}</small>
            </h4>
            <i
              class="fa-solid fa-circle-chevron-down inline-drawer-header-icon"
              :class="{ 'is-open': isMetadataOpen }"
            ></i>
          </div>
          <Transition
            name="slide-js"
            @before-enter="beforeEnter"
            @enter="enter"
            @after-enter="afterEnter"
            @before-leave="beforeLeave"
            @leave="leave"
            @after-leave="afterLeave"
          >
            <div v-show="isMetadataOpen">
              <div class="inline-drawer-content inline-drawer-content--column">
                <small>{{ t('characterEditor.advanced.metadataOptional') }}</small>
                <div class="form-row">
                  <div class="form-column">
                    <label>{{ t('characterEditor.advanced.createdBy') }}</label>
                    <textarea
                      :value="formData.data.creator"
                      class="text-pole"
                      rows="2"
                      :placeholder="t('characterEditor.advanced.createdByPlaceholder')"
                      @input="updateValue('data.creator', ($event.target as HTMLTextAreaElement).value)"
                    ></textarea>
                  </div>
                  <div class="form-column">
                    <label>{{ t('characterEditor.advanced.characterVersion') }}</label>
                    <textarea
                      :value="formData.data.character_version"
                      class="text-pole"
                      rows="2"
                      :placeholder="t('characterEditor.advanced.characterVersionPlaceholder')"
                      @input="updateValue('data.character_version', ($event.target as HTMLTextAreaElement).value)"
                    ></textarea>
                  </div>
                </div>
                <div class="form-row">
                  <div class="form-column" data-field-name="data.creator_notes">
                    <label>
                      <span>{{ t('characterEditor.advanced.creatorNotes') }}</span>
                      <i
                        class="editor-maximize-icon fa-solid fa-maximize"
                        :title="t('characterEditor.expandEditor')"
                        @click="openMaximizeEditor('data.creator_notes', t('characterEditor.advanced.creatorNotes'))"
                      ></i>
                    </label>
                    <textarea
                      :value="formData.data.creator_notes"
                      class="text-pole"
                      rows="4"
                      :placeholder="t('characterEditor.advanced.creatorNotesPlaceholder')"
                      @input="updateValue('data.creator_notes', ($event.target as HTMLTextAreaElement).value)"
                    ></textarea>
                  </div>
                  <div class="form-column">
                    <label>{{ t('characterEditor.advanced.tagsToEmbed') }}</label>
                    <textarea
                      v-model="joinedTags"
                      class="text-pole"
                      rows="4"
                      :placeholder="t('characterEditor.advanced.tagsToEmbedPlaceholder')"
                    ></textarea>
                  </div>
                </div>
              </div>
            </div>
          </Transition>
        </div>
      </div>
    </form>

    <Popup
      id="character-edit-form-editor-popup"
      :visible="isEditorPopupVisible"
      :title="editorPopupTitle"
      :type="POPUP_TYPE.INPUT"
      :input-value="editorPopupValue"
      :options="editorPopupOptions"
      @submit="handleEditorSubmit"
      @close="isEditorPopupVisible = false"
    />
  </div>
</template>
