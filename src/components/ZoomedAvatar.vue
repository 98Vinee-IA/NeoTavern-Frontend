<script setup lang="ts">
import { ref, onMounted } from 'vue';
import type { PropType } from 'vue';
import { useDraggable } from '../composables/useDraggable';
import { useUiStore } from '../stores/ui.store';
import type { ZoomedAvatar } from '../types';

const props = defineProps({
  avatar: {
    type: Object as PropType<ZoomedAvatar>,
    required: true,
  },
});

const uiStore = useUiStore();

const zoomedAvatarEl = ref<HTMLElement | null>(null);
const dragHandleEl = ref<HTMLElement | null>(null);

useDraggable(zoomedAvatarEl, dragHandleEl);

function close() {
  uiStore.removeZoomedAvatar(props.avatar.id);
}

onMounted(() => {
  // TODO: Implement loading/saving of draggable element positions
  // Prevent native image drag which interferes with our custom dragging
  const imgElement = zoomedAvatarEl.value?.querySelector('img');
  if (imgElement) {
    imgElement.addEventListener('dragstart', (e) => e.preventDefault());
  }
});
</script>

<template>
  <div ref="zoomedAvatarEl" class="zoomed-avatar">
    <div class="panel-control-bar">
      <div ref="dragHandleEl" class="fa-fw fa-solid fa-grip drag-grabber"></div>
      <div class="fa-fw fa-solid fa-circle-xmark drag-close" @click="close"></div>
    </div>
    <div class="zoomed-avatar-container">
      <!-- TODO: Implement zoomed_avatar_magnification -->
      <img class="zoomed-avatar-img" :src="avatar.src" :alt="`${avatar.charName} Zoomed Avatar`" />
    </div>
  </div>
</template>
