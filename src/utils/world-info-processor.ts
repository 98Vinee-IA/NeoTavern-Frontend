import { WorldInfoLogic, WorldInfoPosition } from '../constants';
import {
  type ChatMessage,
  type Character,
  type WorldInfoBook,
  type WorldInfoEntry,
  type WorldInfoSettings,
  type Persona,
  type ProcessedWorldInfo,
  type WorldInfoOptions,
  type Tokenizer,
} from '../types';
import { eventEmitter } from './event-emitter';

// TODO: These should be sourced from a central place or settings
const MAX_SCAN_DEPTH = 1000;

interface ProcessingEntry extends WorldInfoEntry {
  world: string;
}

// TODO: A simplified substitution, a full implementation would be more robust
function substituteParams(text: string, char: Character, user: string): string {
  if (!text) return '';
  return text.replace(/{{char}}/g, char.name).replace(/{{user}}/g, user);
}

// --- WorldInfoBuffer Class ---
// Manages the text content (chat history, descriptions) to be scanned.
class WorldInfoBuffer {
  #depthBuffer: string[] = [];
  #recurseBuffer: string[] = [];
  #settings: WorldInfoSettings;
  // @ts-expect-error unused
  #characters: Character[];
  #character: Character;
  #persona: Persona;

  #cachedFullString: string | null = null;
  #cachedRecursionString: string | null = null;

  constructor(chat: ChatMessage[], settings: WorldInfoSettings, characters: Character[], persona: Persona) {
    this.#settings = settings;
    this.#characters = characters;
    this.#character = characters[0]; // Assuming first character for now.
    this.#persona = persona;
    this.#initDepthBuffer(chat);
  }

