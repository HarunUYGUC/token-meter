/**
 * Token Meter Constants & Model Definitions
 */

export interface ModelMetadata {
  id: string;
  name: string;
  family: 'anthropic' | 'openai' | 'google' | 'deepseek';
  contextLimit: number;
  description: string;
  vocabSize: string;
  badgeColor: string;
}

export const SUPPORTED_MODELS: Record<string, ModelMetadata> = {
  'claude-3-7-sonnet': {
    id: 'claude-3-7-sonnet',
    name: 'Anthropic Claude',
    family: 'anthropic',
    contextLimit: 200000,
    description: 'Anthropic Claude BPE Tokenizer (200k window)',
    vocabSize: '~65k - 100k',
    badgeColor: '#d97706' // Amber
  },
  'gpt-4o': {
    id: 'gpt-4o',
    name: 'OpenAI (GPT / o-Series)',
    family: 'openai',
    contextLimit: 128000,
    description: 'OpenAI o200k Tokenizer (128k - 200k window)',
    vocabSize: '200k',
    badgeColor: '#10b981' // Emerald
  },
  'gemini-2-flash': {
    id: 'gemini-2-flash',
    name: 'Google Gemini',
    family: 'google',
    contextLimit: 1000000,
    description: 'Google SentencePiece 256k Tokenizer (1M - 2M window)',
    vocabSize: '256k',
    badgeColor: '#3b82f6' // Blue
  },
  'deepseek-v3': {
    id: 'deepseek-v3',
    name: 'DeepSeek / Llama',
    family: 'deepseek',
    contextLimit: 128000,
    description: 'DeepSeek & Meta Llama 128k BPE Tokenizer',
    vocabSize: '128k',
    badgeColor: '#8b5cf6' // Purple
  }
};

export const DEFAULT_MODEL_ID = 'claude-3-7-sonnet';

/**
 * Common AI Rule file patterns across popular AI coding tools
 */
export const AI_RULE_PATTERNS = [
  '**/.cursorrules',
  '**/.cursor/rules/**',
  '**/.windsurfrules',
  '**/.clinerules',
  '**/.clinerules/**',
  '**/.roomodes',
  '**/.gemini/rules/**',
  '**/GEMINI.md',
  '**/INSTRUCTIONS.md',
  '**/AGENTS.md',
  '**/.github/copilot-instructions.md',
  '**/.prompt.md',
  '**/.prompts/**'
];

/**
 * Default patterns to ignore when scanning workspace
 */
export const DEFAULT_EXCLUDES = [
  '**/node_modules/**',
  '**/.git/**',
  '**/.svn/**',
  '**/.hg/**',
  '**/dist/**',
  '**/build/**',
  '**/out/**',
  '**/.next/**',
  '**/.nuxt/**',
  '**/.cache/**',
  '**/coverage/**',
  '**/.vscode-test/**',
  '**/*.min.js',
  '**/*.min.css',
  '**/*.map',
  '**/*.lock',
  '**/package-lock.json',
  '**/yarn.lock',
  '**/pnpm-lock.yaml',
  '**/bun.lockb',
  '**/*.vsix'
];

/**
 * Binary file extensions to skip tokenization
 */
export const BINARY_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'ico', 'svgz', 'bmp', 'tiff', 'psd', 'ai',
  'zip', 'tar', 'gz', 'bz2', '7z', 'rar', 'iso', 'dmg', 'vsix',
  'mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm',
  'mp3', 'wav', 'flac', 'ogg', 'aac', 'm4a',
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
  'exe', 'dll', 'so', 'dylib', 'bin', 'obj', 'o', 'a', 'lib', 'pyc', 'class',
  'ttf', 'otf', 'woff', 'woff2', 'eot',
  'wasm', 'dat', 'db', 'sqlite', 'sqlite3'
]);

/**
 * Treemap & Status Bar token count heatmap color bands
 */
export const TOKEN_COLOR_THRESHOLDS = {
  LOW: 1000,      // < 1k: Green / Safe
  MEDIUM: 8000,   // 1k - 8k: Yellow / Moderate
  HIGH: 30000,    // 8k - 30k: Orange / Heavy
  EXTREME: 60000  // > 30k - 60k+: Red / Alert
};
