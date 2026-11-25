import express from 'express';
import type { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';

app.use(express.json({ limit: '2mb' }));

function getGeminiClient(apiVersion?: string): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured on the server.');
  }
  return new GoogleGenAI({
    apiKey,
    ...(apiVersion ? { apiVersion } : {}),
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function parseFriendlyErrorMessage(err: unknown): { status: number; message: string } {
  const raw = err instanceof Error ? err.message : String(err || 'Unexpected server error.');

  let extracted = raw;
  try {
    const maybeJson = JSON.parse(raw) as { error?: { code?: number; message?: string; status?: string } };
    if (maybeJson?.error?.message) {
      extracted = maybeJson.error.message;
    }
  } catch {
    // raw is plain text
  }

  if (
    raw.includes('API_KEY_INVALID') ||
    raw.includes('PERMISSION_DENIED') ||
    raw.includes('GEMINI_API_KEY is not configured')
  ) {
    return {
      status: 403,
      message: 'Gemini API key is missing or invalid. Please check your key in Settings > Secrets.',
    };
  }

  if (raw.includes('503') || raw.includes('UNAVAILABLE') || raw.includes('high demand')) {
    return {
      status: 503,
      message: 'The AI studio writer is momentarily busy due to high demand. Please click the button again in a moment.',
    };
  }

  if (raw.includes('RESOURCE_EXHAUSTED') || raw.includes('429')) {
    return {
      status: 429,
      message: 'Rate limit reached for a moment. Please wait a few seconds and try again.',
    };
  }

  return { status: 500, message: extracted };
}

function handleGeminiError(err: unknown, res: Response) {
  const { status, message } = parseFriendlyErrorMessage(err);
  console.error('[API Error]', status, message);
  return res.status(status).json({ error: message });
}

function isTransientError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err || '');
  return (
    msg.includes('503') ||
    msg.includes('UNAVAILABLE') ||
    msg.includes('high demand') ||
    msg.includes('429') ||
    msg.includes('ECONNRESET') ||
    msg.includes('ETIMEDOUT')
  );
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateTextWithFallback(
  ai: GoogleGenAI,
  params: {
    contents: string;
    systemInstruction?: string;
    responseSchema: Record<string, unknown>;
  }
) {
  const modelsToTry = ['gemini-4-hydrogen', 'gemini-3.1-flash-lite'];
  let lastErr: unknown;

  for (const model of modelsToTry) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await ai.models.generateContent({
          model,
          contents: params.contents,
          config: {
            ...(params.systemInstruction
              ? { systemInstruction: params.systemInstruction }
              : {}),
            responseMimeType: 'application/json',
            responseSchema: params.responseSchema,
          },
        });
      } catch (err) {
        lastErr = err;
        if (!isTransientError(err)) {
          throw err;
        }
        await sleep(600 * (attempt + 1));
      }
    }
  }

  throw lastErr;
}

async function runWithTtsRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isTransientError(err) || attempt === 2) {
        throw err;
      }
      await sleep(700 * (attempt + 1));
    }
  }
  throw lastErr;
}

function countWords(text: string): number {
  const cleaned = text.trim();
  if (!cleaned) return 0;
  return cleaned.split(/\s+/).length;
}

interface IncomingExpression {
  phrase: string;
  movie: string;
  note?: string;
}

interface IncomingCharacter {
  name: string;
  origin: string;
  role: string;
  outfit: string;
}

interface IncomingScene {
  place: string;
  situation: string;
  characterA: IncomingCharacter;
  characterB: IncomingCharacter;
  style: string;
}

const BEAT_META = [
  { id: 'hook', label: 'Hook', timeRange: '0-7s', startSec: 0, endSec: 7, defaultCamera: 'wide-cafe', defaultMood: 'calm' },
  { id: 'problem', label: 'Problem', timeRange: '7-15s', startSec: 7, endSec: 15, defaultCamera: 'street-walk-spill', defaultMood: 'clumsy' },
  { id: 'turn', label: 'Turn', timeRange: '15-23s', startSec: 15, endSec: 23, defaultCamera: 'two-shot-apology', defaultMood: 'earnest' },
  { id: 'close', label: 'Close', timeRange: '23-30s', startSec: 23, endSec: 30, defaultCamera: 'doorway-realization', defaultMood: 'playful' },
] as const;

