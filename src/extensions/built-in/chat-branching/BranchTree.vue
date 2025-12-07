<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import type { ChatInfo } from '../../../types/chat';
import type { BranchNode } from './types';

const props = defineProps<{
  graph: Record<string, BranchNode>;
  chatInfoMap: Record<string, ChatInfo>;
  activeId: string | null;
}>();

const emit = defineEmits<{
  (e: 'select', id: string): void;
}>();

const containerRef = ref<HTMLElement | null>(null);

// Layout constants
const NODE_WIDTH = 220;
const NODE_HEIGHT = 80; // Compact height
const GAP_X = 60;
const GAP_Y = 20;

interface VisualNode extends BranchNode {
  x: number;
  y: number;
}

// Transform the graph into a tree structure for layout
const treeData = computed(() => {
  const nodes: Record<string, VisualNode> = {};
  const rootIds = new Set<string>();

  // 1. Identify relationships and initialize visual nodes
  for (const id in props.graph) {
    nodes[id] = { ...props.graph[id], x: 0, y: 0 };
    if (!nodes[id].parentId || !props.graph[nodes[id].parentId]) {
      rootIds.add(id);
    }
  }

  // 2. Perform layout (Simple Hierarchy)
  const processNode = (id: string, depth: number, yCounter: { val: number }) => {
    const node = nodes[id];
    if (!node) return;

    node.x = depth * (NODE_WIDTH + GAP_X);

    // Sort children by timestamp to keep chronological order
    const children = (node.children || [])
      .filter((childId) => nodes[childId])
      .sort((a, b) => (nodes[a]?.timestamp || 0) - (nodes[b]?.timestamp || 0));

    if (children.length === 0) {
      node.y = yCounter.val * (NODE_HEIGHT + GAP_Y);
      yCounter.val++;
    } else {
      let firstChildY = -1;
      let lastChildY = -1;

      children.forEach((childId, index) => {
        processNode(childId, depth + 1, yCounter);
        if (index === 0) firstChildY = nodes[childId].y;
        if (index === children.length - 1) lastChildY = nodes[childId].y;
      });

      node.y = (firstChildY + lastChildY) / 2;
    }
  };

  let globalY = { val: 0 };

  Array.from(rootIds).forEach((rootId) => {
    processNode(rootId, 0, globalY);
    globalY.val += 1; // Extra spacing between unconnected trees
  });

  return nodes;
});

const links = computed(() => {
  const result: { d: string; targetId: string }[] = [];
  const nodes = treeData.value;

  Object.values(nodes).forEach((node) => {
    if (node.parentId && nodes[node.parentId]) {
      const parent = nodes[node.parentId];
      // Draw smooth bezier curve
      const startX = parent.x + NODE_WIDTH;
      const startY = parent.y + NODE_HEIGHT / 2;
      const endX = node.x;
      const endY = node.y + NODE_HEIGHT / 2;

      const cp1X = startX + (endX - startX) / 2;
      const cp2X = endX - (endX - startX) / 2;

      const d = `M ${startX} ${startY} C ${cp1X} ${startY}, ${cp2X} ${endY}, ${endX} ${endY}`;
      result.push({ d, targetId: node.id });
    }
  });
  return result;
});

const canvasSize = computed(() => {
  let maxX = 0;
  let maxY = 0;
  Object.values(treeData.value).forEach((n) => {
    maxX = Math.max(maxX, n.x + NODE_WIDTH);
    maxY = Math.max(maxY, n.y + NODE_HEIGHT);
  });
  return { width: maxX + 100, height: maxY + 100 };
});

const centerActiveNode = () => {
  if (!containerRef.value || !props.activeId) return;
  const activeNode = treeData.value[props.activeId];
  if (!activeNode) return;

  const container = containerRef.value;
  const x = activeNode.x;
  const y = activeNode.y;

  container.scrollTo({
    left: x - container.clientWidth / 2 + NODE_WIDTH / 2,
    top: y - container.clientHeight / 2 + NODE_HEIGHT / 2,
    behavior: 'smooth',
  });
};

