<script setup lang="ts">
import { ref, computed } from 'vue';
import type { PropType } from 'vue';
import { depth_prompt_depth_default, depth_prompt_role_default, talkativeness_default } from '../../constants';
import type { Character, PopupOptions } from '../../types';
import { POPUP_TYPE } from '../../types';
import Popup from '../Popup/Popup.vue';

const props = defineProps({
  modelValue: { type: Object as PropType<Partial<Character>>, required: true },
});
const emit = defineEmits(['close', 'update:modelValue']);

// Helper function to update nested properties without mutating props directly
function updateValue(path: string, value: any) {
  // Deep clone to avoid prop mutation.
  const newModelValue = JSON.parse(JSON.stringify(props.modelValue));

  // Ensure path exists in the new object
  const fields = path.split('.');
  let current: any = newModelValue;
  for (let i = 0; i < fields.length - 1; i++) {
    const field = fields[i];
    if (current[field] === undefined || current[field] === null) {
      current[field] = {};
    }
    current = current[field];
  }

  current[fields[fields.length - 1]] = value;

  // The parent's v-model will handle this event
  emit('update:modelValue', newModelValue);
}

// Helper function to safely get nested values from the prop
function getValue(path: string): any {
  const fields = path.split('.');
  let current: any = props.modelValue;
  for (const field of fields) {
    if (current && typeof current === 'object' && field in current) {
      current = current[field];
    } else {
      return undefined; // Return undefined if path is not found
    }
  }
  return current;
}

// Initialize missing data structures on the prop if they don't exist
// This is done once when the component is created to avoid template errors.
if (!props.modelValue.data) {
  props.modelValue.data = {};
}
if (!props.modelValue.data.depth_prompt) {
  props.modelValue.data.depth_prompt = {
    prompt: '',
    depth: depth_prompt_depth_default,
    role: depth_prompt_role_default,
  };
}
if (props.modelValue.talkativeness === undefined) {
  props.modelValue.talkativeness = talkativeness_default;
}

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

const characterName = computed(() => props.modelValue.name);
const joinedTags = computed({
  get: () => props.modelValue.tags?.join(', ') || '',
  set: (value) => {
    updateValue(
      'tags',
      value.split(',').map((t) => t.trim()),
    );
  },
});

function openMaximizeEditor(fieldName: EditableField, title: string) {
  editingFieldName.value = fieldName;
  editorPopupTitle.value = `Editing: ${title}`;
  editorPopupValue.value = getValue(fieldName) ?? '';
  editorPopupOptions.value = { wide: true, large: true, okButton: 'OK', cancelButton: false };
  isEditorPopupVisible.value = true;
}

function handleEditorSubmit({ value }: { value: string }) {
  if (editingFieldName.value) {
    updateValue(editingFieldName.value, value);
  }
}

function close() {
  emit('close');
}
</script>

<template>
  <div class="advanced-definitions-popup__wrapper" @click.self="close">
    <div v-if="modelValue.data" class="advanced-definitions-popup">
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
                    :value="modelValue.data.system_prompt"
                    @input="updateValue('data.system_prompt', ($event.target as HTMLTextAreaElement).value)"
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
                    :value="modelValue.data.post_history_instructions"
                    @input="updateValue('data.post_history_instructions', ($event.target as HTMLTextAreaElement).value)"
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
                      :value="modelValue.data.creator"
                      @input="updateValue('data.creator', ($event.target as HTMLTextAreaElement).value)"
                      class="text-pole"
                      rows="2"
                      placeholder="(Botmaker's name / Contact info)"
                    ></textarea>
                  </div>
                  <div class="u-w-full">
                    <label>Character Version</label>
                    <textarea
                      :value="modelValue.data.character_version"
                      @input="updateValue('data.character_version', ($event.target as HTMLTextAreaElement).value)"
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
                      :value="modelValue.data.creator_notes"
                      @input="updateValue('data.creator_notes', ($event.target as HTMLTextAreaElement).value)"
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
            :value="modelValue.personality"
            @input="updateValue('personality', ($event.target as HTMLTextAreaElement).value)"
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
            :value="modelValue.scenario"
            @input="updateValue('scenario', ($event.target as HTMLTextAreaElement).value)"
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
              :value="modelValue.data.depth_prompt!.prompt"
              @input="updateValue('data.depth_prompt.prompt', ($event.target as HTMLTextAreaElement).value)"
              class="text-pole"
              rows="5"
              placeholder="(Text to be inserted in-chat)"
            ></textarea>
          </div>
          <div>
            <label>@ Depth</label>
            <input
              :value="modelValue.data.depth_prompt!.depth"
              @input="updateValue('data.depth_prompt.depth', ($event.target as HTMLInputElement).valueAsNumber)"
              type="number"
              min="0"
              max="9999"
              class="text-pole"
            />
            <label>Role</label>
            <select
              :value="modelValue.data.depth_prompt!.role"
              @change="updateValue('data.depth_prompt.role', ($event.target as HTMLSelectElement).value)"
              class="text-pole"
            >
              <option value="system">System</option>
              <option value="user">User</option>
              <option value="assistant">Assistant</option>
            </select>
          </div>
        </div>
        <div class="advanced-definitions-popup__section">
          <label>Talkativeness</label>
          <small>How often the character speaks in group chats!</small>
          <input
            :value="modelValue.talkativeness"
            @input="updateValue('talkativeness', ($event.target as HTMLInputElement).valueAsNumber)"
            type="range"
            min="0"
            max="1"
            step="0.05"
          />
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
            :value="modelValue.mes_example"
            @input="updateValue('mes_example', ($event.target as HTMLTextAreaElement).value)"
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
