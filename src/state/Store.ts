// state/Store.ts
import { atom } from 'nanostores';

export const token = atom<string | null>(null);
