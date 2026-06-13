// runtime/vision.js — Vision AI with pluggable provider.
//
// Uses the same AI provider configured for the rest of the runtime (FUTURE_AI_PROVIDER).
// Both Anthropic (claude-3+) and OpenAI (gpt-4o) support vision natively.
//
// All functions accept:
//   image — a URL (https://...) or base64 data-URI (data:image/jpeg;base64,...)

import { resolveProvider } from './providers/index.js';

/**
 * Build the message payload for a vision request.
 * Supports URLs and base64 data-URIs.
 */
function visionMessage(prompt, image) {
  const img = String(image);
  const isDataUri = img.startsWith('data:');
  const content = [
    {
      type: 'image_url',
      image_url: { url: isDataUri ? img : img },
    },
    { type: 'text', text: prompt },
  ];
  // Anthropic format differs slightly — provider.chat() receives the same
  // OpenAI-style structure; the Anthropic provider does NOT reformat it
  // because the Messages API v2 accepts this layout too.
  return [{ role: 'user', content }];
}

async function callVision(prompt, image) {
  const provider = resolveProvider();
  if (!provider) {
    return `[vision offline] Configure an AI provider to process: ${image}`;
  }
  try {
    return await provider.chat(visionMessage(prompt, image));
  } catch (e) {
    return `[vision error] ${e.message}`;
  }
}

/** Describe the contents of an image. @returns {Promise<string>} */
export async function describe(image) {
  return callVision('Describe this image in detail.', image);
}

/** Detect and list objects, people, or labels visible in the image. @returns {Promise<string>} */
export async function detect(image) {
  return callVision('List all objects, people, and notable elements you can detect in this image. Be concise.', image);
}

/** Extract all readable text from the image (OCR). @returns {Promise<string>} */
export async function ocr(image) {
  return callVision('Extract all text visible in this image exactly as it appears. Return only the text, nothing else.', image);
}

/** Classify the image into a category. @returns {Promise<string>} */
export async function classify(image) {
  return callVision('What is the primary category or type of this image? Reply with one or two words.', image);
}

/**
 * Compare two images and describe the differences.
 * @param {string} imageA
 * @param {string} imageB
 * @returns {Promise<string>}
 */
export async function compare(imageA, imageB) {
  const provider = resolveProvider();
  if (!provider) return '[vision offline] Configure an AI provider to compare images.';
  try {
    const messages = [{
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: String(imageA) } },
        { type: 'image_url', image_url: { url: String(imageB) } },
        { type: 'text', text: 'Compare these two images. What are the key similarities and differences?' },
      ],
    }];
    return await provider.chat(messages);
  } catch (e) {
    return `[vision error] ${e.message}`;
  }
}
