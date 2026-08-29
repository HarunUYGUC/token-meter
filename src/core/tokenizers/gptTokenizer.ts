import { ITokenizer } from './baseTokenizer';
import { SUPPORTED_MODELS } from '../../constants';
import { encode, isWithinTokenLimit } from 'gpt-tokenizer/model/gpt-4o';

export class GptTokenizer implements ITokenizer {
  readonly id = 'gpt-4o';
  readonly name = SUPPORTED_MODELS['gpt-4o'].name;
  readonly family = 'openai' as const;
  readonly contextLimit = SUPPORTED_MODELS['gpt-4o'].contextLimit;

  countTokens(text: string): number {
    if (!text || text.length === 0) {
      return 0;
    }
    try {
      return encode(text).length;
    } catch (e) {
      // Fallback in case of parsing edge case
      return Math.ceil(text.length / 3.7);
    }
  }

  encode(text: string): number[] {
    if (!text || text.length === 0) {
      return [];
    }
    try {
      return Array.from(encode(text));
    } catch (e) {
      return [];
    }
  }
}
