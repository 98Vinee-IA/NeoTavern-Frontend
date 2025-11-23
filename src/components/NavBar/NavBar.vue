<script setup lang="ts">
import { useUiStore } from '../../stores/ui.store';
import { Button } from '../UI';

const uiStore = useUiStore();

function onNavItemClick(id: string, onClick?: () => void) {
  if (onClick) {
    onClick();
  } else {
    if (uiStore.activeDrawer === id) {
      uiStore.activeDrawer = null;
    } else {
      uiStore.activeDrawer = id;
    }
  }
}
</script>

<template>
  <div>
    <div id="nav-bar" class="nav-bar">
      <div class="nav-bar-nav">
        <div v-for="[id, item] in uiStore.navBarRegistry" :key="id" class="nav-item">
          <Button
            variant="ghost"
            :icon="item.icon"
            :active="uiStore.activeDrawer === id"
            :title="item.title"
            @click="onNavItemClick(id, item.onClick)"
          />
        </div>
      </div>
    </div>

    <!-- Drawers -->
    <template v-for="[id, item] in uiStore.navBarRegistry" :key="id">
      <div
        v-show="item.component"
        class="nav-item-content"
        :class="{ active: uiStore.activeDrawer === id, wide: item.layout === 'wide' }"
      >
        <component :is="item.component" />
      </div>
    </template>
  </div>
</template>
