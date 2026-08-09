import type { Voice } from '@/types/tts';

/**
 * Obtiene la lista de voces TTS filtradas (es-CL y en-US) desde el API route.
 */
export async function fetchVoices(): Promise<Voice[]> {
  const res = await fetch('/api/tts/voices');
  if (!res.ok) {
    throw new Error(`Error al obtener voces: ${res.statusText}`);
  }
  return res.json() as Promise<Voice[]>;
}

/**
 * Sintetiza texto en audio MP3 y retorna la URL del blob de audio.
 * El audio se genera en el servidor (msedge-tts) y se transmite como stream.
 */
export async function synthesizeSpeech(
  text: string,
  voiceId: string
): Promise<string> {
  const res = await fetch('/api/tts/synthesize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voiceId }),
  });

  if (!res.ok) {
    throw new Error(`Error en síntesis: ${res.statusText}`);
  }

  const audioBlob = await res.blob();
  return URL.createObjectURL(audioBlob);
}
