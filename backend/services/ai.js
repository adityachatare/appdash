const Anthropic = require('@anthropic-ai/sdk');
const { z } = require('zod');
const { zodOutputFormat } = require('@anthropic-ai/sdk/helpers/zod');
const { env } = require('../config/env');

let client;
function getClient() {
  if (!env.anthropicApiKey) {
    const err = new Error('ANTHROPIC_API_KEY is not configured on the server');
    err.status = 503;
    throw err;
  }
  if (!client) client = new Anthropic({ apiKey: env.anthropicApiKey });
  return client;
}

const VariantSchema = z.object({
  title: z.string().describe('Notification title, max 50 characters'),
  body: z.string().describe('Notification body, max 150 characters'),
  emoji: z.string().describe('A single emoji that fits the message, or empty string'),
  rationale: z.string().describe('One sentence on why this variant should perform well'),
  deepLink: z
    .string()
    .describe('Suggested in-app deep link path such as /offers or /cart, or empty string'),
});

const GenerationSchema = z.object({
  variants: z.array(VariantSchema).min(1).max(8),
  bestVariantIndex: z.number().int().describe('Zero-based index of the strongest variant'),
  sendTimeSuggestion: z
    .string()
    .describe('Short suggestion for when to send, e.g. "Weekday evenings around 7pm local time"'),
});

const SYSTEM_PROMPT = `You write push notifications for mobile apps published on Google Play and the App Store.

Rules:
- Titles must be 50 characters or fewer. Bodies must be 150 characters or fewer. Count carefully.
- Lead with the benefit to the user. Be specific and concrete; avoid vague hype.
- Never use ALL CAPS, excessive punctuation, or more than one emoji per field.
- Respect the requested tone and the app's brand voice.
- Do not fabricate prices, dates, or discounts unless the request includes them.
- Each variant must take a different angle (urgency, curiosity, social proof, value, personal).
- Reply only through the structured output.`;

/**
 * Generates push-notification variants for an app.
 * @param {object} opts
 * @param {object} opts.app  App document (name, description, packageName, aiContext)
 * @param {string} opts.prompt  What the user wants to announce
 * @param {string} [opts.tone]
 * @param {string} [opts.audience]
 * @param {number} [opts.count]
 * @param {string} [opts.language]
 */
async function generateNotifications({ app, prompt, tone, audience, count = 4, language = 'English' }) {
  const n = Math.min(Math.max(Number(count) || 4, 1), 8);
  const userPrompt = [
    `App name: ${app.name}`,
    `Package: ${app.packageName}`,
    app.description ? `App description: ${app.description}` : null,
    app.aiContext?.brandVoice ? `Brand voice: ${app.aiContext.brandVoice}` : null,
    `Audience: ${audience || app.aiContext?.audience || 'all users of the app'}`,
    `Tone: ${tone || app.aiContext?.tone || 'friendly'}`,
    `Language: ${language}`,
    `Number of variants: ${n}`,
    '',
    'What to announce:',
    prompt,
  ]
    .filter(Boolean)
    .join('\n');

  const response = await getClient().beta.messages.parse({
    model: env.aiModel,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    output_config: { effort: 'medium', format: zodOutputFormat(GenerationSchema) },
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    messages: [{ role: 'user', content: userPrompt }],
  });

  if (response.stop_reason === 'refusal') {
    const detail = response.stop_details?.explanation ? `: ${response.stop_details.explanation}` : '';
    const err = new Error(`The model declined this request${detail}`);
    err.status = 422;
    throw err;
  }
  if (!response.parsed_output) {
    const err = new Error('The model returned an unparseable response. Please try again.');
    err.status = 502;
    throw err;
  }

  const out = response.parsed_output;
  out.variants = out.variants.map((v) => ({
    ...v,
    title: v.title.slice(0, 50),
    body: v.body.slice(0, 150),
  }));
  if (out.bestVariantIndex < 0 || out.bestVariantIndex >= out.variants.length) out.bestVariantIndex = 0;
  return { ...out, model: response.model, usage: response.usage };
}

const RefineSchema = z.object({
  title: z.string(),
  body: z.string(),
  changeSummary: z.string().describe('One sentence describing what changed'),
});

/** Improves a single draft (shorten, punchier, translate, etc.). */
async function refineNotification({ app, title, body, instruction }) {
  const context = app.description ? `App description: ${app.description}\n` : '';
  const response = await getClient().beta.messages.parse({
    model: env.aiModel,
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    output_config: { effort: 'low', format: zodOutputFormat(RefineSchema) },
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    messages: [
      {
        role: 'user',
        content: `App name: ${app.name}\n${context}\nCurrent draft:\nTitle: ${title}\nBody: ${body}\n\nInstruction: ${instruction}`,
      },
    ],
  });

  if (response.stop_reason === 'refusal' || !response.parsed_output) {
    const err = new Error('The model could not refine this draft. Please try again.');
    err.status = 422;
    throw err;
  }
  const out = response.parsed_output;
  return {
    title: out.title.slice(0, 50),
    body: out.body.slice(0, 150),
    changeSummary: out.changeSummary,
    model: response.model,
  };
}

module.exports = { generateNotifications, refineNotification };
