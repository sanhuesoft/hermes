'use client';

import { useEffect } from 'react';
import { useTtsStore } from '@/stores/useTtsStore';
import { fetchVoices } from '@/lib/tts/edge-tts-client';

export default function VoiceSelector() {
  const { voices, selectedVoice, setVoices, setSelectedVoice } = useTtsStore();

  // Cargar voces al montar
  useEffect(() => {
    if (voices.length > 0) return;

    fetchVoices()
      .then((loaded) => {
        setVoices(loaded);
        // La autoselección se manejará en el store
      })
      .catch(console.error);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Agrupar dinámicamente por Locale (es-CL, en-US, etc.)
  const grouped = voices.reduce((acc, voice) => {
    if (!acc[voice.Locale]) acc[voice.Locale] = [];
    acc[voice.Locale].push(voice);
    return acc;
  }, {} as Record<string, typeof voices>);

  return (
    <div className="voice-selector" style={{ width: '100%' }}>
      <select
        id="voice-select"
        className="voice-selector__select"
        style={{ width: '100%' }}
        value={selectedVoice?.ShortName ?? ''}
        onChange={(e) => {
          const voice = voices.find((v) => v.ShortName === e.target.value);
          if (voice) setSelectedVoice(voice);
        }}
        disabled={voices.length === 0}
        aria-label="Voz"
      >
        {voices.length === 0 && (
          <option value="">Cargando voces…</option>
        )}
        {Object.entries(grouped).map(([group, groupVoices]) =>
          groupVoices.length > 0 ? (
            <optgroup key={group} label={group}>
              {groupVoices.map((voice) => (
                <option key={voice.ShortName} value={voice.ShortName}>
                  {voice.FriendlyName.replace('Microsoft ', '').replace(' Online (Natural)', '')}
                  {' '}({voice.Gender === 'Female' ? 'mujer' : 'hombre'})
                </option>
              ))}
            </optgroup>
          ) : null
        )}
      </select>
    </div>
  );
}
