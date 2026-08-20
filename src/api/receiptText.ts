import { completeWithAnthropic } from '@/api/anthropic';
import { VisionError } from '@/api/errors';
import { completeWithGemini } from '@/api/gemini';
import { getApiKey, getOpenAIEndpoint, providerForKey } from '@/api/keyStore';
import { completeWithOpenAI } from '@/api/openai';
import { parseReceiptResponse, type ExtractedReceipt } from '@/api/receipt';
import { RECEIPT_TEXT_SYSTEM_PROMPT, receiptTextUserPrompt } from '@/api/receiptTextPrompt';

/**
 * The text-only half of receipt extraction, for receipts already read on
 * this device.
 *
 * The sibling of `receipt.ts`: same provider facade, same JSON contract,
 * same parser — the one difference being that no image is ever attached.
 * Callers reach this only through `receiptOcrService.ts`, which decides
 * whether the user has actually asked for it.
 */
export async function structureReceiptText(
  lines: readonly string[],
  captureDate: string,
  signal?: AbortSignal,
): Promise<ExtractedReceipt> {
  if (lines.length === 0) {
    throw new VisionError('malformed', 'There was no recognized text to structure.');
  }
  const apiKey = await getApiKey();
  if (!apiKey) {
    throw new VisionError('no_key', 'No API key is set.');
  }
  const provider = providerForKey(apiKey);
  const user = receiptTextUserPrompt(lines);

  let raw: string;
  if (provider === 'anthropic') {
    raw = await completeWithAnthropic(apiKey, RECEIPT_TEXT_SYSTEM_PROMPT, user, signal);
  } else if (provider === 'openai') {
    raw = await completeWithOpenAI(apiKey, RECEIPT_TEXT_SYSTEM_PROMPT, user, signal, await getOpenAIEndpoint());
  } else if (provider === 'gemini') {
    raw = await completeWithGemini(apiKey, RECEIPT_TEXT_SYSTEM_PROMPT, user, signal);
  } else {
    throw new VisionError('no_key', 'The saved API key is not recognised.');
  }

  return parseReceiptResponse(raw, captureDate);
}
