<script setup lang="ts" generic="T">
import { nextTick, ref } from 'vue';

const props = defineProps<{
  items: T[];
  /**
   * Unique key is critical for drag/drop.
   * Do not use index if possible.
   */
  itemKey?: keyof T;
  handleClass?: string;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:items', items: T[]): void;
  (e: 'reorder', payload: { from: number; to: number }): void;
}>();

const draggedIndex = ref<number | null>(null);
const dropTargetIndex = ref<number | null>(null);
const dropPosition = ref<'top' | 'bottom' | null>(null);

// State to track if we are currently hovering over a valid handle
const isHoveringHandle = ref(false);

function checkHandleHover(event: MouseEvent) {
  if (!props.handleClass) return;

  const target = event.target as HTMLElement;

  if (target.closest(`.${props.handleClass}`)) {
    isHoveringHandle.value = true;
  } else {
    isHoveringHandle.value = false;
  }
}

function onMouseLeave() {
  if (props.handleClass) isHoveringHandle.value = false;
}

// Helper to determine if the item is draggable
// If handleClass is set, we only allow drag if hovering handle
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function isDraggable(_index: number) {
  if (props.disabled) return false;
  if (!props.handleClass) return true;
  return isHoveringHandle.value;
}

function onDragStart(event: DragEvent, index: number) {
  if (props.disabled) {
    event.preventDefault();
    return;
  }

  // Set the index
  draggedIndex.value = index;

  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.dropEffect = 'move';
    event.dataTransfer.setData('text/plain', index.toString());
  }

  // This ensures the "ghost" is opaque, but the item in the list turns transparent
  nextTick(() => {
    const target = event.target as HTMLElement;
    target.classList.add('is-dragging-active');
  });
}

function onDragOver(event: DragEvent, index: number) {
  // Always prevent default to allow dropping
  event.preventDefault();

  if (draggedIndex.value === null || draggedIndex.value === index) {
    // If we drag over ourselves, clear indicators to reduce visual noise
    dropTargetIndex.value = null;
    dropPosition.value = null;
    return;
  }

  const target = event.currentTarget as HTMLElement;
  const rect = target.getBoundingClientRect();
  const midY = rect.top + rect.height / 2;

  // Determine zone
  const position = event.clientY < midY ? 'top' : 'bottom';

  dropTargetIndex.value = index;
  dropPosition.value = position;

  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move';
  }
}

// Handle dropping on the specific item
function onDrop(event: DragEvent, targetIndex: number) {
  event.preventDefault();
  finishDrag(targetIndex);
}

// Cleanup logic
function onDragEnd(event: DragEvent) {
  const target = event.target as HTMLElement;
  target.classList.remove('is-dragging-active');

  // If drop happened outside a valid target, just reset
  resetState();
}

// Handle logic for when dragging over the container gap
function onContainerDragOver(event: DragEvent) {
  event.preventDefault(); // Essential to allow "snap back" animation if drop fails
}

function finishDrag(targetIndex: number) {
  const sourceIndex = draggedIndex.value;

  if (sourceIndex === null || sourceIndex === targetIndex || dropPosition.value === null) {
    resetState();
    return;
  }

  let newIndex = targetIndex;

  // Calculate index based on visual position
  if (dropPosition.value === 'bottom') {
    newIndex = targetIndex + 1;
  }

  // Adjust index because removing the item changes subsequent indices
  // Example: Move [0] to after [2]. Target [2] bottom -> Index 3.
  // But [0] is removed, so effectively it becomes Index 2.
  if (newIndex > sourceIndex) {
    newIndex = newIndex - 1;
  }

  if (sourceIndex !== newIndex) {
    const newItems = [...props.items];
    const [item] = newItems.splice(sourceIndex, 1);
    newItems.splice(newIndex, 0, item);

    emit('reorder', { from: sourceIndex, to: newIndex });
    emit('update:items', newItems);
  }

  resetState();
}

function resetState() {
  draggedIndex.value = null;
  dropTargetIndex.value = null;
  dropPosition.value = null;
}
</script>

<template>
  <div class="draggable-list" @dragover="onContainerDragOver">
    <div
      v-for="(item, index) in items"
      :key="itemKey ? String(item[itemKey]) : index"
      class="draggable-item-wrapper"
      :class="{
        'is-dragging': draggedIndex === index,
        'drop-target-top': dropTargetIndex === index && dropPosition === 'top',
        'drop-target-bottom': dropTargetIndex === index && dropPosition === 'bottom',
      }"
      :draggable="isDraggable(index)"
      @dragstart="onDragStart($event, index)"
      @dragover="onDragOver($event, index)"
      @drop="onDrop($event, index)"
      @dragend="onDragEnd"
    >
      <!-- 
         Wrap slot in a container to easily bind handle events 
         if the user puts the handle inside the slot 
      -->
      <div class="item-content" @mouseover="checkHandleHover" @mouseout="onMouseLeave">
        <slot :item="item" :index="index"></slot>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.draggable-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-block: 4px;
}

.draggable-item-wrapper {
  position: relative;
  border-radius: var(--base-border-radius, 2px);
  // Using translate instead of default layout helps performance
  will-change: transform, opacity;

  // Default cursor behavior
  cursor: default;

  // If we are draggable (and no specific handle class is set), show grab cursor
  &[draggable='true'] {
    cursor: grab;
  }

  &.is-dragging-active {
    opacity: 0.4;
    background: #f9f9f9;
    cursor: grabbing;
  }

  &::before,
  &::after {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    height: 2px;
    background-color: var(--theme-quote-color, #e18a24);
    display: none;
    pointer-events: none;
    z-index: 10;
    border-radius: 2px;
  }

  &.drop-target-top::before {
    display: block;
    top: -4px;
  }

  &.drop-target-bottom::after {
    display: block;
    bottom: -4px;
  }
}

/* 
   Handle Logic: 
   If props.handleClass is passed, we expect the parent to style it.
   However, we ensure that hovering that class triggers the correct cursor.
*/
:deep(.draggable-handle) {
  cursor: grab;
}
:deep(.draggable-handle:active) {
  cursor: grabbing;
}
</style>
