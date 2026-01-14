import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { ToolDefinition } from '../types/tools';
import { eventEmitter } from '../utils/extensions';

export const useToolStore = defineStore('tool', () => {
  const tools = ref<Map<string, ToolDefinition>>(new Map());

  const toolList = computed(() => Array.from(tools.value.values()));

  async function registerTool(tool: ToolDefinition) {
    if (tools.value.has(tool.name)) {
      console.warn(`[ToolStore] Overwriting existing tool: ${tool.name}`);
    }
    tools.value.set(tool.name, tool);
    await eventEmitter.emit('tool:registered', tool);
  }

  async function unregisterTool(name: string) {
    if (tools.value.delete(name)) {
      await eventEmitter.emit('tool:unregistered', name);
    }
  }

  function getTool(name: string): ToolDefinition | undefined {
    return tools.value.get(name);
  }

  return {
    tools,
    toolList,
    registerTool,
    unregisterTool,
    getTool,
  };
});
