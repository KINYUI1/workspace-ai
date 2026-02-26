import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/async-handler';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { TTSService } from '../../core/system-integration/tts.service';

const router = Router();
const ttsService = new TTSService(process.env.OPENAI_API_KEY);

router.use(authenticate);

const synthesizeSchema = z.object({
  text: z.string().min(1).max(5000),
  voice: z.string().optional().default('en-US-AriaNeural'),
  rate: z.string().optional().default('+0%'),
  pitch: z.string().optional().default('+0Hz'),
  provider: z.enum(['openai', 'edge', 'auto']).optional().default('auto'),
});

/**
 * POST /api/tts/synthesize
 * Convert text to speech. Tries OpenAI TTS first (if key configured), falls back to Edge TTS.
 * Returns MP3 audio buffer.
 */
router.post(
  '/synthesize',
  validate(synthesizeSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { text, voice, rate, pitch, provider } = req.body;

    const result = await ttsService.synthesize(text, { voice, rate, pitch, provider });

    res.set({
      'Content-Type': result.contentType,
      'Content-Length': result.buffer.length.toString(),
      'X-TTS-Provider': result.provider,
      'Cache-Control': 'public, max-age=86400',
    });
    res.send(result.buffer);
  }),
);

/**
 * GET /api/tts/voices
 * List available TTS voices grouped by provider.
 */
router.get(
  '/voices',
  asyncHandler(async (_req: Request, res: Response) => {
    res.json(ttsService.getAvailableVoices());
  }),
);

export { router as ttsRouter };
