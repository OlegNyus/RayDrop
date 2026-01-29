import { describe, it, expect } from 'vitest';
import {
  detectCode,
  getLanguageDisplayName,
  getXrayCodeLanguage,
  type CodeLanguage,
} from '../../client/src/utils/codeDetection';

describe('codeDetection', () => {
  describe('detectCode', () => {
    describe('positive cases', () => {
      describe('JSON detection', () => {
        it('detects valid JSON object', () => {
          const result = detectCode('{"key": "value"}');
          expect(result.isCode).toBe(true);
          expect(result.language).toBe('json');
        });

        it('detects valid JSON array', () => {
          const result = detectCode('[1, 2, 3]');
          expect(result.isCode).toBe(true);
          expect(result.language).toBe('json');
        });

        it('detects complex nested JSON', () => {
          const json = JSON.stringify({
            users: [{ id: 1, name: 'John' }],
            meta: { total: 1 },
          });
          const result = detectCode(json);
          expect(result.isCode).toBe(true);
          expect(result.language).toBe('json');
        });

        it('detects JSON with whitespace', () => {
          const result = detectCode('  { "key": "value" }  ');
          expect(result.isCode).toBe(true);
          expect(result.language).toBe('json');
        });

        it('detects multiline JSON', () => {
          const json = `{
            "name": "test",
            "value": 123
          }`;
          const result = detectCode(json);
          expect(result.isCode).toBe(true);
          expect(result.language).toBe('json');
        });
      });

      describe('embedded JSON detection', () => {
        it('detects JSON with prefix text', () => {
          const result = detectCode('Payload: {"key": "value"}');
          expect(result.isCode).toBe(true);
          expect(result.language).toBe('json');
          expect(result.codeBlock).toBe('{"key": "value"}');
          expect(result.prefixText).toBe('Payload:');
        });

        it('detects JSON array with prefix text', () => {
          const result = detectCode('Response: [1, 2, 3]');
          expect(result.isCode).toBe(true);
          expect(result.language).toBe('json');
          expect(result.codeBlock).toBe('[1, 2, 3]');
          expect(result.prefixText).toBe('Response:');
        });

        it('detects JSON with prefix and suffix', () => {
          const result = detectCode('Data: {"id": 1} (required)');
          expect(result.isCode).toBe(true);
          expect(result.language).toBe('json');
          expect(result.codeBlock).toBe('{"id": 1}');
          expect(result.prefixText).toBe('Data:');
          expect(result.suffixText).toBe('(required)');
        });
      });

      describe('TypeScript detection', () => {
        it('detects type annotation with string', () => {
          const result = detectCode('const name: string = "test"');
          expect(result.isCode).toBe(true);
          expect(result.language).toBe('typescript');
        });

        it('detects type annotation with number', () => {
          const result = detectCode('let count: number = 0');
          expect(result.isCode).toBe(true);
          expect(result.language).toBe('typescript');
        });

        it('detects type annotation with boolean', () => {
          const result = detectCode('const isActive: boolean = true');
          expect(result.isCode).toBe(true);
          expect(result.language).toBe('typescript');
        });

        it('detects interface declaration', () => {
          const result = detectCode('interface User { id: number; name: string; }');
          expect(result.isCode).toBe(true);
          expect(result.language).toBe('typescript');
        });

        it('detects type alias', () => {
          const result = detectCode('type Status = "active" | "inactive"');
          expect(result.isCode).toBe(true);
          expect(result.language).toBe('typescript');
        });

        it('detects generic types', () => {
          // Note: '= []' would be detected as embedded JSON, so test with assigned value
          const result = detectCode('function process<T>(items: Array<T>): T');
          expect(result.isCode).toBe(true);
          expect(result.language).toBe('typescript');
        });

        it('detects array type annotation', () => {
          const result = detectCode('const ids: number[] = [1, 2, 3]');
          expect(result.isCode).toBe(true);
          expect(result.language).toBe('typescript');
        });

        it('detects type assertion', () => {
          const result = detectCode('const value = data as string');
          expect(result.isCode).toBe(true);
          expect(result.language).toBe('typescript');
        });

        it('detects optional property', () => {
          const result = detectCode('interface Props { name?: string }');
          expect(result.isCode).toBe(true);
          expect(result.language).toBe('typescript');
        });
      });

      describe('JavaScript detection', () => {
        it('detects const declaration', () => {
          const result = detectCode('const x = 5');
          expect(result.isCode).toBe(true);
          expect(result.language).toBe('javascript');
        });

        it('detects let declaration', () => {
          const result = detectCode('let name = "test"');
          expect(result.isCode).toBe(true);
          expect(result.language).toBe('javascript');
        });

        it('detects var declaration', () => {
          const result = detectCode('var count = 0');
          expect(result.isCode).toBe(true);
          expect(result.language).toBe('javascript');
        });

        it('detects function declaration', () => {
          const result = detectCode('function greet(name) { return "Hello " + name; }');
          expect(result.isCode).toBe(true);
          expect(result.language).toBe('javascript');
        });

        it('detects arrow function', () => {
          const result = detectCode('const add = (a, b) => { return a + b; }');
          expect(result.isCode).toBe(true);
          expect(result.language).toBe('javascript');
        });

        it('detects export statement', () => {
          // Note: '{}' would be detected as embedded JSON, so test without braces
          const result = detectCode('export default myFunction');
          expect(result.isCode).toBe(true);
          expect(result.language).toBe('javascript');
        });

        it('detects import statement', () => {
          const result = detectCode('import React from "react"');
          expect(result.isCode).toBe(true);
          expect(result.language).toBe('javascript');
        });

        it('detects class declaration', () => {
          // Note: '{}' would be detected as embedded JSON, so test class with body
          const result = detectCode('class MyComponent extends React.Component');
          expect(result.isCode).toBe(true);
          expect(result.language).toBe('javascript');
        });

        it('detects async function', () => {
          // Note: '{}' would be detected as embedded JSON, so test without braces
          const result = detectCode('async function fetchData()');
          expect(result.isCode).toBe(true);
          expect(result.language).toBe('javascript');
        });

        it('detects await expression', () => {
          const result = detectCode('const data = await fetch(url)');
          expect(result.isCode).toBe(true);
          expect(result.language).toBe('javascript');
        });

        it('detects return statement', () => {
          const result = detectCode('return result');
          expect(result.isCode).toBe(true);
          expect(result.language).toBe('javascript');
        });

        it('detects if statement', () => {
          const result = detectCode('if (condition) { doSomething(); }');
          expect(result.isCode).toBe(true);
          expect(result.language).toBe('javascript');
        });

        it('detects for loop', () => {
          const result = detectCode('for (let i = 0; i < 10; i++) { console.log(i); }');
          expect(result.isCode).toBe(true);
          expect(result.language).toBe('javascript');
        });

        it('detects while loop', () => {
          const result = detectCode('while (running) { process(); }');
          expect(result.isCode).toBe(true);
          expect(result.language).toBe('javascript');
        });

        it('detects try-catch', () => {
          const result = detectCode('try { riskyOperation(); } catch (e) { handleError(e); }');
          expect(result.isCode).toBe(true);
          expect(result.language).toBe('javascript');
        });

        it('detects method call', () => {
          const result = detectCode('array.map(x => x * 2)');
          expect(result.isCode).toBe(true);
          expect(result.language).toBe('javascript');
        });

        it('detects console.log', () => {
          const result = detectCode('console.log("debug")');
          expect(result.isCode).toBe(true);
          expect(result.language).toBe('javascript');
        });

        it('detects document access', () => {
          const result = detectCode('document.getElementById("root")');
          expect(result.isCode).toBe(true);
          expect(result.language).toBe('javascript');
        });

        it('detects constructor call', () => {
          const result = detectCode('const date = new Date()');
          expect(result.isCode).toBe(true);
          expect(result.language).toBe('javascript');
        });
      });
    });

    describe('negative cases', () => {
      it('returns plain for empty string', () => {
        const result = detectCode('');
        expect(result.isCode).toBe(false);
        expect(result.language).toBe('plain');
      });

      it('returns plain for whitespace only', () => {
        const result = detectCode('   \n\t  ');
        expect(result.isCode).toBe(false);
        expect(result.language).toBe('plain');
      });

      it('returns plain for simple text', () => {
        const result = detectCode('Hello world');
        expect(result.isCode).toBe(false);
        expect(result.language).toBe('plain');
      });

      it('returns plain for sentence with punctuation', () => {
        const result = detectCode('This is a test. It should work!');
        expect(result.isCode).toBe(false);
        expect(result.language).toBe('plain');
      });

      it('returns plain for invalid JSON with curly braces', () => {
        const result = detectCode('{invalid json}');
        expect(result.isCode).toBe(false);
        expect(result.language).toBe('plain');
      });

      it('returns plain for text with colons (not code)', () => {
        const result = detectCode('Name: John, Age: 30');
        expect(result.isCode).toBe(false);
        expect(result.language).toBe('plain');
      });

      it('returns plain for natural language with technical terms', () => {
        const result = detectCode('The user should click the button');
        expect(result.isCode).toBe(false);
        expect(result.language).toBe('plain');
      });

      it('handles null gracefully', () => {
        const result = detectCode(null as unknown as string);
        expect(result.isCode).toBe(false);
        expect(result.language).toBe('plain');
      });

      it('handles undefined gracefully', () => {
        const result = detectCode(undefined as unknown as string);
        expect(result.isCode).toBe(false);
        expect(result.language).toBe('plain');
      });
    });

    describe('edge cases', () => {
      it('prioritizes JSON over JavaScript for valid JSON', () => {
        // This could be parsed as JS object literal, but should be detected as JSON
        const result = detectCode('{"name": "test"}');
        expect(result.language).toBe('json');
      });

      it('prioritizes TypeScript over JavaScript when type annotations present', () => {
        const result = detectCode('const x: number = 5');
        expect(result.language).toBe('typescript');
      });

      it('does not detect embedded JSON without prefix', () => {
        // Pure JSON without prefix should not have codeBlock/prefixText
        const result = detectCode('{"key": "value"}');
        expect(result.isCode).toBe(true);
        expect(result.codeBlock).toBeUndefined();
        expect(result.prefixText).toBeUndefined();
      });
    });
  });

  describe('getLanguageDisplayName', () => {
    it('returns "JSON" for json', () => {
      expect(getLanguageDisplayName('json')).toBe('JSON');
    });

    it('returns "JavaScript" for javascript', () => {
      expect(getLanguageDisplayName('javascript')).toBe('JavaScript');
    });

    it('returns "TypeScript" for typescript', () => {
      expect(getLanguageDisplayName('typescript')).toBe('TypeScript');
    });

    it('returns "Plain Text" for plain', () => {
      expect(getLanguageDisplayName('plain')).toBe('Plain Text');
    });
  });

  describe('getXrayCodeLanguage', () => {
    it('returns "json" for json', () => {
      expect(getXrayCodeLanguage('json')).toBe('json');
    });

    it('returns "javascript" for javascript', () => {
      expect(getXrayCodeLanguage('javascript')).toBe('javascript');
    });

    it('returns "typescript" for typescript', () => {
      expect(getXrayCodeLanguage('typescript')).toBe('typescript');
    });

    it('returns "none" for plain', () => {
      expect(getXrayCodeLanguage('plain')).toBe('none');
    });
  });
});