const formatDate = (ts: number) => {
  if (!ts) return '';
  return new Date(ts).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const getChatName = (id: string) => {
  return props.chatInfoMap[id]?.chat_metadata?.name || id;
};

const getMessageCount = (id: string) => {
  return props.chatInfoMap[id]?.chat_items ?? '?';
};

onMounted(() => {
  nextTick(centerActiveNode);
});

watch(
  () => props.activeId,
  () => {
    nextTick(centerActiveNode);
  },
);
</script>

<template>
  <div ref="containerRef" class="branch-tree-container">
    <svg :width="canvasSize.width" :height="canvasSize.height">
      <!-- Links -->
      <path v-for="link in links" :key="link.targetId" :d="link.d" class="tree-link" />

      <!-- Nodes -->
      <g
        v-for="node in treeData"
        :key="node.id"
        class="tree-node-group"
        :transform="`translate(${node.x}, ${node.y})`"
        @click="emit('select', node.id)"
      >
        <foreignObject :width="NODE_WIDTH" :height="NODE_HEIGHT">
          <div class="branch-card" :class="{ active: node.id === activeId }">
            <div class="card-header" :title="getChatName(node.id)">
              {{ getChatName(node.id) }}
            </div>

            <div class="card-meta">
              <!-- Branch Point Info -->
              <div
                class="meta-pill"
                :title="node.parentId ? 'Branched at message #' + node.branchPointIndex : 'Root Chat'"
              >
                <i class="fa-solid fa-code-branch" :class="{ 'is-root': !node.parentId }"></i>
                <span>{{ node.parentId ? `#${node.branchPointIndex}` : 'Root' }}</span>
              </div>

              <!-- Messages Count -->
              <div class="meta-pill" title="Total Messages">
                <i class="fa-regular fa-comments"></i>
                <span>{{ getMessageCount(node.id) }}</span>
              </div>

              <!-- Timestamp -->
              <div class="meta-text" :title="'Created: ' + new Date(node.timestamp).toLocaleString()">
                <i class="fa-regular fa-clock"></i>
                <span>{{ formatDate(node.timestamp) }}</span>
              </div>
            </div>
          </div>
        </foreignObject>
      </g>
    </svg>
  </div>
</template>

<style scoped>
.branch-tree-container {
  width: 100%;
  height: 100%;
  overflow: auto;
  position: relative;
  background-color: var(--theme-background-tint);

  background-image: radial-gradient(var(--white-20a) 1px, transparent 1px);
  background-size: 24px 24px;
}

svg {
  display: block;
}

.tree-link {
  fill: none;
  stroke: var(--theme-emphasis-color);
  stroke-width: 2px;
  opacity: 0.4;
}

.tree-node-group {
  cursor: pointer;
}

.tree-node-group:hover .branch-card {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px var(--theme-shadow-color);
  border-color: var(--theme-emphasis-color);
}

.branch-card {
  width: calc(100% - 4px); /* Margin for stroke */
  height: calc(100% - 4px);
  margin: 2px;
  box-sizing: border-box;

  background-color: var(--theme-bot-message-tint);
  border: 1px solid var(--theme-border-color);
  border-radius: var(--base-border-radius-rounded);

  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 10px;

  transition: all var(--animation-duration-sm) ease;
  color: var(--theme-text-color);
  font-family: var(--font-family-main);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.branch-card.active {
  background-color: var(--theme-user-message-tint);
  border: 2px solid var(--theme-underline-color);
  box-shadow: 0 0 10px rgba(var(--theme-checkbox-bg-r), var(--theme-checkbox-bg-g), var(--theme-checkbox-bg-b), 0.2);
}

.card-header {
  font-weight: 600;
  font-size: 0.95em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 4px;
}

.card-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.75em;
  color: var(--theme-emphasis-color);
}

.meta-pill {
  display: flex;
  align-items: center;
  gap: 4px;
  background-color: var(--white-20a);
  padding: 2px 6px;
  border-radius: 10px;
  font-family: var(--font-family-mono);
}

.meta-text {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: auto; /* Push date to right */
  opacity: 0.8;
}

.branch-card.active .card-meta {
  color: var(--theme-text-color);
}

.fa-code-branch.is-root {
  color: var(--color-accent-green);
}

i {
  font-size: 0.9em;
}
</style>