function sanitizeLinesAndSubtitles(
  lines: Array<{ speaker: string; text: string }>,
  charAName: string,
  charBName: string
) {
  const normalizedLines = lines.map((l) => {
    const speaker: 'A' | 'B' = l.speaker === 'B' ? 'B' : 'A';
    return {
      speaker,
      speakerName: speaker === 'A' ? charAName : charBName,
      text: String(l.text || '').trim(),
    };
  });

  // Build max-2-line subtitle chunks directly from the exact spoken words
  const subtitles: string[] = [];
  for (const line of normalizedLines) {
    if (!line.text) continue;
    const words = line.text.split(/\s+/);
    let currentChunk: string[] = [];
    for (const word of words) {
      const candidate = [...currentChunk, word].join(' ');
      if (candidate.length > 68 && currentChunk.length > 0) {
        subtitles.push(formatTwoLines(currentChunk.join(' ')));
        currentChunk = [word];
      } else {
        currentChunk.push(word);
      }
    }
    if (currentChunk.length > 0) {
      subtitles.push(formatTwoLines(currentChunk.join(' ')));
    }
  }

  return { normalizedLines, subtitles };
}

function formatTwoLines(text: string): string {
  const clean = text.trim();
  if (clean.length <= 36) return clean;
  const words = clean.split(/\s+/);
  let bestSplit = Math.ceil(words.length / 2);
  let bestDiff = Infinity;
  for (let i = 1; i < words.length; i++) {
    const l1 = words.slice(0, i).join(' ').length;
    const l2 = words.slice(i).join(' ').length;
    const diff = Math.abs(l1 - l2);
    if (l1 <= 40 && l2 <= 40 && diff < bestDiff) {
      bestDiff = diff;
      bestSplit = i;
    }
  }
  return `${words.slice(0, bestSplit).join(' ')}\n${words.slice(bestSplit).join(' ')}`;
}

const STORYBOARD_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    beats: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          sceneDescription: { type: Type.STRING },
          lines: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                speaker: { type: Type.STRING },
                text: { type: Type.STRING },
              },
              required: ['speaker', 'text'],
            },
          },
          targetExpressions: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          cameraCue: { type: Type.STRING },
          moodCue: { type: Type.STRING },
        },
        required: ['id', 'sceneDescription', 'lines', 'targetExpressions'],
      },
    },
  },
  required: ['beats'],
};

