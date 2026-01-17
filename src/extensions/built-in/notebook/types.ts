export interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: number;
}

export interface NotebookSettings {
  notes: Note[];
  activeNoteId: string | null;
  isPaneCollapsed: boolean;
}
