# Visual Lorebook - Keyword Matching Algorithm Improvements

## Overview

Improve the keyword matching algorithm in the Visual Lorebook extension by:

1. Limiting to the last 3 chat entries instead of 5
2. Ignoring text inside `<...>` tags
3. Ignoring text inside comments like `<!-- -->` or `<memo></memo>` tags

## Current Implementation Analysis

### Files Involved

- [`src/extensions/built-in/visual-lorebook/VisualLorebookPanel.vue`](src/extensions/built-in/visual-lorebook/VisualLorebookPanel.vue) - Main panel component with keyword matching logic
- [`src/extensions/built-in/visual-lorebook/types.ts`](src/extensions/built-in/visual-lorebook/types.ts) - Settings and type definitions

### Current Keyword Matching Logic

1. **activeEntries computed property** (lines 72-108):
   - Uses `activeCharacterLookback` setting (default: 5)
   - Gets recent messages: `chatStore.activeChat?.messages.slice(-lookback)`
   - Matches keywords against `message.mes.toLowerCase()`

2. **findMatchingVisualKeywords function** (lines 182-212):
   - Scans message text for keyword matches
   - Uses `text.includes(trimmedKeyword.toLowerCase())`

### Current Issues

- No filtering of HTML-like tags (`<...>`)
- No filtering of comment blocks (`<!-- -->`)
- No filtering of memo tags (`<memo></memo>`)
- Default lookback of 5 may be too many messages

## Proposed Changes

### 1. Text Cleaning Utility Function

Create a new helper function to clean message text before keyword matching:

```typescript
/**
 * Clean message text by removing unwanted content for keyword matching
 * - Removes text inside <...> tags (angle brackets)
 * - Removes text inside <!-- --> comments
 * - Removes text inside <memo></memo> tags
 */
function cleanMessageText(text: string): string {
  let cleaned = text;

  // Remove HTML comments <!-- ... -->
  cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, '');

  // Remove memo tags <memo>...</memo>
  cleaned = cleaned.replace(/<memo>[\s\S]*?<\/memo>/gi, '');

  // Remove any remaining tags with angle brackets <...>
  cleaned = cleaned.replace(/<[^>]*>/g, '');

  return cleaned;
}
```

### 2. Update activeEntries Computed Property

Modify the message text processing in the `activeEntries` computed property:

**Before:**

```typescript
const messageText = message.mes.toLowerCase();
```

**After:**

```typescript
const messageText = cleanMessageText(message.mes).toLowerCase();
```

### 3. Update findMatchingVisualKeywords Function

Modify the text processing in the `findMatchingVisualKeywords` function:

**Before:**

```typescript
const text = messageText.toLowerCase();
```

**After:**

```typescript
const text = cleanMessageText(messageText).toLowerCase();
```

### 4. Change Default activeCharacterLookback

Update the default setting in [`types.ts`](src/extensions/built-in/visual-lorebook/types.ts):

**Before:**

```typescript
activeCharacterLookback: 5,
```

**After:**

```typescript
activeCharacterLookback: 3,
```

## Implementation Steps

1. Add `cleanMessageText` utility function to [`VisualLorebookPanel.vue`](src/extensions/built-in/visual-lorebook/VisualLorebookPanel.vue)
2. Update `activeEntries` computed property to use `cleanMessageText`
3. Update `findMatchingVisualKeywords` function to use `cleanMessageText`
4. Change default `activeCharacterLookback` from 5 to 3 in [`types.ts`](src/extensions/built-in/visual-lorebook/types.ts)

## Testing Considerations

- Test with messages containing various tag formats:
  - `<tag>content</tag>`
  - `<self-closing-tag />`
  - `<!-- comment -->`
  - `<memo>memo content</memo>`
  - Mixed content with and without tags
- Verify keyword matching works correctly after text cleaning
- Verify only the last 3 messages are considered when filtering active entries

## Edge Cases to Consider

- Nested tags (e.g., `<outer><inner>content</inner></outer>`)
- Malformed tags (e.g., `<tag without closing`)
- Empty messages after cleaning
- Case sensitivity of memo tags (handled with `gi` flag)
- Unicode characters in message text