app.post('/api/storyboard/generate', async (req: Request, res: Response) => {
  try {
    const body = req.body as {
      expressions?: IncomingExpression[];
      scene?: IncomingScene;
    };

    if (!body?.expressions || !Array.isArray(body.expressions) || body.expressions.length === 0) {
      return res.status(400).json({ error: 'Please provide your English expressions.' });
    }
    if (!body?.scene?.place || !body?.scene?.characterA?.name || !body?.scene?.characterB?.name) {
      return res.status(400).json({ error: 'Please provide valid scene and character details.' });
    }

    const validExpressions = body.expressions
      .map((e) => ({
        phrase: String(e.phrase || '').trim(),
        movie: String(e.movie || '').trim(),
        note: String(e.note || '').trim(),
      }))
      .filter((e) => e.phrase.length > 0)
      .slice(0, 12);

    if (validExpressions.length === 0) {
      return res.status(400).json({ error: 'At least one expression is required.' });
    }

    const scene = body.scene;
    const charA = scene.characterA;
    const charB = scene.characterB;

    const ai = getGeminiClient();

    const prompt = `Write a witty, heartwarming, 100% family-friendly 30-second short-film storyboard for Korean university students learning everyday English.

SETTING & CHARACTERS:
- Place: ${scene.place}
- Situation: ${scene.situation}
- Character A (speaker "A"): ${charA.name} from ${charA.origin} (${charA.role}, wearing ${charA.outfit})
- Character B (speaker "B"): ${charB.name} from ${charB.origin} (${charB.role}, wearing ${charB.outfit})

REQUIRED ENGLISH EXPRESSIONS (MUST appear verbatim with exact spelling in the spoken lines):
${validExpressions
  .map(
    (e, idx) =>
      `${idx + 1}. "${e.phrase}" (from ${e.movie || 'movie'}${e.note ? ` — student note: ${e.note}` : ''})`
  )
  .join('\n')}

STRICT CONSTRAINTS:
1. Split into exactly 4 beats with these exact IDs:
   - "hook" (0-7s): Introduce ${charA.name} at the location and use the 1st expression naturally.
   - "problem" (7-15s): Introduce ${charB.name} and the accidental conflict/spill.
   - "turn" (15-23s): The apology and helpful offer using the next expression(s).
   - "close" (23-30s): A charming, polite, family-friendly twist & warm wrap-up.
2. WORD COUNT: The TOTAL number of words across ALL spoken lines ("text" fields) in all 4 beats combined MUST be between 60 and 70 words (aim for 64-67 words!). Do NOT exceed 70 words and do NOT go below 60 words.
3. EXACT EXPRESSIONS: Every single required expression above MUST appear verbatim (exact phrase) in the spoken "lines" text!
4. FAMILY-FRIENDLY & BRAND-FREE: No profanity, no smoking/cigars (replace with espresso, tea, or fresh breeze if needed), no brand names like "Netflix" (use "watch a movie" or "stream a show"), no real celebrities or movie characters.
5. Keep each beat's "sceneDescription" concise (1-2 clear visual sentences) describing camera action and expressions.
6. Set "cameraCue" to one of: "wide-cafe", "street-walk-spill", "two-shot-apology", "doorway-realization".
7. Set "moodCue" to one of: "calm", "clumsy", "earnest", "playful".
8. In "lines", each item has "speaker": "A" or "B", and "text": pure spoken dialogue (no speaker name prefix inside "text").`;

    const response = await generateTextWithFallback(ai, {
      contents: prompt,
      systemInstruction:
        'You are a precise screenwriter for 30-second English learning micro-films. Strictly obey the 60-70 total spoken word budget and include every target expression verbatim.',
      responseSchema: STORYBOARD_RESPONSE_SCHEMA,
    });

    const parsed = JSON.parse((response.text ?? '{}').trim()) as {
      beats?: Array<{
        id: string;
        sceneDescription: string;
        lines: Array<{ speaker: string; text: string }>;
        targetExpressions?: string[];
        cameraCue?: string;
        moodCue?: string;
      }>;
    };

    const rawBeats = Array.isArray(parsed.beats) ? parsed.beats : [];

    let formattedBeats = BEAT_META.map((meta, index) => {
      const matched =
        rawBeats.find((b) => b.id === meta.id) || rawBeats[index] || {
          id: meta.id,
          sceneDescription: `${charA.name} and ${charB.name} share a memorable moment in ${scene.place}.`,
          lines: [{ speaker: index === 0 ? 'A' : 'B', text: 'What a surprising afternoon!' }],
          targetExpressions: [],
        };

      const { normalizedLines, subtitles } = sanitizeLinesAndSubtitles(
        matched.lines || [],
        charA.name,
        charB.name
      );

      return {
        id: meta.id,
        label: meta.label,
        timeRange: meta.timeRange,
        startSec: meta.startSec,
        endSec: meta.endSec,
        sceneDescription: String(matched.sceneDescription || '').trim(),
        lines: normalizedLines,
        subtitles,
        targetExpressions: Array.isArray(matched.targetExpressions)
          ? matched.targetExpressions.map(String)
          : [],
        cameraCue: (['wide-cafe', 'street-walk-spill', 'two-shot-apology', 'doorway-realization'].includes(
          String(matched.cameraCue)
        )
          ? matched.cameraCue
          : meta.defaultCamera) as string,
        moodCue: (['calm', 'clumsy', 'earnest', 'playful'].includes(String(matched.moodCue))
          ? matched.moodCue
          : meta.defaultMood) as string,
      };
    });

    // Check total word count & missing expressions; if outside 58-72 or missing phrases, run a quick tightening pass
    const fullDialogue = formattedBeats
      .flatMap((b) => b.lines.map((l) => l.text))
      .join(' ');
    const totalWords = countWords(fullDialogue);
    const missingPhrases = validExpressions
      .map((e) => e.phrase)
      .filter((p) => !fullDialogue.toLowerCase().includes(p.toLowerCase()));

    if (totalWords < 58 || totalWords > 72 || missingPhrases.length > 0) {
      const fixPrompt = `Revise this 4-beat storyboard so that:
1. Total spoken words across ALL 4 beats' "lines" is strictly between 60 and 70 words (currently ${totalWords} words).
2. Every required expression appears verbatim: ${validExpressions.map((e) => `"${e.phrase}"`).join(', ')}. ${missingPhrases.length > 0 ? `Currently missing: ${missingPhrases.join(', ')}.` : ''}
3. Keep it family-friendly, brand-free, and preserve the story beats.

Current beats JSON:
${JSON.stringify({ beats: formattedBeats })}`;

      const fixResp = await generateTextWithFallback(ai, {
        contents: fixPrompt,
        responseSchema: STORYBOARD_RESPONSE_SCHEMA,
      });
      const fixedParsed = JSON.parse((fixResp.text ?? '{}').trim()) as typeof parsed;
      if (Array.isArray(fixedParsed.beats) && fixedParsed.beats.length === 4) {
        formattedBeats = BEAT_META.map((meta, index) => {
          const matched = fixedParsed.beats!.find((b) => b.id === meta.id) || fixedParsed.beats![index];
          const { normalizedLines, subtitles } = sanitizeLinesAndSubtitles(
            matched.lines || [],
            charA.name,
            charB.name
          );
          return {
            ...formattedBeats[index],
            sceneDescription: String(matched.sceneDescription || formattedBeats[index].sceneDescription).trim(),
            lines: normalizedLines,
            subtitles,
            targetExpressions: Array.isArray(matched.targetExpressions)
              ? matched.targetExpressions.map(String)
              : formattedBeats[index].targetExpressions,
          };
        });
      }
    }

    return res.json({ beats: formattedBeats });
  } catch (err) {
    return handleGeminiError(err, res);
  }
});