  #initDepthBuffer(chat: ChatMessage[]) {
    // We only need the message content, reversed (most recent first)
    this.#depthBuffer = chat
      .map((msg) => msg.mes)
      .reverse()
      .slice(0, MAX_SCAN_DEPTH);
  }

  #transformString(str: string, entry: WorldInfoEntry): string {
    const caseSensitive = entry.caseSensitive ?? this.#settings.caseSensitive;
    return caseSensitive ? str : str.toLowerCase();
  }

  // Gets the full text to be scanned for a given entry
  get(entry: WorldInfoEntry): string {
    const depth = entry.scanDepth ?? this.#settings.depth;

    // If this entry's depth matches default, use cached version of history
    // Otherwise construct specific slice.
    let buffer = '';

    if (depth === this.#settings.depth && this.#cachedFullString !== null) {
      buffer = this.#cachedFullString;
    } else {
      // Build base buffer
      buffer = this.#depthBuffer.slice(0, depth).join('\n');

      if (entry.matchCharacterDescription) buffer += `\n${this.#character.description ?? ''}`;
      if (entry.matchCharacterPersonality) buffer += `\n${this.#character.personality ?? ''}`;
      if (entry.matchCharacterDepthPrompt) buffer += `\n${this.#character.data?.depth_prompt?.prompt ?? ''}`;
      if (entry.matchCreatorNotes) buffer += `\n${this.#character.data?.creator_notes ?? ''}`;
      if (entry.matchScenario) buffer += `\n${this.#character.scenario ?? ''}`;
      if (entry.matchPersonaDescription) buffer += `\n${this.#persona.description ?? ''}`;

      // Cache it if it's using default depth for future calls in this loop
      if (depth === this.#settings.depth) {
        this.#cachedFullString = buffer;
      }
    }

    if (this.#recurseBuffer.length > 0) {
      // Optimization: Cache the recursion string join
      if (!this.#cachedRecursionString) {
        this.#cachedRecursionString = this.#recurseBuffer.join('\n');
      }
      buffer += `\n${this.#cachedRecursionString}`;
    }

    return buffer;
  }

  // Checks if a given keyword (needle) exists in the buffer (haystack)
  matchKeys(haystack: string, needle: string, entry: WorldInfoEntry): boolean {
    // Check for regex pattern like /pattern/flags
    const regexMatch = needle.match(/^\/(.+)\/([a-z]*)$/);

    if (regexMatch) {
      try {
        const pattern = regexMatch[1];
        const flags = regexMatch[2];
        const regex = new RegExp(pattern, flags);
        return regex.test(haystack);
      } catch (e) {
        console.warn(`Invalid regex in World Info entry: ${needle}`, e);
        return false;
      }
    }

    const transformedHaystack = this.#transformString(haystack, entry);
    const transformedNeedle = this.#transformString(needle, entry);
    const matchWholeWords = entry.matchWholeWords ?? this.#settings.matchWholeWords;

    if (matchWholeWords) {
      // Simple whole word match for single words
      // Escape special regex characters in the needle to prevent accidental regex matching in the fallback
      const escapedNeedle = transformedNeedle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escapedNeedle}\\b`);
      return regex.test(transformedHaystack);
    }
    return transformedHaystack.includes(transformedNeedle);
  }

  addRecurse(message: string) {
    this.#recurseBuffer.push(message);
    this.#cachedRecursionString = null; // Invalidate cache
  }
}

// --- Main Processor ---
export class WorldInfoProcessor {
  public chat: ChatMessage[];
  public characters: Character[];
  public character: Character;
  public settings: WorldInfoSettings;
  public maxContext: number;
  public books: WorldInfoBook[];
  public persona: Persona;
  public tokenizer: Tokenizer;

  constructor({ chat, characters, settings, books, maxContext, persona, tokenizer }: WorldInfoOptions) {
    this.chat = chat;
    this.characters = characters;
    this.character = characters[0]; // Assuming first character for now
    this.settings = settings;
    this.books = books;
    this.persona = persona;
    this.maxContext = maxContext;
    this.tokenizer = tokenizer;
  }

  public async process(): Promise<ProcessedWorldInfo> {
    const options: WorldInfoOptions = {
      chat: this.chat,
      characters: this.characters,
      settings: this.settings,
      books: this.books,
      persona: this.persona,
      maxContext: this.maxContext,
      tokenizer: this.tokenizer,
    };
    await eventEmitter.emit('world-info:processing-started', options);

    const buffer = new WorldInfoBuffer(this.chat, this.settings, this.characters, this.persona);
    const allActivatedEntries = new Set<ProcessingEntry>();
    let continueScanning = true;
    let loopCount = 0;
    let tokenBudgetOverflowed = false;

    let budget = Math.round((this.settings.budget * this.maxContext) / 100) || 1;
    if (this.settings.budgetCap > 0 && budget > this.settings.budgetCap) {
      budget = this.settings.budgetCap;
    }

    const allEntries: ProcessingEntry[] = this.books.flatMap((book) =>
      book.entries.map((entry) => ({ ...entry, world: book.name })),
    );
    const sortedEntries = allEntries.sort((a, b) => (a.order ?? 100) - (b.order ?? 100));

    // TODO: Implement TimedEffects for sticky/cooldown
    // TODO: Implement Min Activations logic more fully with skew

    while (continueScanning && loopCount < (this.settings.maxRecursionSteps || 10) && sortedEntries.length > 0) {
      loopCount++;
      const activatedInThisLoop = new Set<ProcessingEntry>();
      let newContentForRecursion = '';
      let currentUsedBudget = 0;

      for (const entry of sortedEntries) {
        if (allActivatedEntries.has(entry) || entry.disable) continue;

        // TODO: Add all filters: character, tags, timed effects etc.

        if (entry.constant) {
          activatedInThisLoop.add(entry);
          continue;
        }

        if (!entry.key || entry.key.length === 0) continue;

        const textToScan = buffer.get(entry);
        if (!textToScan) continue;

        const hasPrimaryKeyMatch = entry.key.some((key) => {
          const subbedKey = substituteParams(key, this.character, this.persona.name);
          return subbedKey && buffer.matchKeys(textToScan, subbedKey, entry);
        });

        if (hasPrimaryKeyMatch) {
          const hasSecondary = entry.keysecondary && entry.keysecondary.length > 0;
          if (!hasSecondary) {
            activatedInThisLoop.add(entry);
            continue;
          }

          // Handle secondary key logic
          let hasAnySecondaryMatch = false;
          let hasAllSecondaryMatch = true;
          for (const key of entry.keysecondary) {
            const subbedKey = substituteParams(key, this.character, this.persona.name);
            if (subbedKey && buffer.matchKeys(textToScan, subbedKey, entry)) {
              hasAnySecondaryMatch = true;
            } else {
              hasAllSecondaryMatch = false;
            }
          }

          let secondaryLogicPassed = false;
          switch (entry.selectiveLogic as WorldInfoLogic) {
            case WorldInfoLogic.AND_ANY:
              secondaryLogicPassed = hasAnySecondaryMatch;
              break;
            case WorldInfoLogic.AND_ALL:
              secondaryLogicPassed = hasAllSecondaryMatch;
              break;
            case WorldInfoLogic.NOT_ALL:
              secondaryLogicPassed = !hasAllSecondaryMatch;
              break;
            case WorldInfoLogic.NOT_ANY:
              secondaryLogicPassed = !hasAnySecondaryMatch;
              break;
          }

          if (secondaryLogicPassed) {
            activatedInThisLoop.add(entry);
          }
        }
      }

      // TODO: Filter by inclusion groups

      if (activatedInThisLoop.size > 0) {
        const candidates: { entry: ProcessingEntry; content: string; rawContent: string }[] = [];

        for (const entry of activatedInThisLoop) {
          if (tokenBudgetOverflowed && !entry.ignoreBudget) continue;

          // Probability Check
          const roll = Math.random() * 100;
          if (entry.useProbability && roll > entry.probability) {
            continue;
          }

          const substitutedContent = substituteParams(entry.content, this.character, this.persona.name);
          const contentForBudget = `\n${substitutedContent}`;

          candidates.push({ entry, content: contentForBudget, rawContent: substitutedContent });
        }

        if (candidates.length > 0) {
          const tokenCounts = await Promise.all(candidates.map((c) => this.tokenizer.getTokenCount(c.content)));

          for (let i = 0; i < candidates.length; i++) {
            const { entry, rawContent } = candidates[i];
            const entryTokens = tokenCounts[i];

            if (!entry.ignoreBudget && currentUsedBudget + entryTokens > budget) {
              tokenBudgetOverflowed = true;
              continue;
            }

            currentUsedBudget += entryTokens;

            allActivatedEntries.add(entry);
            await eventEmitter.emit('world-info:entry-activated', entry);

            if (this.settings.recursive && !entry.preventRecursion) {
              newContentForRecursion += `\n${rawContent}`;
            }
          }
        }

        if (newContentForRecursion) {
          buffer.addRecurse(newContentForRecursion);
          continueScanning = true;
        } else {
          continueScanning = false;
        }
      } else {
        continueScanning = false;
      }
    }

    // Build the final prompt strings
    const result: ProcessedWorldInfo = {
      worldInfoBefore: '',
      worldInfoAfter: '',
      anBefore: [],
      anAfter: [],
      emBefore: [],
      emAfter: [],
      depthEntries: [],
      outletEntries: {},
      triggeredEntries: {},
    };

    const finalEntries = Array.from(allActivatedEntries).sort((a, b) => (a.order ?? 100) - (b.order ?? 100));

    for (const entry of finalEntries) {
      if (!result.triggeredEntries[entry.world]) {
        result.triggeredEntries[entry.world] = [];
      }
      result.triggeredEntries[entry.world].push(entry);

      const content = substituteParams(entry.content, this.character, this.persona.name);
      if (!content) continue;

      switch (entry.position) {
        case WorldInfoPosition.BEFORE_CHAR:
          result.worldInfoBefore += `${content}\n`;
          break;
        case WorldInfoPosition.AFTER_CHAR:
          result.worldInfoAfter += `${content}\n`;
          break;
        case WorldInfoPosition.BEFORE_AN:
          result.anBefore.push(content);
          break;
        case WorldInfoPosition.AFTER_AN:
          result.anAfter.push(content);
          break;
        case WorldInfoPosition.BEFORE_EM:
          result.emBefore.push(content);
          break;
        case WorldInfoPosition.AFTER_EM:
          result.emAfter.push(content);
          break;
        case WorldInfoPosition.AT_DEPTH:
          // TODO: Implement role mapping
          result.depthEntries.push({ depth: entry.depth, role: 'system', entries: [content] });
          break;
        case WorldInfoPosition.OUTLET:
          if (entry.outletName) {
            if (!result.outletEntries[entry.outletName]) {
              result.outletEntries[entry.outletName] = [];
            }
            result.outletEntries[entry.outletName].push(content);
          }
          break;
      }
    }

    result.worldInfoBefore = result.worldInfoBefore.trim();
    result.worldInfoAfter = result.worldInfoAfter.trim();

    await eventEmitter.emit('world-info:processing-finished', result);
    return result;
  }
}
