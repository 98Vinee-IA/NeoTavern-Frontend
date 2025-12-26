import { JSDOM } from 'jsdom';
import { beforeAll, describe, expect, test } from 'vitest';
import { formatText } from '../src/utils/chat';

describe('Chat Utils', () => {
  beforeAll(() => {
    if (typeof global.DOMParser === 'undefined') {
      const jsdom = new JSDOM('');
      global.DOMParser = jsdom.window.DOMParser;
      global.document = jsdom.window.document;
      global.Node = jsdom.window.Node;
      global.window = jsdom.window as unknown as Window & typeof globalThis;
    }
  });

  describe('formatText', () => {
    test('renders images when external media is allowed', () => {
      const input = '![alt text](https://example.com/image.png)';
      const result = formatText(input, false);
      // formatText scopes html, so look for img tag inside
      expect(result).toContain('<img');
      expect(result).toContain('src="https://example.com/image.png"');
    });

    test('removes images when external media is forbidden', () => {
      const input = '![alt text](https://example.com/image.png)';
      const result = formatText(input, true);
      expect(result).not.toContain('<img');
      expect(result).not.toContain('src="https://example.com/image.png"');
    });

    test('allows regular text', () => {
      const input = 'Hello world';
      const result = formatText(input, true);
      expect(result).toContain('Hello world');
    });

    test('sanitizes scripts regardless of setting', () => {
      const input = '<script>alert("xss")</script>Hello';
      const resultAllowed = formatText(input, false);
      const resultForbidden = formatText(input, true);

      expect(resultAllowed).not.toContain('<script');
      expect(resultForbidden).not.toContain('<script');
    });

    test('removes audio/video when forbidden', () => {
      const input = '<video src="movie.mp4"></video>';
      const result = formatText(input, true);
      expect(result).not.toContain('<video');
    });

    test('Should preserve complex HTML structure (div wrapper) without Markdown interference', () => {
      const input = `
      <div class="card">
          <div class="header">
              Title
          </div>
          <div class="content">
              Body text
          </div>
      </div>`;

      const result = formatText(input, true);

      expect(result).toContain('<div class="card">');
      expect(result).toContain('<div class="header">');
      // Should NOT contain Markdown code blocks (pre/code) which happen if indentation is misinterpreted
      expect(result).not.toContain('<pre>');
    });

    test('Should preserve <style> tags and apply scoping', () => {
      // Use unique color to verify existence
      const cssProp = 'color: #ff0099';
      const input = `
        <div class="styled-component">
            <style>
                .styled-component { ${cssProp}; background: #000; }
                .styled-component:hover { opacity: 0.8; }
            </style>
            <p>Styled Text</p>
        </div>`;

      const result = formatText(input, true);

      // 1. Check style tag exists
      expect(result).toContain('<style>');

      // 2. Check CSS content is preserved (specifically the property)
      expect(result).toContain(cssProp);

      // 3. Check HTML structure
      expect(result).toContain('<div class="styled-component">');

      // 4. Ensure no code blocks formed around the style
      expect(result).not.toContain('<pre><code');
    });

    test('Should preserve arbitrary wrappers (e.g. span)', () => {
      const input = `<span class="custom-badge"> <strong>Status:</strong> Active </span>`;
      const result = formatText(input, true);

      expect(result).toContain('<span class="custom-badge">');
      expect(result).toContain('<strong>Status:</strong>');
    });

    test('Should preserve complex CSS features like @keyframes', () => {
      const input = `<div class="animation-container">
    <style>
        .animation-container {
            animation: pulse 2s infinite;
        }
        @keyframes pulse {
            0% { transform: scale(1); opacity: 0.5; }
            50% { transform: scale(1.1); opacity: 1; }
            100% { transform: scale(1); opacity: 0.5; }
        }
    </style>
    <div class="content">Animated Content</div>
</div>`;

      const result = formatText(input, true);

      // Verify structure matches input (root div preserved)
      expect(result).toContain('<div class="animation-container">');

      // Verify style tag exists
      expect(result).toContain('<style>');

      // Verify @keyframes content was not stripped by sanitizer
      expect(result).toContain('@keyframes pulse');
      expect(result).toContain('transform: scale(1.1)');
    });
  });
});
