import { ITokenizer } from './baseTokenizer';
import { SUPPORTED_MODELS } from '../../constants';
import { getEncoding } from 'js-tiktoken';

/**
 * DeepSeek V3 / Llama 3.3 128k BPE Tokenizer
 */
export class DeepSeekTokenizer implements ITokenizer {
  readonly id = 'deepseek-v3';
  readonly name = SUPPORTED_MODELS['deepseek-v3'].name;
  readonly family = 'deepseek' as const;
  readonly contextLimit = SUPPORTED_MODELS['deepseek-v3'].contextLimit;

  private encoder: ReturnType<typeof getEncoding> | null = null;

  constructor() {
    try {
      this.encoder = getEncoding('cl100k_base');
    } catch {
      this.encoder = null;
    }
  }

  countTokens(text: string): number {
    if (!text || text.length === 0) {
      return 0;
    }

    if (this.encoder) {
      try {
        const baseTokens = this.encoder.encode(text).length;
        // DeepSeek 128k vocab has slightly better compression than cl100k
        return Math.max(1, Math.round(baseTokens * 0.96));
      } catch {
        // Fallback
      }
    }

    return Math.ceil(text.length / 3.8);
  }

  encode(text: string): number[] {
    if (!text || text.length === 0) {
      return [];
    }
    if (this.encoder) {
      try {
        return Array.from(this.encoder.encode(text));
      } catch {
        return [];
      }
    }
    return [];
  }
}
