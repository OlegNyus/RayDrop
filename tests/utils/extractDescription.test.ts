// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { extractDescription } from '../../server/src/utils/xrayClient';

describe('extractDescription', () => {
  describe('TC-ExtDesc-U001: falsy inputs return empty string', () => {
    it('returns empty string for null', () => {
      expect(extractDescription(null)).toBe('');
    });

    it('returns empty string for undefined', () => {
      expect(extractDescription(undefined)).toBe('');
    });

    it('returns empty string for empty string', () => {
      expect(extractDescription('')).toBe('');
    });

    it('returns empty string for 0', () => {
      expect(extractDescription(0)).toBe('');
    });
  });

  describe('TC-ExtDesc-U002: plain string input returned as-is', () => {
    it('returns a simple string as-is', () => {
      expect(extractDescription('Hello world')).toBe('Hello world');
    });

    it('returns a multiline string as-is', () => {
      expect(extractDescription('Line 1\nLine 2')).toBe('Line 1\nLine 2');
    });

    it('returns a string with special characters as-is', () => {
      expect(extractDescription('<b>bold</b> & "quoted"')).toBe('<b>bold</b> & "quoted"');
    });
  });

  describe('TC-ExtDesc-U003: ADF single paragraph', () => {
    it('extracts text from a single-paragraph ADF document', () => {
      const adf = {
        type: 'doc',
        version: 1,
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'Simple description' },
            ],
          },
        ],
      };
      expect(extractDescription(adf)).toBe('Simple description');
    });
  });

  describe('TC-ExtDesc-U004: ADF multi-paragraph', () => {
    it('extracts text from multiple paragraphs joined by newlines', () => {
      const adf = {
        type: 'doc',
        version: 1,
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'First paragraph' }],
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Second paragraph' }],
          },
        ],
      };
      expect(extractDescription(adf)).toBe('First paragraph\nSecond paragraph');
    });
  });

  describe('TC-ExtDesc-U005: ADF with inline formatting', () => {
    it('extracts text from paragraph with multiple inline nodes (bold, italic)', () => {
      const adf = {
        type: 'doc',
        version: 1,
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'Normal ' },
              { type: 'text', text: 'bold', marks: [{ type: 'strong' }] },
              { type: 'text', text: ' text' },
            ],
          },
        ],
      };
      expect(extractDescription(adf)).toBe('Normal bold text');
    });
  });

  describe('TC-ExtDesc-U006: ADF with nested content (bullet list)', () => {
    it('extracts text from nested list items', () => {
      const adf = {
        type: 'doc',
        version: 1,
        content: [
          {
            type: 'bulletList',
            content: [
              {
                type: 'listItem',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'Item 1' }],
                  },
                ],
              },
              {
                type: 'listItem',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'Item 2' }],
                  },
                ],
              },
            ],
          },
        ],
      };
      expect(extractDescription(adf)).toBe('Item 1Item 2');
    });
  });

  describe('TC-ExtDesc-U007: ADF empty document', () => {
    it('returns empty string for ADF doc with empty content array', () => {
      const adf = {
        type: 'doc',
        version: 1,
        content: [],
      };
      expect(extractDescription(adf)).toBe('');
    });

    it('returns empty string for ADF doc with paragraph but no text', () => {
      const adf = {
        type: 'doc',
        version: 1,
        content: [
          {
            type: 'paragraph',
            content: [],
          },
        ],
      };
      expect(extractDescription(adf)).toBe('');
    });
  });

  describe('TC-ExtDesc-U008: ADF object without content property', () => {
    it('returns empty string for object with no content array', () => {
      const adf = { type: 'doc', version: 1 };
      expect(extractDescription(adf)).toBe('');
    });
  });

  describe('TC-ExtDesc-U009: non-standard truthy values', () => {
    it('converts a number to string', () => {
      expect(extractDescription(42)).toBe('42');
    });

    it('converts a boolean to string', () => {
      expect(extractDescription(true)).toBe('true');
    });

    it('handles an array (no content property) gracefully', () => {
      expect(extractDescription(['a', 'b'])).toBe('');
    });
  });

  describe('TC-ExtDesc-U010: ADF with mixed block types (heading + paragraph)', () => {
    it('extracts text from heading and paragraph blocks', () => {
      const adf = {
        type: 'doc',
        version: 1,
        content: [
          {
            type: 'heading',
            attrs: { level: 1 },
            content: [{ type: 'text', text: 'Title' }],
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Body text' }],
          },
        ],
      };
      expect(extractDescription(adf)).toBe('Title\nBody text');
    });
  });
});
