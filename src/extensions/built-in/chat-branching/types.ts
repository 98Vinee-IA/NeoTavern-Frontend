import type { ExtensionAPI } from '../../../types';

export interface BranchNode {
  id: string; // The filename (without extension)
  parentId: string | null; // Filename of the parent
  branchPointIndex: number; // The message index where the split happened
  children: string[]; // List of child filenames
  timestamp: number;
}

export interface BranchingSettings {
  graph: Record<string, BranchNode>;
}

export type ChatBranchingAPI = ExtensionAPI<BranchingSettings>;
