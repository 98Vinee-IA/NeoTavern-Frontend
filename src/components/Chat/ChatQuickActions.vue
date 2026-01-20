<script setup lang="ts">
import { computed, ref } from 'vue';
import { useStrictI18n } from '../../composables/useStrictI18n';
import { useComponentRegistryStore } from '../../stores/component-registry.store';
import { Button } from '../UI';

const { t } = useStrictI18n();
const isExpanded = ref(false);
const componentRegistryStore = useComponentRegistryStore();

const actionGroups = computed(() => {
  return Array.from(componentRegistryStore.chatQuickActionsRegistry.values())
    .filter((group) => (group.visible ?? true) && group.actions.length > 0)
    .map((group) => ({
      ...group,
      actions: group.actions.filter((action) => action.visible ?? true),
    }))
    .filter((group) => group.actions.length > 0);
});

function toggleExpanded() {
  isExpanded.value = !isExpanded.value;
}
</script>

<template>
  <div v-if="actionGroups.length > 0" class="chat-quick-actions" :class="{ 'is-expanded': isExpanded }">
    <div
      class="chat-quick-actions-header"
      role="button"
      tabindex="0"
      :aria-expanded="isExpanded"
      aria-controls="quick-actions-content"
      @click="toggleExpanded"
      @keydown.enter.prevent="toggleExpanded"
      @keydown.space.prevent="toggleExpanded"
    >
      <i class="icon fa-solid fa-chevron-right"></i>
      <span v-if="!isExpanded">{{ t('chat.quickActions.title') }}</span>
    </div>

    <div id="quick-actions-content" class="chat-quick-actions-content-wrapper" :class="{ 'is-expanded': isExpanded }">
      <div>
        <div class="chat-quick-actions-content">
          <div v-for="group in actionGroups" :key="group.id" class="quick-action-group">
            <span v-if="group.label" class="group-label">{{ group.label }}</span>
            <div class="group-actions">
              <Button
                v-for="action in group.actions"
                :key="action.id"
                class="quick-action-btn"
                variant="ghost"
                :icon="action.icon"
                :disabled="action.disabled"
                :title="action.title"
                @click="action.onClick"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
