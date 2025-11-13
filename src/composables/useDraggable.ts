import { ref, onMounted, onUnmounted, type Ref } from 'vue';

export function useDraggable(target: Ref<HTMLElement | null>, handle: Ref<HTMLElement | null>) {
  const isDragging = ref(false);
  let pos1 = 0,
    pos2 = 0,
    pos3 = 0,
    pos4 = 0;

  const onMouseDown = (e: MouseEvent) => {
    e.preventDefault();
    isDragging.value = true;
    pos3 = e.clientX;
    pos4 = e.clientY;
    document.onmouseup = onMouseUp;
    document.onmousemove = onMouseMove;
  };

  const onMouseUp = () => {
    isDragging.value = false;
    document.onmouseup = null;
    document.onmousemove = null;
  };

  const onMouseMove = (e: MouseEvent) => {
    e.preventDefault();
    if (!target.value) return;

    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;

    target.value.style.top = `${target.value.offsetTop - pos2}px`;
    target.value.style.left = `${target.value.offsetLeft - pos1}px`;
  };

  onMounted(() => {
    if (handle.value) {
      handle.value.addEventListener('mousedown', onMouseDown);
    }
  });

  onUnmounted(() => {
    if (handle.value) {
      handle.value.removeEventListener('mousedown', onMouseDown);
    }
    // Clean up global listeners if component is unmounted while dragging
    document.onmouseup = null;
    document.onmousemove = null;
  });

  return { isDragging };
}
