import OpenAI from 'openai';
import { SceneDescription, SceneQuery } from '../types';
import { API } from '../constants';

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
    if (!apiKey) throw new Error('OpenAI API key not configured');
    client = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
  }
  return client;
}

const SYSTEM_PROMPT = `You are the vision system for BlindAid, an app for blind and visually impaired users.
Describe what you see in plain, direct, conversational English — like a trusted friend with perfect vision narrating the world.
NEVER use robotic phrasing like "Obstacle detected" or "Object identified."
ALWAYS prioritize: immediate hazards first, then people, then obstacles, then signage, then exits, then general context.
Keep descriptions concise but complete. Use distance estimates in feet. Mention relative directions (left, right, ahead).
Do not mention colors unless specifically asked. Do not describe the image metadata, just the scene.`;

const QUERY_PROMPTS: Record<SceneQuery, string> = {
  full: 'Describe everything in this scene. Prioritize hazards, people, obstacles, signs, exits, then general context.',
  sign: 'Read and describe any text or signage visible in this image.',
  people: 'Are there any people near me? Describe their position and what they are doing.',
  color: 'What is the dominant color of the main object in the center of this image?',
  read_text: 'Read all text visible in this image aloud, in order from top to bottom.',
  identify_object: 'What am I holding or touching? Describe the object in my hands.',
  currency:
    'What denomination of currency is this? Tell me the amount and type (bill or coin).',
  menu: 'This is a restaurant menu. Read the menu items and their prices.',
};

export async function describeScene(
  imageBase64: string,
  query: SceneQuery = 'full',
): Promise<SceneDescription> {
  const openai = getClient();

  const userPrompt = QUERY_PROMPTS[query];

  const response = await openai.chat.completions.create({
    model: API.OPENAI_VISION_MODEL,
    max_tokens: API.OPENAI_MAX_TOKENS,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: {
              url: `data:image/jpeg;base64,${imageBase64}`,
              detail: 'auto',
            },
          },
          { type: 'text', text: userPrompt },
        ],
      },
    ],
  });

  const text = response.choices[0]?.message?.content ?? 'I could not get a description right now.';

  return parseSceneResponse(text);
}

function parseSceneResponse(text: string): SceneDescription {
  // Extract structured data from free-form GPT response
  const lower = text.toLowerCase();
  const sentences = text.split(/[.!?]+/).filter(Boolean);

  const hazardKeywords = ['hazard', 'danger', 'careful', 'watch out', 'drop', 'step', 'curb', 'traffic'];
  const peopleKeywords = ['person', 'people', 'someone', 'man', 'woman', 'child', 'crowd'];
  const obstacleKeywords = ['obstacle', 'object', 'cart', 'chair', 'table', 'pole', 'wall', 'door', 'parked'];
  const signKeywords = ['sign', 'text', 'says', 'reads', 'label', 'display'];
  const exitKeywords = ['exit', 'entrance', 'door', 'opening', 'gate', 'out'];

  const hazards = sentences.filter((s) => hazardKeywords.some((k) => s.toLowerCase().includes(k)));
  const people = sentences.filter((s) => peopleKeywords.some((k) => s.toLowerCase().includes(k)));
  const obstacles = sentences.filter((s) => obstacleKeywords.some((k) => s.toLowerCase().includes(k)));
  const signage = sentences.filter((s) => signKeywords.some((k) => s.toLowerCase().includes(k)));
  const exits = sentences.filter((s) => exitKeywords.some((k) => s.toLowerCase().includes(k)));

  return {
    summary: text,
    hazards,
    people,
    obstacles,
    signage,
    exits,
    context: text,
    timestamp: Date.now(),
  };
}

export async function checkForSignificantChange(
  prevBase64: string,
  currBase64: string,
): Promise<{ changed: boolean; description?: string }> {
  const openai = getClient();

  const response = await openai.chat.completions.create({
    model: API.OPENAI_VISION_MODEL,
    max_tokens: 150,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Compare these two scenes. Has anything significant changed — a new person entering, a new obstacle within 6 feet, or an exit becoming visible? Reply with YES or NO, then a single sentence description only if YES.',
          },
          {
            type: 'image_url',
            image_url: { url: `data:image/jpeg;base64,${prevBase64}`, detail: 'low' },
          },
          {
            type: 'image_url',
            image_url: { url: `data:image/jpeg;base64,${currBase64}`, detail: 'low' },
          },
        ],
      },
    ],
  });

  const text = response.choices[0]?.message?.content ?? 'NO';
  const changed = text.trim().toUpperCase().startsWith('YES');
  const description = changed ? text.replace(/^YES[.,:]?\s*/i, '').trim() : undefined;

  return { changed, description };
}
