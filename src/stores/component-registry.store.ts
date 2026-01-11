import { defineStore } from 'pinia';
import { markRaw, ref, type Component } from 'vue';
import type { NavBarItemDefinition, SidebarDefinition } from '../types';
import type { TextareaToolDefinition } from '../types/ExtensionAPI';
import type { CodeMirrorTarget } from '../types/settings';

export interface ChatSettingsTabDefinition {
  id: string;
  title: string;
  component: Component;
}

interface RegexToolRegistration {
  regex: RegExp;
  tools: TextareaToolDefinition[];
}

export const useComponentRegistryStore = defineStore('component-registry', () => {
  const leftSidebarRegistry = ref<Map<string, SidebarDefinition>>(new Map());
  const rightSidebarRegistry = ref<Map<string, SidebarDefinition>>(new Map());
  const navBarRegistry = ref<Map<string, NavBarItemDefinition>>(new Map());

  // Exact match registry
  const textareaToolRegistry = ref<Map<string, TextareaToolDefinition[]>>(new Map());
  // Regex match registry
  const textareaToolRegexRegistry = ref<RegexToolRegistration[]>([]);

  const chatSettingsTabRegistry = ref<Map<string, ChatSettingsTabDefinition>>(new Map());

  function registerSidebar(id: string, definition: Omit<SidebarDefinition, 'id'>, side: 'left' | 'right') {
    const rawComponent = markRaw(definition.component);
    const registry = side === 'left' ? leftSidebarRegistry : rightSidebarRegistry;
    const layoutId = side === 'right' ? (definition.layoutId ?? 'chat') : definition.layoutId;
    registry.value.set(id, { ...definition, component: rawComponent, layoutId, id });
  }

  function unregisterSidebar(id: string, side: 'left' | 'right') {
    const registry = side === 'left' ? leftSidebarRegistry : rightSidebarRegistry;
    registry.value.delete(id);
  }

  function registerNavBarItem(id: string, definition: Omit<NavBarItemDefinition, 'id'>) {
    navBarRegistry.value.set(id, {
      ...definition,
      component: definition.component ? markRaw(definition.component) : undefined,
      layoutComponent: definition.layoutComponent ? markRaw(definition.layoutComponent) : undefined,
      id,
    });
  }

  function unregisterNavBarItem(id: string) {
    navBarRegistry.value.delete(id);
  }

  function registerTextareaTool(identifier: CodeMirrorTarget | string | RegExp, definition: TextareaToolDefinition) {
    if (identifier instanceof RegExp) {
      // Handle Regex registration
      const existingEntry = textareaToolRegexRegistry.value.find((entry) => {
        return entry.regex.toString() === identifier.toString();
      });

      if (existingEntry) {
        // Prevent duplicates by ID
        const exists = existingEntry.tools.find((t) => t.id === definition.id);
        if (exists) return;
        existingEntry.tools.push(definition);
      } else {
        textareaToolRegexRegistry.value.push({
          regex: identifier,
          tools: [definition],
        });
      }
    } else {
      // Handle Exact String registration
      const list = textareaToolRegistry.value.get(identifier) || [];
      // Prevent duplicates by ID
      const exists = list.find((t) => t.id === definition.id);
      if (exists) return;
      list.push(definition);
      textareaToolRegistry.value.set(identifier, list);
    }
  }

  function unregisterTextareaTool(identifier: CodeMirrorTarget | string | RegExp, toolId: string) {
    if (identifier instanceof RegExp) {
      const entryIndex = textareaToolRegexRegistry.value.findIndex(
        (entry) => entry.regex.toString() === identifier.toString(),
      );
      if (entryIndex === -1) return;

      const entry = textareaToolRegexRegistry.value[entryIndex];
      const newTools = entry.tools.filter((t) => t.id !== toolId);

      if (newTools.length === 0) {
        textareaToolRegexRegistry.value.splice(entryIndex, 1);
      } else {
        entry.tools = newTools;
      }
    } else {
      const list = textareaToolRegistry.value.get(identifier);
      if (!list) return;
      const newList = list.filter((t) => t.id !== toolId);
      if (newList.length === 0) {
        textareaToolRegistry.value.delete(identifier);
      } else {
        textareaToolRegistry.value.set(identifier, newList);
      }
    }
  }

  function getTextareaTools(identifier: string): TextareaToolDefinition[] {
    const exactTools = textareaToolRegistry.value.get(identifier) || [];

    // Collect tools from all matching regexes
    const regexTools = textareaToolRegexRegistry.value
      .filter((entry) => entry.regex.test(identifier))
      .flatMap((entry) => entry.tools);

    // Combine and deduplicate by ID
    const allTools = [...exactTools, ...regexTools];
    const uniqueTools = new Map<string, TextareaToolDefinition>();

    for (const tool of allTools) {
      if (!uniqueTools.has(tool.id)) {
        uniqueTools.set(tool.id, tool);
      }
    }

    return Array.from(uniqueTools.values());
  }

  function registerChatSettingsTab(id: string, title: string, component: Component) {
    chatSettingsTabRegistry.value.set(id, {
      id,
      title,
      component: markRaw(component),
    });
  }

  function unregisterChatSettingsTab(id: string) {
    chatSettingsTabRegistry.value.delete(id);
  }

  return {
    leftSidebarRegistry,
    rightSidebarRegistry,
    navBarRegistry,
    textareaToolRegistry,
    textareaToolRegexRegistry,
    chatSettingsTabRegistry,
    registerSidebar,
    unregisterSidebar,
    registerNavBarItem,
    unregisterNavBarItem,
    registerTextareaTool,
    unregisterTextareaTool,
    getTextareaTools,
    registerChatSettingsTab,
    unregisterChatSettingsTab,
    getNavBarItem: (id: string) => navBarRegistry.value.get(id),
  };
});
