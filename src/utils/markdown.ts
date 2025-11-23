import { Marked, type TokenizerAndRendererExtension } from 'marked';
import DOMPurify, { type Config } from 'dompurify';
import type { ChatMessage } from '../types';

const marked = new Marked({
  async: false,
  gfm: true, // GitHub Flavored Markdown (Tables, Strikethrough, Tasklists)
  breaks: true, // Convert \n to <br>
  pedantic: false,
});

const renderer = {
  link({ href, title, text }: { href: string; title?: string | null; text: string }): string {
    const titleAttr = title ? ` title="${title}"` : '';
    return `<a href="${href}"${titleAttr} target="_blank" rel="noopener noreferrer">${text}</a>`;
  },
  // TODO: Implement custom image handling if we need '![alt](url =100x100)' syntax support
  // Showdown supported parsing dimensions from the URL/alt text, whereas standard Markdown does not.
};

/**
 * Custom Tokenizer to safely style text inside double quotes (Dialogue)
 * It runs as a Marked extension, ensuring it doesn't break HTML attributes or Link titles.
 */
const dialogueExtension: TokenizerAndRendererExtension = {
  name: 'dialogue',
  level: 'inline',
  // Hint to Marked: start checking for this token when you see a double quote
  start(src: string) {
    return src.indexOf('"');
  },
  tokenizer(src: string) {
    // Match a double quote, followed by non-quotes (non-greedy), followed by a double quote.
    // We use [^"]* to allow the quote to span multiple lines (unlike the original dot . regex),
    // which is generally an improvement for roleplay text.
    const rule = /^"([^"]*?)"/;
    const match = rule.exec(src);

    if (match) {
      return {
        type: 'dialogue',
        raw: match[0], // The full string to consume: "Content"
        text: match[0], // The text to display
        // We parse the content *inside* the quotes (match[1]) so bold/italic works inside dialogue.
        tokens: this.lexer.inlineTokens(match[1]),
      };
    }
    return undefined;
  },
  renderer(token) {
    // Wrap the parsed inner tokens in quotes and the <q> tag.
    // Using this.parser.parseInline ensures inner markdown (like *emphasis*) is rendered.
    return `<q>"${this.parser.parseInline(token.tokens || [])}"</q>`;
  },
};

marked.use({
  renderer,
  extensions: [dialogueExtension],
});

/**
 * Formats a raw string with Markdown and sanitizes it.
 * @param text The raw string to format.
 * @param options Formatting options.
 * @returns An HTML string.
 */
export function formatText(text: string): string {
  if (!text) return '';
  const rawHtml = marked.parse(text) as string;

  const config: Config = {
    RETURN_DOM: false,
    RETURN_DOM_FRAGMENT: false,
    ADD_TAGS: ['custom-style', 'q'], // Allow <q> for quotes
    ADD_ATTR: ['target'], // openLinksInNewWindow
  };

  return DOMPurify.sanitize(rawHtml, config);
}

/**
 * A wrapper for `formatText` that specifically handles a ChatMessage object,
 * accounting for properties like `display_text`.
 * @param message The ChatMessage object.
 * @returns An HTML string.
 */
export function formatMessage(message: ChatMessage): string {
  const textToFormat = message?.extra?.display_text || message.mes;
  return formatText(textToFormat);
}

/**
 * A wrapper for `formatText` that specifically handles the reasoning part of a ChatMessage,
 * accounting for `reasoning_display_text`.
 * @param message The ChatMessage object.
 * @returns An HTML string.
 */
export function formatReasoning(message: ChatMessage): string {
  if (!message.extra?.reasoning) return '';
  const textToFormat = message.extra.reasoning_display_text || message.extra.reasoning;
  return formatText(textToFormat);
}
