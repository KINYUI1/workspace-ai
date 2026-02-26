import { EdgeTTS } from '@andresaya/edge-tts';
import OpenAI from 'openai';
import { logger } from '../../utils/logger';

interface TTSOptions {
  voice?: string;
  rate?: string;
  pitch?: string;
  provider?: 'openai' | 'edge' | 'auto';
}

interface TTSResult {
  buffer: Buffer;
  provider: string;
  contentType: string;
}

const VOICE_MAP: Record<string, string> = {
  'en-US-AriaNeural': 'nova',
  'en-US-GuyNeural': 'onyx',
  'en-US-JennyNeural': 'shimmer',
  'en-GB-SoniaNeural': 'fable',
};

export class TTSService {
  private openai: OpenAI | null = null;

  constructor(openaiApiKey?: string) {
    if (openaiApiKey) {
      this.openai = new OpenAI({ apiKey: openaiApiKey });
    }
  }

  async synthesize(text: string, options: TTSOptions = {}): Promise<TTSResult> {
    const provider = options.provider || 'auto';

    if (provider === 'openai' || (provider === 'auto' && this.openai)) {
      try {
        return await this.synthesizeOpenAI(text, options);
      } catch (err) {
        logger.warn('OpenAI TTS failed, falling back to Edge TTS', { error: (err as Error).message });
        if (provider === 'openai') throw err;
      }
    }

    return this.synthesizeEdge(text, options);
  }

  private async synthesizeOpenAI(text: string, options: TTSOptions): Promise<TTSResult> {
    if (!this.openai) throw new Error('OpenAI API key not configured');

    const openaiVoice = VOICE_MAP[options.voice || ''] || 'nova';

    const response = await this.openai.audio.speech.create({
      model: 'tts-1',
      voice: openaiVoice as 'nova' | 'onyx' | 'shimmer' | 'fable' | 'alloy' | 'echo',
      input: text.slice(0, 4096),
      response_format: 'mp3',
    });

    const arrayBuffer = await response.arrayBuffer();
    return {
      buffer: Buffer.from(arrayBuffer),
      provider: 'openai',
      contentType: 'audio/mpeg',
    };
  }

  private async synthesizeEdge(text: string, options: TTSOptions): Promise<TTSResult> {
    const tts = new EdgeTTS();
    await tts.synthesize(text, options.voice || 'en-US-AriaNeural', {
      rate: options.rate || '+0%',
      pitch: options.pitch || '+0Hz',
    });
    const buffer = await tts.toBuffer();
    return {
      buffer,
      provider: 'edge',
      contentType: 'audio/mpeg',
    };
  }

  getAvailableVoices(): { provider: string; voices: string[] }[] {
    const result: { provider: string; voices: string[] }[] = [
      { provider: 'edge', voices: ['en-US-AriaNeural', 'en-US-GuyNeural', 'en-US-JennyNeural', 'en-GB-SoniaNeural'] },
    ];
    if (this.openai) {
      result.unshift({
        provider: 'openai',
        voices: ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'],
      });
    }
    return result;
  }
}
