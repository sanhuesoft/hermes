import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import type { SynthesizeRequest } from '@/types/tts';

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as SynthesizeRequest;
    const { text, voiceId } = body;

    if (!text || !voiceId) {
      return Response.json(
        { error: 'Se requieren los campos "text" y "voiceId"' },
        { status: 400 }
      );
    }

    const tts = new MsEdgeTTS();
    await tts.setMetadata(voiceId, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);

    // Recolectar todos los chunks del stream en un Buffer
    const chunks: Buffer[] = [];
    const readable = tts.toStream(text);

    await new Promise<void>((resolve, reject) => {
      readable.audioStream.on('data', (chunk: Buffer) => chunks.push(chunk));
      readable.audioStream.on('end', resolve);
      readable.audioStream.on('error', reject);
    });

    const audioBuffer = Buffer.concat(chunks);

    return new Response(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': String(audioBuffer.byteLength),
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('[TTS Synthesize] Error:', error);
    return Response.json(
      { error: 'Error al sintetizar el audio' },
      { status: 500 }
    );
  }
}
