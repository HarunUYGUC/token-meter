import { ITokenizer } from './baseTokenizer';
import { SUPPORTED_MODELS } from '../../constants';
import { encode as encodeGpt } from 'gpt-tokenizer/model/gpt-4o';

/**
 * Google Gemini 2.0 / 3.x (SentencePiece 256k Vocab) Tokenizer
 * Gemini uses a 256k token vocabulary based on SentencePiece.
 * It is extremely efficient for multilingual text (Turkish, German, etc.) and code keywords.
 */
export class GeminiTokenizer implements ITokenizer {
  readonly id = 'gemini-2-flash';
  readonly name = SUPPORTED_MODELS['gemini-2-flash'].name;
  readonly family = 'google' as const;
  readonly contextLimit = SUPPORTED_MODELS['gemini-2-flash'].contextLimit;

  countTokens(text: string): number {
    if (!text || text.length === 0) {
      return 0;
    }

    try {
      // Base o200k tokens
      const o200kTokens = encodeGpt(text).length;

      // Gemini's 256k vocabulary has wider multilingual compression and slightly different code whitespace chunking
      const nonAsciiCount = (text.match(/[^\x00-\x7F]/g) || []).length;
      const nonAsciiRatio = nonAsciiCount / text.length;

      if (nonAsciiRatio > 0.15) {
        // High multilingual text: Gemini 256k SPM is ~10-15% more compressed than o200k
        return Math.max(1, Math.round(o200kTokens * 0.88));
      }

      // Standard code / English: roughly 0.98x - 1.02x of o200k
      return Math.max(1, Math.round(o200kTokens * 0.99));
    } catch {
      // Fallback: ~4.1 chars per token for Gemini with 256k vocab
      return Math.ceil(text.length / 4.1);
    }
  }

  encode(text: string): number[] {
    if (!text || text.length === 0) {
      return [];
    }
    try {
      return Array.from(encodeGpt(text));
    } catch {
      return [];
    }
  }
}