app.post('/api/storyboard/regenerate-beat', async (req: Request, res: Response) => {
  try {
    const body = req.body as {
      beatId?: string;
      beats?: Array<{
        id: string;
        label: string;
        timeRange: string;
        sceneDescription: string;
        lines: Array<{ speaker: string; text: string }>;
        targetExpressions: string[];
      }>;
      expressions?: IncomingExpression[];
      scene?: IncomingScene;
    };

    const beatId = String(body?.beatId || '');
    const meta = BEAT_META.find((m) => m.id === beatId);
    if (!meta || !Array.isArray(body?.beats) || !body?.scene) {
      return res.status(400).json({ error: 'Invalid beat regeneration request.' });
    }

    const scene = body.scene;
    const charA = scene.characterA;
    const charB = scene.characterB;
    const otherWords = body.beats
      .filter((b) => b.id !== beatId)
      .flatMap((b) => b.lines.map((l) => l.text))
      .join(' ');
    const otherWordCount = countWords(otherWords);
    const targetBeatWords = Math.max(10, Math.min(22, 65 - otherWordCount));

    const currentBeat = body.beats.find((b) => b.id === beatId);
    const requiredForBeat = currentBeat?.targetExpressions || [];

    const ai = getGeminiClient();
    const prompt = `Regenerate ONLY the "${meta.label}" beat (${meta.timeRange}) of this 30-second English learning short film so it feels fresh while fitting seamlessly with the other beats.

Place: ${scene.place}
Character A ("A"): ${charA.name} (${charA.origin}, ${charA.outfit})
Character B ("B"): ${charB.name} (${charB.origin}, ${charB.outfit})

Other beats for continuity:
${body.beats
  .filter((b) => b.id !== beatId)
  .map((b) => `- ${b.label} (${b.timeRange}): ${b.lines.map((l) => `${l.speaker === 'A' ? charA.name : charB.name}: "${l.text}"`).join(' ')}`)
  .join('\n')}

Requirements for THIS beat (${meta.label}, ${meta.timeRange}):
1. Aim for ~${targetBeatWords} spoken words (so total across all 4 beats stays in 60-70 words).
2. Must include these exact expressions verbatim: ${requiredForBeat.length > 0 ? requiredForBeat.map((p) => `"${p}"`).join(', ') : 'keep natural continuity'}.
3. 100% family-friendly, no brand logos, no profanity.
4. Provide a fresh 1-2 sentence sceneDescription and spoken lines ("speaker": "A" or "B", "text": spoken words).`;

    const singleBeatSchema = {
      type: Type.OBJECT,
      properties: {
        sceneDescription: { type: Type.STRING },
        lines: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              speaker: { type: Type.STRING },
              text: { type: Type.STRING },
            },
            required: ['speaker', 'text'],
          },
        },
        targetExpressions: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
      },
      required: ['sceneDescription', 'lines'],
    };

    const response = await generateTextWithFallback(ai, {
      contents: prompt,
      responseSchema: singleBeatSchema,
    });

    const parsed = JSON.parse((response.text ?? '{}').trim()) as {
      sceneDescription: string;
      lines: Array<{ speaker: string; text: string }>;
      targetExpressions?: string[];
    };

    const { normalizedLines, subtitles } = sanitizeLinesAndSubtitles(
      parsed.lines || [],
      charA.name,
      charB.name
    );

    return res.json({
      beat: {
        id: meta.id,
        label: meta.label,
        timeRange: meta.timeRange,
        startSec: meta.startSec,
        endSec: meta.endSec,
        sceneDescription: String(parsed.sceneDescription || '').trim(),
        lines: normalizedLines,
        subtitles,
        targetExpressions:
          Array.isArray(parsed.targetExpressions) && parsed.targetExpressions.length > 0
            ? parsed.targetExpressions.map(String)
            : requiredForBeat,
        cameraCue: meta.defaultCamera,
        moodCue: meta.defaultMood,
      },
    });
  } catch (err) {
    return handleGeminiError(err, res);
  }
});

