import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';

export type AIProvider = 'openai' | 'anthropic';

// Set your default provider here
const DEFAULT_PROVIDER: AIProvider = 'openai';

/**
 * Returns the appropriate language model based on the specified provider or default.
 * Defaults to:
 * - OpenAI: gpt-4o (best for vision and complex reasoning)
 * - Anthropic: claude-3-5-sonnet (excellent reasoning and speed)
 */
export function getLanguageModel(provider: AIProvider = DEFAULT_PROVIDER) {
  if (provider === 'anthropic') {
    return anthropic('claude-3-5-sonnet-20240620');
  }
  
  // Default to OpenAI
  return openai('gpt-4o');
}

/**
 * Returns the appropriate lightweight/fast model for simple tasks (like routing or simple extractions).
 */
export function getFastModel(provider: AIProvider = DEFAULT_PROVIDER) {
  if (provider === 'anthropic') {
    return anthropic('claude-3-haiku-20240307');
  }
  
  // Default to OpenAI
  return openai('gpt-4o-mini');
}
