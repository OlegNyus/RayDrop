export type CodeLanguage = 'json' | 'javascript' | 'typescript' | 'plain';

interface CodeDetectionResult {
  isCode: boolean;
  language: CodeLanguage;
  /** If code is embedded in text, this contains the extracted code */
  codeBlock?: string;
  /** Text before the code block */
  prefixText?: string;
  /** Text after the code block */
  suffixText?: string;
}

/**
 * Detects if the given text contains code and identifies the language.
 * Supports JSON, JavaScript, and TypeScript detection.
 * Can detect code blocks embedded within text.
 */
export function detectCode(text: string): CodeDetectionResult {
  if (!text || text.trim().length === 0) {
    return { isCode: false, language: 'plain' };
  }

  const trimmed = text.trim();

  // Try pure JSON detection first (most specific)
  if (isPureJSON(trimmed)) {
    return { isCode: true, language: 'json' };
  }

  // Try to find embedded JSON in text
  const embeddedJSON = findEmbeddedJSON(text);
  if (embeddedJSON) {
    return {
      isCode: true,
      language: 'json',
      codeBlock: embeddedJSON.code,
      prefixText: embeddedJSON.prefix,
      suffixText: embeddedJSON.suffix,
    };
  }

  // Try to find embedded JS/TS code with prefix text
  const embeddedJS = findEmbeddedJS(text);
  if (embeddedJS) {
    const lang = isTypeScript(embeddedJS.code) ? 'typescript' : 'javascript';
    return {
      isCode: true,
      language: lang,
      codeBlock: embeddedJS.code,
      prefixText: embeddedJS.prefix,
      suffixText: embeddedJS.suffix,
    };
  }

  // Check for TypeScript (before JS since TS is a superset)
  if (isTypeScript(trimmed)) {
    return { isCode: true, language: 'typescript' };
  }

  // Check for JavaScript
  if (isJavaScript(trimmed)) {
    return { isCode: true, language: 'javascript' };
  }

  return { isCode: false, language: 'plain' };
}

/**
 * Checks if text is purely valid JSON (starts with { or [)
 */
function isPureJSON(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    return false;
  }

  try {
    JSON.parse(trimmed);
    return true;
  } catch {
    return false;
  }
}

/**
 * Finds embedded JSON object or array in text
 * Returns the JSON block and surrounding text
 */
function findEmbeddedJSON(text: string): { code: string; prefix: string; suffix: string } | null {
  // Look for JSON object
  const objectMatch = text.match(/^([\s\S]*?)(\{[\s\S]*\})([\s\S]*)$/);
  if (objectMatch) {
    const [, prefix, potentialJSON, suffix] = objectMatch;
    // Only consider it embedded if there's prefix text
    if (prefix.trim()) {
      try {
        JSON.parse(potentialJSON);
        return { code: potentialJSON, prefix: prefix.trim(), suffix: suffix.trim() };
      } catch {
        // Not valid JSON, continue
      }
    }
  }

  // Look for JSON array
  const arrayMatch = text.match(/^([\s\S]*?)(\[[\s\S]*\])([\s\S]*)$/);
  if (arrayMatch) {
    const [, prefix, potentialJSON, suffix] = arrayMatch;
    if (prefix.trim()) {
      try {
        JSON.parse(potentialJSON);
        return { code: potentialJSON, prefix: prefix.trim(), suffix: suffix.trim() };
      } catch {
        // Not valid JSON
      }
    }
  }

  return null;
}

/**
 * Finds embedded JavaScript/TypeScript code in text
 * Returns the code block and surrounding text
 */
