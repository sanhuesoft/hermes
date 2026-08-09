import { MsEdgeTTS } from 'msedge-tts';
import type { Voice } from '@/types/tts';

const ALLOWED_VOICE_PREFIXES = ['es-CL-', 'en-US-'];

export async function GET(): Promise<Response> {
  try {
    const tts = new MsEdgeTTS();
    const allVoices = await tts.getVoices();

    const filteredVoices: Voice[] = allVoices
      .filter((voice) =>
        ALLOWED_VOICE_PREFIXES.some((prefix) => voice.ShortName.startsWith(prefix))
      )
      .map((voice) => ({
        ShortName: voice.ShortName,
        FriendlyName: voice.FriendlyName,
        Gender: voice.Gender as 'Female' | 'Male',
        Locale: voice.Locale,
      }));

    return Response.json(filteredVoices);
  } catch (error) {
    console.error('[TTS Voices] Error:', error);
    return Response.json(
      { error: 'No se pudo obtener la lista de voces' },
      { status: 500 }
    );
  }
}
