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
        if (loaded.length > 0 && !selectedVoice) {
          // Preseleccionar la primera voz es-CL
          const defaultVoice =
            loaded.find((v) => v.ShortName.startsWith('es-CL-')) ?? loaded[0];
          setSelectedVoice(defaultVoice);
        }
      })
      .catch(console.error);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const grouped = {
    'Español (Chile)': voices.filter((v) => v.Locale === 'es-CL'),
    'English (US)':    voices.filter((v) => v.Locale === 'en-US'),
  };

  return (
    <div className="voice-selector">
      <label htmlFor="voice-select" className="voice-selector__label">
        Voz
      </label>
      <select
        id="voice-select"
        className="voice-selector__select"
        value={selectedVoice?.ShortName ?? ''}
        onChange={(e) => {
          const voice = voices.find((v) => v.ShortName === e.target.value);
          if (voice) setSelectedVoice(voice);
        }}
        disabled={voices.length === 0}
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
                  {' '}({voice.Gender === 'Female' ? '♀' : '♂'})
                </option>
              ))}
            </optgroup>
          ) : null
        )}
      </select>
    </div>
  );
}