function findEmbeddedJS(text: string): { code: string; prefix: string; suffix: string } | null {
  // Patterns that indicate the start of JS/TS code (at beginning of line)
  const codeStartPatterns = [
    /^(const|let|var)\s+\w+/m,           // Variable declaration
    /^function\s+\w*\s*\(/m,              // Function declaration
    /^(async\s+)?function/m,              // Async function
    /^(export|import)\s+/m,               // Module statements
    /^class\s+\w+/m,                      // Class declaration
    /^interface\s+\w+/m,                  // Interface declaration
    /^type\s+\w+\s*=/m,                   // Type alias
    /^\/\//m,                             // Comment start
    /^\/\*/m,                             // Block comment start
    /^if\s*\(/m,                          // If statement
    /^for\s*\(/m,                         // For loop
    /^while\s*\(/m,                       // While loop
    /^try\s*\{/m,                         // Try block
    /^return\s+/m,                        // Return statement
    /^await\s+/m,                         // Await expression
    /^\w+\s*\(/m,                         // Function call at line start
  ];

  // Find the earliest match position
  let earliestMatch: { index: number; pattern: RegExp } | null = null;

  for (const pattern of codeStartPatterns) {
    const match = text.match(pattern);
    if (match && match.index !== undefined) {
      if (!earliestMatch || match.index < earliestMatch.index) {
        earliestMatch = { index: match.index, pattern };
      }
    }
  }

  if (!earliestMatch || earliestMatch.index === 0) {
    // No prefix text found, or code starts at beginning
    return null;
  }

  const prefix = text.slice(0, earliestMatch.index).trim();
  const codeAndSuffix = text.slice(earliestMatch.index);

  // Only consider it embedded if there's meaningful prefix text
  // and it doesn't look like code itself
  if (!prefix || isJavaScript(prefix) || isTypeScript(prefix)) {
    return null;
  }

  // Check if the remaining text is actually code
  if (!isJavaScript(codeAndSuffix) && !isTypeScript(codeAndSuffix)) {
    return null;
  }

  return { code: codeAndSuffix.trim(), prefix, suffix: '' };
}

/**
 * Checks if text looks like TypeScript code
 */
function isTypeScript(text: string): boolean {
  // TypeScript-specific patterns
  const tsPatterns = [
    /:\s*(string|number|boolean|any|void|never|unknown)\b/,  // Type annotations
    /interface\s+\w+/,                                        // interface declaration
    /type\s+\w+\s*=/,                                         // type alias
    /<\w+>/,                                                  // Generic types
    /:\s*\w+\[\]/,                                            // Array type annotation
    /as\s+(string|number|boolean|any|\w+)/,                   // Type assertion
    /\?\s*:/,                                                 // Optional property
  ];

  return tsPatterns.some(pattern => pattern.test(text));
}

/**
 * Checks if text looks like JavaScript code
 */
function isJavaScript(text: string): boolean {
  const jsPatterns = [
    /\b(const|let|var)\s+\w+\s*=/,           // Variable declaration
    /\bfunction\s+\w*\s*\(/,                  // Function declaration
    /=>\s*[{\(]/,                             // Arrow function
    /\bexport\s+(default\s+)?/,               // Export statement
    /\bimport\s+.*\s+from\s+/,                // Import statement
    /\bclass\s+\w+/,                          // Class declaration
    /\basync\s+(function|\()/,                // Async function
    /\bawait\s+/,                             // Await expression
    /\breturn\s+/,                            // Return statement
    /\bif\s*\(.*\)\s*{/,                      // If statement
    /\bfor\s*\(.*\)\s*{/,                     // For loop
    /\bwhile\s*\(.*\)\s*{/,                   // While loop
    /\btry\s*{/,                              // Try block
    /\bcatch\s*\(/,                           // Catch block
    /\.\w+\s*\(/,                             // Method call
    /console\.(log|error|warn)/,              // Console methods
    /document\.|window\./,                    // DOM/BOM
    /\bnew\s+\w+\s*\(/,                       // Constructor call
  ];

  // Check if at least 2 patterns match for better accuracy
  const matchCount = jsPatterns.filter(pattern => pattern.test(text)).length;
  return matchCount >= 1;
}

/**
 * Returns the display name for a language
 */
export function getLanguageDisplayName(language: CodeLanguage): string {
  const names: Record<CodeLanguage, string> = {
    json: 'JSON',
    javascript: 'JavaScript',
    typescript: 'TypeScript',
    plain: 'Plain Text',
  };
  return names[language];
}

/**
 * Returns the Xray wiki code format language identifier
 */
export function getXrayCodeLanguage(language: CodeLanguage): string {
  const xrayLangs: Record<CodeLanguage, string> = {
    json: 'json',
    javascript: 'javascript',
    typescript: 'typescript',
    plain: 'none',
  };
  return xrayLangs[language];
}
