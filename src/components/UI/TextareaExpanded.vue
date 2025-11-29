<script setup lang="ts">
import { ref } from 'vue';

const props = defineProps<{
  popupId: string;
  value: string;
  label?: string;
}>();

const emit = defineEmits(['update:value']);
const inputValue = ref(props.value);
</script>

<template>
  <div class="expanded-textarea-container">
    <label v-if="label" class="expanded-label">{{ label }}</label>
    <textarea
      v-model="inputValue"
      class="text-pole expanded-textarea"
      rows="25"
      @change="emit('update:value', inputValue)"
    ></textarea>
  </div>
</template>

<style lang="scss">
.expanded-textarea-container {
  display: flex;
  flex-direction: column;
  width: 100%;
}

.expanded-label {
  font-weight: bold;
  margin-bottom: 8px;
}

.expanded-textarea {
  min-height: 500px;
  resize: none !important;
}
</style>
