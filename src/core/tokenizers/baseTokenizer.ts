/**
 * Base Tokenizer Interface
 */

export interface ITokenizer {
  readonly id: string;
  readonly name: string;
  readonly family: 'anthropic' | 'openai' | 'google' | 'deepseek';
  readonly contextLimit: number;

  /**
   * Calculates the exact or high-accuracy token count for the given text string.
   */
  countTokens(text: string): number;

  /**
   * Encodes the text into token IDs.
   */
  encode(text: string): number[];
}
