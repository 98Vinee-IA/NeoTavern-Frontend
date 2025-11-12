<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import type { PropType } from 'vue';
import { depth_prompt_depth_default, depth_prompt_role_default, talkativeness_default } from '../../constants';
import type { Character, PopupOptions } from '../../types';
import { POPUP_TYPE } from '../../types';
import Popup from '../Popup/Popup.vue';
import { DebounceTimeout } from '../../constants';

const props = defineProps({
  characterData: { type: Object as PropType<Partial<Character>>, required: true },
});
const emit = defineEmits(['close', 'update']);

const localFormData = ref<Partial<Character> & { data?: any }>({});
const autoSaveTimeout = ref<ReturnType<typeof setTimeout> | null>(null);

// Drawer states
const isPromptOverridesOpen = ref(false);
const isMetadataOpen = ref(false);

// Popup state for maximizing editors
type EditableField =
  | 'personality'
  | 'scenario'
  | 'mes_example'
  | 'data.system_prompt'
  | 'data.post_history_instructions'
  | 'data.creator_notes'
  | 'data.depth_prompt.prompt';
const isEditorPopupVisible = ref(false);
const editorPopupValue = ref('');
const editingFieldName = ref<EditableField | null>(null);
const editorPopupOptions = ref<PopupOptions>({});
const editorPopupTitle = ref('');

// --- Transition Hooks for Drawers ---
function beforeEnter(el: Element) {
  if (!(el instanceof HTMLElement)) return;
  el.style.height = '0';
  el.style.opacity = '0';
  el.style.overflow = 'hidden';
}
function enter(el: Element) {
  if (!(el instanceof HTMLElement)) return;
  el.getBoundingClientRect(); // Force repaint
  requestAnimationFrame(() => {
    el.style.height = `${el.scrollHeight}px`;
    el.style.opacity = '1';
  });
}
function afterEnter(el: Element) {
  if (!(el instanceof HTMLElement)) return;
  el.style.height = '';
}
function beforeLeave(el: Element) {
  if (!(el instanceof HTMLElement)) return;
  el.style.height = `${el.scrollHeight}px`;
  el.style.overflow = 'hidden';
}
function leave(el: Element) {
  if (!(el instanceof HTMLElement)) return;
  el.getBoundingClientRect(); // Force repaint
  requestAnimationFrame(() => {
    el.style.height = '0';
    el.style.opacity = '0';
  });
}
function afterLeave(el: Element) {
  if (!(el instanceof HTMLElement)) return;
  el.style.height = '';
  el.style.opacity = '0';
}

watch(
  () => props.characterData,
  (newData) => {
    const dataCopy = JSON.parse(JSON.stringify(newData));
    if (!dataCopy.data) {
      dataCopy.data = {};
    }
    if (!dataCopy.data.depth_prompt) {
      dataCopy.data.depth_prompt = {
        prompt: '',
        depth: depth_prompt_depth_default,
        role: depth_prompt_role_default,
      };
    }
    if (dataCopy.talkativeness === undefined) {
      dataCopy.talkativeness = talkativeness_default;
    }
    localFormData.value = dataCopy;
  },
  { immediate: true, deep: true },
);

watch(
  localFormData,
  (newData) => {
    if (autoSaveTimeout.value) clearTimeout(autoSaveTimeout.value);
    autoSaveTimeout.value = setTimeout(() => {
      emit('update', newData);
    }, DebounceTimeout.RELAXED);
  },
  { deep: true },
);

const characterName = computed(() => localFormData.value.name);
const joinedTags = computed({
  get: () => localFormData.value.tags?.join(', ') || '',
  set: (value) => {
    localFormData.value.tags = value.split(',').map((t) => t.trim());
  },
});

function openMaximizeEditor(fieldName: EditableField, title: string) {
  editingFieldName.value = fieldName;
  editorPopupTitle.value = `Editing: ${title}`;

  let value = '';
  const fields = fieldName.split('.');
  let current: any = localFormData.value;
  for (const field of fields) {
    if (current && typeof current === 'object' && field in current) {
      current = current[field];
    } else {
      current = undefined;
      break;
    }
  }
  value = current ?? '';

  editorPopupValue.value = value;
  editorPopupOptions.value = { wide: true, large: true, okButton: 'OK', cancelButton: false };
  isEditorPopupVisible.value = true;
}