app.post('/api/tts/beat', async (req: Request, res: Response) => {
  try {
    const body = req.body as {
      lines?: Array<{ speaker: 'A' | 'B'; speakerName: string; text: string }>;
      characterAName?: string;
      characterBName?: string;
      moodCue?: string;
    };

    const lines = (body?.lines || []).filter((l) => l.text && l.text.trim().length > 0);
    if (lines.length === 0) {
      return res.status(400).json({ error: 'No spoken lines provided for this beat.' });
    }

    const charA = String(body.characterAName || 'Marius').trim() || 'Marius';
    const charB = String(body.characterBName || 'Rene').trim() || 'Rene';

    const hasA = lines.some((l) => l.speaker === 'A');
    const hasB = lines.some((l) => l.speaker === 'B');
    const isDualSpeaker = hasA && hasB && charA !== charB;

    const ai = getGeminiClient('v1beta');

    let base64Audio: string | undefined;

    if (isDualSpeaker) {
      const inputParts = lines.map((l) => {
        const speakerLabel = l.speaker === 'A' ? charA : charB;
        return {
          type: 'text' as const,
          text: `${speakerLabel}: ${l.text.trim()}`,
          annotations: [
            {
              type: 'speech_metadata' as const,
              speaker: speakerLabel,
              style:
                l.speaker === 'A'
                  ? 'Warm, gentle, conversational tone, clear English pronunciation'
                  : 'Bright, sincere, expressive conversational tone, clear English pronunciation',
            },
          ],
        };
      });

      const interaction = await runWithTtsRetry(() =>
        ai.interactions.create({
          model: 'gemini-3.8-flash-tts',
          input: inputParts,
          response_format: { type: 'audio' },
          generation_config: {
            speech_config: {
              speakers: [
                {
                  speaker: charA,
                  voice: 'Charon',
                },
                {
                  speaker: charB,
                  voice: 'Kore',
                },
              ],
            },
          },
        })
      );

      base64Audio = interaction.output_audio?.data;
    } else {
      const singleSpeaker = hasA ? 'A' : 'B';
      const combinedText = lines.map((l) => l.text.trim()).join(' ');
      const interaction = await runWithTtsRetry(() =>
        ai.interactions.create({
          model: 'gemini-3.8-flash-lite-tts',
          input: [
            {
              type: 'text',
              text: combinedText,
              annotations: [
                {
                  type: 'speech_metadata',
                  style:
                    singleSpeaker === 'A'
                      ? 'Calm, warm, thoughtful male conversational English for learners'
                      : 'Expressive, friendly, clear female conversational English for learners',
                },
              ],
            },
          ],
          response_format: { type: 'audio' },
          generation_config: {
            speech_config: [
              {
                language: 'en-US',
                voice: singleSpeaker === 'A' ? 'Charon' : 'Kore',
              },
            ],
          },
        })
      );

      base64Audio = interaction.output_audio?.data;
    }

    if (!base64Audio) {
      return res.status(502).json({ error: 'TTS model did not return audio data.' });
    }

    const wavBuffer = Buffer.from(base64Audio, 'base64');
    // Parse WAV byteRate from header (offset 28, uint32 LE) with 48000 fallback (24kHz * 1ch * 16bit)
    const byteRate =
      wavBuffer.length >= 32 ? wavBuffer.readUInt32LE(28) || 48000 : 48000;
    const dataBytes = Math.max(0, wavBuffer.length - 44);
    const durationSec = Number((dataBytes / byteRate).toFixed(2));

    return res.json({
      audioDataUrl: `data:audio/wav;base64,${base64Audio}`,
      durationSec,
    });
  } catch (err) {
    return handleGeminiError(err, res);
  }
});

async function startServer() {
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Shall we play?] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
