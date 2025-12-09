<script setup lang="ts">
import { ref, watch } from 'vue';
import CodeMirrorEditor from './CodeMirrorEditor.vue';

const props = withDefaults(
  defineProps<{
    popupId?: string;
    value: string;
    label?: string;
    codeMirror?: boolean;
  }>(),
  {
    popupId: undefined,
    label: undefined,
    codeMirror: false,
  },
);

const emit = defineEmits(['update:value']);
const inputValue = ref(props.value);

watch(
  () => props.value,
  (newVal) => {
    inputValue.value = newVal;
  },
);

function updateValue(val: string) {
  inputValue.value = val;
  emit('update:value', val);
}
</script>

<template>
  <div class="expanded-textarea-container" :class="{ 'is-codemirror': codeMirror }">
    <label v-if="label" class="expanded-label">{{ label }}</label>

    <div v-if="codeMirror" class="expanded-codemirror-wrapper">
      <CodeMirrorEditor
        :model-value="inputValue"
        autofocus
        min-height="500px"
        max-height="calc(80vh - 100px)"
        @update:model-value="updateValue"
      />
    </div>

    <textarea
      v-else
      v-model="inputValue"
      class="text-pole expanded-textarea"
      rows="25"
      @change="emit('update:value', inputValue)"
    ></textarea>
  </div>
</template>

<style scoped>
.expanded-textarea-container {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
}

.expanded-label {
  font-weight: bold;
  margin-bottom: var(--spacing-sm);
  flex-shrink: 0;
}

.expanded-textarea {
  min-height: 500px;
  resize: none !important;
}

.expanded-codemirror-wrapper {
  flex-grow: 1;
  min-height: 500px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
</style>
