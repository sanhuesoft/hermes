'use client';

import { useEffect, useRef } from 'react';
import { useTtsStore } from '@/stores/useTtsStore';
import { synthesizeSpeech } from '@/lib/tts/edge-tts-client';

export default function TtsControls() {
  const {
    status,
    activeParagraphIndex,
    paragraphs,
    selectedVoice,
    chapterTitle,
    setStatus,
    setError,
    nextParagraph,
    prevParagraph,
    stop,
  } = useTtsStore();

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentBlobUrl = useRef<string | null>(null);
  const playIdRef = useRef<number>(0);

  const playCurrent = async (indexToPlay: number) => {
    if (!selectedVoice || paragraphs.length === 0) return;
    
    const currentText = paragraphs[indexToPlay];
    if (!currentText) {
      stop();
      return;
    }

    // Usamos un ID para ignorar promesas si el usuario cambia de párrafo rápido
    const currentPlayId = ++playIdRef.current;

    // Chunking inteligente a nivel reproductor
    let textChunks: string[] = [];
    if (currentText.length > 200) {
      const sentences = currentText.match(/[^.!?]+[.!?]+(\s|$)/g);
      if (sentences && sentences.length > 1) {
        textChunks = sentences.map(s => s.trim()).filter(s => s.length > 0);
      } else {
        textChunks = [currentText];
      }
    } else {
      textChunks = [currentText];
    }

    try {
      console.log(`[TTS] Reproduciendo párrafo ${indexToPlay} (dividido en ${textChunks.length} fragmentos)...`);
      
      for (let i = 0; i < textChunks.length; i++) {
        if (playIdRef.current !== currentPlayId) return;

        setStatus('loading');
        const chunkText = textChunks[i];
        const blobUrl = await synthesizeSpeech(chunkText, selectedVoice.ShortName);
        
        if (playIdRef.current !== currentPlayId) {
          URL.revokeObjectURL(blobUrl);
          return;
        }

        if (currentBlobUrl.current) URL.revokeObjectURL(currentBlobUrl.current);
        currentBlobUrl.current = blobUrl;

        const audio = new Audio(blobUrl);
        audioRef.current = audio;

        setStatus('playing');
        
        await new Promise<void>((resolve, reject) => {
          audio.onended = () => { resolve(); };
          audio.onerror = (e) => { reject(e); };
          audio.play().catch(reject);
        });
      }

      // Todos los chunks terminaron
      if (playIdRef.current !== currentPlayId) return;
      
      console.log('[TTS] Audio finalizado, avanzando al siguiente...');
      if (indexToPlay < paragraphs.length - 1) {
        nextParagraph();
        playCurrent(indexToPlay + 1);
      } else {
        stop();
      }

    } catch (err) {
      if (playIdRef.current !== currentPlayId) return;
      console.error('[TTS] Excepción capturada:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido');
    }
  };

  const handlePlay = () => {
    if (paragraphs.length === 0 || !selectedVoice) return;
    playCurrent(activeParagraphIndex);
  };

  const handlePause = () => {
    playIdRef.current++; // cancel pending fetches
    audioRef.current?.pause();
    setStatus('paused');
  };

  const handleResume = () => {
    if (audioRef.current) {
      audioRef.current.play();
      setStatus('playing');
    } else {
      playCurrent(activeParagraphIndex);
    }
  };

  const handleStop = () => {
    playIdRef.current++;
    audioRef.current?.pause();
    if (currentBlobUrl.current) {
      URL.revokeObjectURL(currentBlobUrl.current);
      currentBlobUrl.current = null;
    }
    stop();
  };

  const handlePrev = () => {
    playIdRef.current++;
    audioRef.current?.pause();
    prevParagraph();
    // Use timeout to allow state to update, or just use calculated index
    const prevIdx = activeParagraphIndex > 0 ? activeParagraphIndex - 1 : 0;
    if (status === 'playing' || status === 'loading') {
      playCurrent(prevIdx);
    }
  };

  const handleNext = () => {
    playIdRef.current++;
    audioRef.current?.pause();
    nextParagraph();
    const nextIdx = activeParagraphIndex < paragraphs.length - 1 ? activeParagraphIndex + 1 : activeParagraphIndex;
    if (status === 'playing' || status === 'loading') {
      playCurrent(nextIdx);
    }
  };

  const isDisabled = paragraphs.length === 0 || !selectedVoice;
  const isLoading = status === 'loading';

  return (
    <div className="tts-controls" aria-label="Controles de lectura en voz alta">
      {/* Párrafo activo / estado */}
      <span className="tts-controls__status" title={chapterTitle || 'Leyendo'}>
        {isDisabled
          ? 'Selecciona una voz para comenzar'
          : status === 'error'
          ? 'Error de síntesis'
          : status === 'loading'
          ? 'Cargando audio…'
          : `${chapterTitle ? chapterTitle + ' - ' : ''}Párrafo ${activeParagraphIndex + 1} / ${paragraphs.length}`}
      </span>

      {/* Botones de control */}
      <div className="tts-controls__buttons">
        <button
          id="tts-prev-btn"
          onClick={handlePrev}
          disabled={isDisabled || activeParagraphIndex === 0}
          aria-label="Párrafo anterior"
          className="tts-btn"
        >
          ⏮
        </button>

        {status === 'idle' || status === 'error' ? (
          <button
            id="tts-play-btn"
            onClick={handlePlay}
            disabled={isDisabled}
            aria-label="Reproducir"
            className="tts-btn tts-btn--primary"
          >
            {isLoading ? '⏳' : '▶'}
          </button>
        ) : status === 'playing' || status === 'loading' ? (
          <button
            id="tts-pause-btn"
            onClick={handlePause}
            disabled={isLoading}
            aria-label="Pausar"
            className="tts-btn tts-btn--primary"
          >
            ⏸
          </button>
        ) : (
          <button
            id="tts-resume-btn"
            onClick={handleResume}
            disabled={isDisabled}
            aria-label="Reanudar"
            className="tts-btn tts-btn--primary"
          >
            ▶
          </button>
        )}

        <button
          id="tts-next-btn"
          onClick={handleNext}
          disabled={isDisabled || activeParagraphIndex >= paragraphs.length - 1}
          aria-label="Párrafo siguiente"
          className="tts-btn"
        >
          ⏭
        </button>

        <button
          id="tts-stop-btn"
          onClick={handleStop}
          disabled={status === 'idle'}
          aria-label="Detener"
          className="tts-btn"
        >
          ⏹
        </button>
      </div>
    </div>
  );
}