function handleEditorSubmit({ value }: { value: string }) {
  if (editingFieldName.value) {
    const fields = editingFieldName.value.split('.');
    let current: any = localFormData.value;
    for (let i = 0; i < fields.length - 1; i++) {
      const field = fields[i];
      if (!current[field]) {
        current[field] = {};
      }
      current = current[field];
    }
    current[fields[fields.length - 1]] = value;
  }
}

function close() {
  emit('close');
}
</script>

<template>
  <div class="advanced-definitions-popup__wrapper" @click.self="close">
    <div class="advanced-definitions-popup">
      <header class="advanced-definitions-popup__header">
        <h3>{{ characterName }} - <span>Advanced Definitions</span></h3>
        <div class="advanced-definitions-popup__close-button fa-solid fa-circle-xmark" @click="close"></div>
      </header>
      <hr />

      <div class="advanced-definitions-popup__content">
        <!-- Prompt Overrides Drawer -->
        <div class="inline-drawer">
          <div class="inline-drawer-header" @click="isPromptOverridesOpen = !isPromptOverridesOpen">
            <h4 class="inline-drawer-header__title">
              Prompt Overrides <small>(For Chat Completion and Instruct Mode)</small>
            </h4>
            <i
              class="fa-solid fa-circle-chevron-down inline-drawer-header__icon"
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
              <div class="inline-drawer-content u-flex-col">
                <small v-pre>Insert {{ original }} into either box to include the respective default prompt.</small>
                <div>
                  <label>
                    <span>Main Prompt</span>
                    <i
                      class="editor-maximize-icon fa-solid fa-maximize"
                      title="Expand the editor"
                      @click="openMaximizeEditor('data.system_prompt', 'Main Prompt')"
                    ></i>
                  </label>
                  <textarea
                    v-model="localFormData.data.system_prompt"
                    class="text-pole"
                    rows="3"
                    placeholder="Any contents here will replace the default Main Prompt."
                  ></textarea>
                  <div class="token-counter">Tokens: <span>counting...</span></div>
                </div>
                <div>
                  <label>
                    <span>Post-History Instructions</span>
                    <i
                      class="editor-maximize-icon fa-solid fa-maximize"
                      title="Expand the editor"
                      @click="openMaximizeEditor('data.post_history_instructions', 'Post-History Instructions')"
                    ></i>
                  </label>
                  <textarea
                    v-model="localFormData.data.post_history_instructions"
                    class="text-pole"
                    rows="3"
                    placeholder="Any contents here will replace the default Post-History Instructions."
                  ></textarea>
                  <div class="token-counter">Tokens: <span>counting...</span></div>
                </div>
              </div>
            </div>
          </Transition>
        </div>

        <hr />

        <!-- Creator's Metadata Drawer -->
        <div class="inline-drawer">
          <div class="inline-drawer-header" @click="isMetadataOpen = !isMetadataOpen">
            <h4 class="inline-drawer-header__title">Creator's Metadata <small>(Not sent with the AI Prompt)</small></h4>
            <i
              class="fa-solid fa-circle-chevron-down inline-drawer-header__icon"
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
              <div class="inline-drawer-content u-flex-col">
                <small>Everything here is optional</small>
                <div class="u-flex u-flex-nowrap">
                  <div class="u-w-full">
                    <label>Created by</label>
                    <textarea
                      v-model="localFormData.data.creator"
                      class="text-pole"
                      rows="2"
                      placeholder="(Botmaker's name / Contact info)"
                    ></textarea>
                  </div>
                  <div class="u-w-full">
                    <label>Character Version</label>
                    <textarea
                      v-model="localFormData.data.character_version"
                      class="text-pole"
                      rows="2"
                      placeholder="(If you want to track character versions)"
                    ></textarea>
                  </div>
                </div>
                <div class="u-flex u-flex-nowrap">
                  <div class="u-w-full">
                    <label>
                      <span>Creator's Notes</span>
                      <i
                        class="editor-maximize-icon fa-solid fa-maximize"
                        title="Expand the editor"
                        @click="openMaximizeEditor('data.creator_notes', 'Creator\'s Notes')"
                      ></i>
                    </label>
                    <textarea
                      v-model="localFormData.data.creator_notes"
                      class="text-pole"
                      rows="4"
                      placeholder="(Describe the bot, give use tips, etc.)"
                    ></textarea>
                  </div>
                  <div class="u-w-full">
                    <label>Tags to Embed</label>
                    <textarea
                      v-model="joinedTags"
                      class="text-pole"
                      rows="4"
                      placeholder="(Write a comma-separated list of tags)"
                    ></textarea>
                  </div>
                </div>
              </div>
            </div>
          </Transition>
        </div>

        <hr />

        <!-- Other fields -->
        <div class="advanced-definitions-popup__section">
          <label
            ><span>Personality summary</span>
            <i
              class="editor-maximize-icon fa-solid fa-maximize"
              title="Expand the editor"
              @click="openMaximizeEditor('personality', 'Personality Summary')"
            ></i>
          </label>
          <textarea
            v-model="localFormData.personality"
            class="text-pole"
            rows="4"
            placeholder="(A brief description of the personality)"
          ></textarea>
          <div class="token-counter">Tokens: <span>counting...</span></div>
        </div>
        <div class="advanced-definitions-popup__section">
          <label>
            <span>Scenario</span>
            <i
              class="editor-maximize-icon fa-solid fa-maximize"
              title="Expand the editor"
              @click="openMaximizeEditor('scenario', 'Scenario')"
            ></i>
          </label>
          <textarea
            v-model="localFormData.scenario"
            class="text-pole"
            rows="4"
            placeholder="(Circumstances and context of the interaction)"
          ></textarea>
          <div class="token-counter">Tokens: <span>counting...</span></div>
        </div>
        <div class="advanced-definitions-popup__section character-note">
          <div class="u-w-full">
            <label>
              <span>Character's Note</span>
              <i
                class="editor-maximize-icon fa-solid fa-maximize"
                title="Expand the editor"
                @click="openMaximizeEditor('data.depth_prompt.prompt', 'Character\'s Note')"
              ></i>
            </label>
            <textarea
              v-model="localFormData.data.depth_prompt.prompt"
              class="text-pole"
              rows="5"
              placeholder="(Text to be inserted in-chat)"
            ></textarea>
          </div>
          <div>
            <label>@ Depth</label>
            <input
              v-model.number="localFormData.data.depth_prompt.depth"
              type="number"
              min="0"
              max="9999"
              class="text-pole"
            />
            <label>Role</label>
            <select v-model="localFormData.data.depth_prompt.role" class="text-pole">
              <option value="system">System</option>
              <option value="user">User</option>
              <option value="assistant">Assistant</option>
            </select>
          </div>
        </div>
        <div class="advanced-definitions-popup__section">
          <label>Talkativeness</label>
          <small>How often the character speaks in group chats!</small>
          <input v-model.number="localFormData.talkativeness" type="range" min="0" max="1" step="0.05" />
          <div class="slider-hint">
            <span>Shy</span>
            <span>Normal</span>
            <span>Chatty</span>
          </div>
        </div>
        <hr />
        <div class="advanced-definitions-popup__section">
          <label>
            <span>Examples of dialogue</span>
            <i
              class="editor-maximize-icon fa-solid fa-maximize"
              title="Expand the editor"
              @click="openMaximizeEditor('mes_example', 'Examples of Dialogue')"
            ></i>
          </label>
          <small>Important to set the character's writing style.</small>
          <textarea
            v-model="localFormData.mes_example"
            class="text-pole"
            rows="6"
            placeholder="(Examples of chat dialog. Begin each example with <START> on a new line.)"
          ></textarea>
          <div class="token-counter">Tokens: <span>counting...</span></div>
        </div>
      </div>
    </div>
    <Popup
      :visible="isEditorPopupVisible"
      :title="editorPopupTitle"
      :type="POPUP_TYPE.INPUT"
      v-model:inputValue="editorPopupValue"
      :options="editorPopupOptions"
      @submit="handleEditorSubmit"
      @close="isEditorPopupVisible = false"
    />
  </div>
</template>
