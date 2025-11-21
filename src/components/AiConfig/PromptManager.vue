<script setup lang="ts">
import { computed, ref } from 'vue';
import { useSettingsStore } from '../../stores/settings.store';
import { useStrictI18n } from '../../composables/useStrictI18n';
import type { Prompt } from '../../types/settings';
import { cloneDeep } from 'lodash-es';
import { toast } from '../../composables/useToast';
import type { MessageRole } from '@/types';
import DraggableList from '../Common/DraggableList.vue';

const settingsStore = useSettingsStore();
const { t } = useStrictI18n();

// Local state for editing
const editingIdentifier = ref<string | null>(null);

// Interface for the UI list
interface DisplayPrompt extends Prompt {
  enabled: boolean;
}

// Compute the list by merging definitions with the order configuration
const displayPrompts = computed<DisplayPrompt[]>(() => {
  const definitions = settingsStore.settings.api.samplers.prompts || [];
  const orderConfig = settingsStore.settings.api.samplers.prompt_order?.order || [];

  // Create a map for quick lookup
  const defMap = new Map(definitions.map((p) => [p.identifier, p]));

  const result: DisplayPrompt[] = [];
  const processedIds = new Set<string>();

  // 1. Add items based on order
  for (const item of orderConfig) {
    const def = defMap.get(item.identifier);
    if (def) {
      result.push({ ...def, enabled: item.enabled });
      processedIds.add(item.identifier);
    }
  }

  // 2. Add any definitions not present in the order (fallback/safety)
  for (const def of definitions) {
    if (!processedIds.has(def.identifier)) {
      result.push({ ...def, enabled: true });
    }
  }

  return result;
});

function saveChanges(newDisplayList: DisplayPrompt[]) {
  // 1. Update Definitions (Prompt[])
  // We filter out the 'enabled' property to match the Prompt type
  const newDefinitions: Prompt[] = newDisplayList.map((p) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { enabled, ...rest } = p;
    return rest;
  });

  // 2. Update Order ({ identifier, enabled }[])
  const newOrder = newDisplayList.map((p) => ({
    identifier: p.identifier,
    enabled: p.enabled,
  }));

  settingsStore.settings.api.samplers.prompts = newDefinitions;
  settingsStore.settings.api.samplers.prompt_order = { order: newOrder };
}

function createNewPrompt() {
  const id = `custom-${Date.now()}`;
  const newPrompt: DisplayPrompt = {
    name: 'New Prompt',
    identifier: id,
    system_prompt: true,
    content: '',
    role: 'system',
    enabled: true,
  };

  const newList = [...displayPrompts.value, newPrompt];
  saveChanges(newList);
  editingIdentifier.value = id;
}

function deletePrompt(identifier: string) {
  const p = displayPrompts.value.find((x) => x.identifier === identifier);
  if (!p) return;

  if (p.marker) {
    toast.error(t('aiConfig.promptManager.cannotDeleteMarker'));
    return;
  }

  const newList = displayPrompts.value.filter((x) => x.identifier !== identifier);
  saveChanges(newList);

  if (editingIdentifier.value === identifier) {
    editingIdentifier.value = null;
  }
}

function toggleEdit(identifier: string) {
  if (editingIdentifier.value === identifier) {
    editingIdentifier.value = null;
  } else {
    editingIdentifier.value = identifier;
  }
}

function toggleEnabled(index: number) {
  const newList = cloneDeep(displayPrompts.value);
  newList[index].enabled = !newList[index].enabled;
  saveChanges(newList);
}

// When editing fields (name, content, etc), we need to update the definition in the store
function updatePromptField(index: number, field: keyof Prompt, value: string | MessageRole) {
  const newList = cloneDeep(displayPrompts.value);
  // @ts-expect-error Dynamic assignment
  newList[index][field] = value;
  saveChanges(newList);
}

function getBadgeClass(role?: string) {
  switch (role) {
    case 'system':
      return 'prompt-item-badge--system';
    case 'user':
      return 'prompt-item-badge--user';
    case 'assistant':
      return 'prompt-item-badge--assistant';
    default:
      return '';
  }
}
</script>

<template>
  <div class="prompt-manager">
    <div class="prompt-manager-header">
      <button class="menu-button" @click="createNewPrompt">
        <i class="fa-solid fa-plus"></i>
        {{ t('aiConfig.promptManager.newPrompt') }}
      </button>
    </div>

    <div class="prompt-manager-list-container">
      <DraggableList
        :items="displayPrompts"
        item-key="identifier"
        handle-class="prompt-item-drag-handle"
        class="prompt-manager-list"
        @update:items="saveChanges"
      >
        <template #default="{ item: prompt, index }">
          <div
            class="prompt-item"
            :class="{
              disabled: !prompt.enabled,
              'is-editing': editingIdentifier === prompt.identifier,
            }"
          >
            <!-- Header Row -->
            <div class="prompt-item-header">
              <div class="prompt-item-actions">
                <div
                  class="menu-button-icon fa-solid fa-grip-lines prompt-item-drag-handle"
                  :title="t('common.dragToReorder')"
                ></div>
              </div>

              <div class="prompt-item-info" @click="toggleEdit(prompt.identifier)">
                <span class="prompt-item-name">{{ prompt.name }}</span>
                <div class="prompt-item-badges">
                  <span v-if="prompt.marker" class="prompt-item-badge prompt-item-badge--marker">Marker</span>
                  <span v-else class="prompt-item-badge" :class="getBadgeClass(prompt.role)">{{ prompt.role }}</span>
                </div>
              </div>

              <div class="prompt-item-actions">
                <button
                  class="menu-button-icon fa-solid"
                  :class="prompt.enabled ? 'fa-toggle-on' : 'fa-toggle-off'"
                  :title="t('common.toggle')"
                  @click.stop="toggleEnabled(index)"
                ></button>

                <button
                  class="menu-button-icon fa-solid fa-trash menu-button--danger"
                  :disabled="!!prompt.marker"
                  @click.stop="deletePrompt(prompt.identifier)"
                ></button>
              </div>
            </div>

            <!-- Editor Row (Expandable) -->
            <div v-show="editingIdentifier === prompt.identifier" class="prompt-item-editor">
              <label>
                {{ t('common.name') }}
                <input
                  :value="prompt.name"
                  class="text-pole"
                  @input="updatePromptField(index, 'name', ($event.target as HTMLInputElement).value)"
                />
              </label>

              <template v-if="!prompt.marker">
                <label>
                  {{ t('aiConfig.promptManager.role') }}
                  <select
                    :value="prompt.role"
                    class="text-pole"
                    @change="
                      updatePromptField(index, 'role', ($event.target as HTMLSelectElement).value as MessageRole)
                    "
                  >
                    <option value="system">System</option>
                    <option value="user">User</option>
                    <option value="assistant">Assistant</option>
                  </select>
                </label>

                <label>
                  {{ t('aiConfig.promptManager.content') }}
                  <textarea
                    :value="prompt.content"
                    class="text-pole"
                    rows="5"
                    @input="updatePromptField(index, 'content', ($event.target as HTMLTextAreaElement).value)"
                  ></textarea>
                </label>
              </template>
              <div v-else class="prompt-empty-state" style="padding: 5px; font-size: 0.9em">
                {{ t('aiConfig.promptManager.markerHint') }}
              </div>
            </div>
          </div>
        </template>
      </DraggableList>

      <div v-if="displayPrompts.length === 0" class="prompt-empty-state">
        <i class="fa-solid fa-layer-group"></i>
        <p>{{ t('aiConfig.promptManager.noPrompts') }}</p>
      </div>
    </div>
  </div>
</template>
