import { useMemo } from 'react';
import { detectCode, getLanguageDisplayName, type CodeLanguage } from '../../utils/codeDetection';

interface CodeBlockProps {
  code: string;
  onCopy?: () => void;
}

export function CodeBlock({ code, onCopy }: CodeBlockProps) {
  const detection = useMemo(() => detectCode(code), [code]);
  const { isCode, language, codeBlock, prefixText, suffixText } = detection;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    onCopy?.();
  };

  if (!isCode) {
    return null;
  }

  // Determine what code to display - either the extracted block or the full code
  const displayCode = codeBlock || code;

  return (
    <div className="space-y-2">
      {/* Prefix text (if embedded code) */}
      {prefixText && (
        <p className="text-sm text-text-primary font-medium">{prefixText}</p>
      )}

      {/* Code block */}
      <div className="rounded-lg border border-border overflow-hidden bg-[#1e1e1e]">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-1.5 bg-[#2d2d2d] border-b border-border">
          <span className="text-xs font-medium text-[#9cdcfe]">
            {getLanguageDisplayName(language)}
          </span>
          <button
            type="button"
            onClick={handleCopy}
            className="p-1 rounded hover:bg-[#3d3d3d] text-[#808080] hover:text-[#cccccc] transition-colors"
            title="Copy code"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </button>
        </div>

        {/* Code Content */}
        <div className="p-3 overflow-x-auto">
          <pre className="text-sm font-mono leading-relaxed">
            <HighlightedCode code={displayCode} language={language} />
          </pre>
        </div>
      </div>

      {/* Suffix text (if embedded code) */}
      {suffixText && (
        <p className="text-sm text-text-secondary">{suffixText}</p>
      )}
    </div>
  );
}

interface HighlightedCodeProps {
  code: string;
  language: CodeLanguage;
}

function HighlightedCode({ code, language }: HighlightedCodeProps) {
  const highlighted = useMemo(() => {
    if (language === 'json') {
      return highlightJSON(code);
    } else if (language === 'javascript' || language === 'typescript') {
      return highlightJS(code);
    }
    return escapeHtml(code);
  }, [code, language]);

  return <code dangerouslySetInnerHTML={{ __html: highlighted }} />;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function highlightJSON(code: string): string {
  // Escape HTML first
  let escaped = escapeHtml(code);

  // Highlight strings (property names and values)
  escaped = escaped.replace(
    /(&quot;[^&]*&quot;)\s*:/g,
    '<span style="color: #9cdcfe">$1</span>:'
  );
  escaped = escaped.replace(
    /:\s*(&quot;[^&]*&quot;)/g,
    ': <span style="color: #ce9178">$1</span>'
  );

  // Highlight numbers
  escaped = escaped.replace(
    /:\s*(-?\d+\.?\d*)/g,
    ': <span style="color: #b5cea8">$1</span>'
  );

  // Highlight booleans and null
  escaped = escaped.replace(
    /:\s*(true|false|null)\b/g,
    ': <span style="color: #569cd6">$1</span>'
  );

  // Highlight brackets and braces
  escaped = escaped.replace(
    /([{}\[\]])/g,
    '<span style="color: #ffd700">$1</span>'
  );

  return escaped;
}

function highlightJS(code: string): string {
  let escaped = escapeHtml(code);

  // Keywords
  const keywords = [
    'const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while',
    'do', 'switch', 'case', 'break', 'continue', 'try', 'catch', 'finally',
    'throw', 'new', 'class', 'extends', 'import', 'export', 'default', 'from',
    'async', 'await', 'yield', 'typeof', 'instanceof', 'in', 'of', 'delete',
    'void', 'this', 'super', 'static', 'get', 'set'
  ];

  // TypeScript keywords
  const tsKeywords = [
    'interface', 'type', 'enum', 'namespace', 'module', 'declare', 'readonly',
    'private', 'protected', 'public', 'abstract', 'implements', 'as', 'is',
    'keyof', 'infer', 'never', 'unknown'
  ];

  // Types
  const types = ['string', 'number', 'boolean', 'any', 'void', 'null', 'undefined', 'object', 'symbol', 'bigint'];

  // Boolean/null literals
  escaped = escaped.replace(
    /\b(true|false|null|undefined)\b/g,
    '<span style="color: #569cd6">$1</span>'
  );

  // Numbers
  escaped = escaped.replace(
    /\b(\d+\.?\d*)\b/g,
    '<span style="color: #b5cea8">$1</span>'
  );

  // Strings (single and double quotes)
  escaped = escaped.replace(
    /(&#039;[^&#]*&#039;|&quot;[^&]*&quot;)/g,
    '<span style="color: #ce9178">$1</span>'
  );

  // Template literals (backticks) - simplified
  escaped = escaped.replace(
    /(`[^`]*`)/g,
    '<span style="color: #ce9178">$1</span>'
  );

  // Keywords
  const keywordPattern = new RegExp(`\\b(${[...keywords, ...tsKeywords].join('|')})\\b`, 'g');
  escaped = escaped.replace(
    keywordPattern,
    '<span style="color: #c586c0">$1</span>'
  );

  // Types
  const typePattern = new RegExp(`:\\s*(${types.join('|')})\\b`, 'g');
  escaped = escaped.replace(
    typePattern,
    ': <span style="color: #4ec9b0">$1</span>'
  );

  // Function names (before parentheses)
  escaped = escaped.replace(
    /\b([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g,
    '<span style="color: #dcdcaa">$1</span>('
  );

  // Comments (single line)
  escaped = escaped.replace(
    /(\/\/.*$)/gm,
    '<span style="color: #6a9955">$1</span>'
  );

  // Arrow functions
  escaped = escaped.replace(
    /(=&gt;)/g,
    '<span style="color: #569cd6">$1</span>'
  );

  return escaped;
}
