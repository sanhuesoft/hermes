'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { LoaderCircle, Pause, Play, SkipBack, SkipForward, Square, Settings2, X } from 'lucide-react';
import { useTtsStore } from '@/stores/useTtsStore';
import { synthesizeSpeech } from '@/lib/tts/edge-tts-client';
import { splitIntoSentences } from '@/lib/epub/parser';
import VoiceSelector from './VoiceSelector';

export default function TtsControls() {
  const {
    status,
    activeParagraphIndex,
    pendingJumpIndex,
    paragraphs,
    selectedVoice,
    chapterTitle,
    playbackRate,
    setStatus,
    setError,
    nextParagraph,
    prevParagraph,
    stop,
    clearJump,
    setPlaybackRate,
  } = useTtsStore();

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentBlobUrl = useRef<string | null>(null);
  const playIdRef = useRef<number>(0);
  const [showSettings, setShowSettings] = useState(false);

  // Caché de precarga de párrafos: almacena pares [index, blobUrls[]]
  const prefetchedCache = useRef<Map<number, string[]>>(new Map());
  const activePrefetching = useRef<Set<number>>(new Set());

  // Limpiar toda la caché de precarga
  const clearPrefetchCache = useCallback(() => {
    prefetchedCache.current.forEach((urls) => {
      urls.forEach((url) => {
        try {
          URL.revokeObjectURL(url);
        } catch (e) {
          console.warn('Error revoking cached URL:', e);
        }
      });
    });
    prefetchedCache.current.clear();
    activePrefetching.current.clear();
  }, []);

  // Limpiar caché cuando cambie la voz o los párrafos de capítulo
  useEffect(() => {
    clearPrefetchCache();
  }, [selectedVoice, paragraphs, clearPrefetchCache]);

  // Limpiar al desmontar el componente
  useEffect(() => {
    return () => {
      clearPrefetchCache();
    };
  }, [clearPrefetchCache]);

  // Precargar un solo párrafo
  const prefetchParagraph = async (index: number, voiceId: string, currentPlayId: number) => {
    if (index >= paragraphs.length || index < 0) return;
    if (prefetchedCache.current.has(index)) return;
    if (activePrefetching.current.has(index)) return;

    activePrefetching.current.add(index);

    try {
      const text = paragraphs[index];
      if (!text) {
        activePrefetching.current.delete(index);
        return;
      }

      // Chunking idéntico al de reproducción
      let textChunks: string[] = [];
      if (text.length > 200) {
        const sentences = text.match(/[^.!?]+[.!?]+(\s|$)/g);
        if (sentences && sentences.length > 1) {
          textChunks = sentences.map(s => s.trim()).filter(s => s.length > 0);
        } else {
          textChunks = [text];
        }
      } else {
        textChunks = [text];
      }

      const urls: string[] = [];
      for (const chunk of textChunks) {
        if (playIdRef.current !== currentPlayId) {
          urls.forEach(URL.revokeObjectURL);
          activePrefetching.current.delete(index);
          return;
        }
        const url = await synthesizeSpeech(chunk, voiceId);
        urls.push(url);
      }

      if (playIdRef.current === currentPlayId) {
        prefetchedCache.current.set(index, urls);
        console.log(`[TTS Prefetch] Párrafo ${index} precargado exitosamente con ${urls.length} fragmentos.`);
      } else {
        urls.forEach(URL.revokeObjectURL);
      }
    } catch (err) {
      console.error(`[TTS Prefetch] Error al precargar párrafo ${index}:`, err);
    } finally {
      activePrefetching.current.delete(index);
    }
  };

  // Precargar secuencialmente los próximos 5 párrafos
  const prefetchNextParagraphs = async (currentIndex: number, voiceId: string, currentPlayId: number) => {
    for (let offset = 1; offset <= 5; offset++) {
      const targetIndex = currentIndex + offset;
      if (targetIndex >= paragraphs.length) break;
      if (playIdRef.current !== currentPlayId) break;
      await prefetchParagraph(targetIndex, voiceId, currentPlayId);
    }
  };

  // ----------------------------------------------------------
  // Reaccionar a click de párrafo (jumpToParagraph del store)
  // ----------------------------------------------------------
  useEffect(() => {
    if (pendingJumpIndex === null) return;

    // Cancelar reproducción actual e invalidar caché de precarga para evitar desincronizaciones
    playIdRef.current++;
    clearPrefetchCache();

    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.playbackRate = playbackRate;
    } else {
      audioRef.current.pause();
      audioRef.current.playbackRate = playbackRate;
    }
    if (currentBlobUrl.current) {
      URL.revokeObjectURL(currentBlobUrl.current);
      currentBlobUrl.current = null;
    }

    const idx = pendingJumpIndex;
    clearJump();

    // Si estaba reproduciendo, continuar desde el nuevo párrafo;
    // si estaba pausado/idle, sólo posicionar (el usuario decide reproducir).
    if (status === 'playing' || status === 'loading') {
      setStatus('loading');
      playCurrent(idx);
    } else {
      setStatus('idle');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingJumpIndex, clearPrefetchCache]);

  const playCurrent = useCallback(async (indexToPlay: number) => {
    if (!selectedVoice || paragraphs.length === 0) return;
    
    const currentText = paragraphs[indexToPlay];
    if (!currentText) {
      stop();
      return;
    }

    // Usamos un ID para ignorar promesas si el usuario cambia de párrafo rápido
    const currentPlayId = ++playIdRef.current;

    // Disparar precarga en segundo plano de los siguientes 5 párrafos
    prefetchNextParagraphs(indexToPlay, selectedVoice.ShortName, currentPlayId);

    // Chunking inteligente a nivel reproductor: dividimos SIEMPRE por frases para mejor usabilidad
    let textChunks: string[] = splitIntoSentences(currentText);

    try {
      let blobUrls: string[] = [];
      const cachedUrls = prefetchedCache.current.get(indexToPlay);

      if (cachedUrls && cachedUrls.length === textChunks.length) {
        console.log(`[TTS Cache] Usando audio precargado para el párrafo ${indexToPlay}.`);
        blobUrls = cachedUrls;
        prefetchedCache.current.delete(indexToPlay);
      } else {
        console.log(`[TTS] Iniciando síntesis del párrafo ${indexToPlay} (${textChunks.length} fragmentos)...`);
        setStatus('loading');

        // Para evitar esperas entre frases, disparamos la síntesis de todos los fragmentos
        // de forma concurrente en segundo plano.
        const synthesisPromises = textChunks.map(chunk => 
          synthesizeSpeech(chunk, selectedVoice.ShortName)
        );

        const startSentenceIndex = useTtsStore.getState().activeSentenceIndex || 0;

        // Esperamos la frase solicitada inmediatamente para empezar la reproducción sin demoras
        const firstUrl = await synthesisPromises[startSentenceIndex];
        if (playIdRef.current !== currentPlayId) {
          firstUrl && URL.revokeObjectURL(firstUrl);
          synthesisPromises.forEach(async p => {
            try { const url = await p; URL.revokeObjectURL(url); } catch {}
          });
          return;
        }

        // Reasignamos el array en orden
        blobUrls[startSentenceIndex] = firstUrl;

        // Resolver las demás promesas en paralelo en segundo plano
        // y agregarlas a blobUrls a medida que estén listas
        Promise.all(synthesisPromises).then(urls => {
          if (playIdRef.current === currentPlayId) {
            urls.forEach((url, i) => {
              if (i !== startSentenceIndex) blobUrls[i] = url;
            });
          } else {
            urls.forEach(url => { if (url) URL.revokeObjectURL(url); });
          }
        }).catch(err => {
          console.error('[TTS] Error en síntesis paralela:', err);
        });
      }

      // Pre-cargamos los elementos de Audio para que el cambio de frase sea instantáneo
      const audioElements: (HTMLAudioElement | null)[] = [];
      const startSentenceIndex = useTtsStore.getState().activeSentenceIndex || 0;

      for (let i = startSentenceIndex; i < textChunks.length; i++) {
        if (playIdRef.current !== currentPlayId) {
          blobUrls.forEach(URL.revokeObjectURL);
          return;
        }

        // Si la URL del fragmento i aún no está lista, hacemos un polling corto
        let blobUrl = blobUrls[i];
        if (!blobUrl) {
          setStatus('loading');
          while (!blobUrls[i] && playIdRef.current === currentPlayId) {
            await new Promise(r => setTimeout(r, 50));
          }
          blobUrl = blobUrls[i];
          if (playIdRef.current !== currentPlayId) {
            blobUrls.forEach(URL.revokeObjectURL);
            return;
          }
        }

        setStatus('playing');
        useTtsStore.getState().setActiveSentenceIndex(i);

        // Instanciar y pre-cargar el Audio del fragmento actual
        let audio = audioElements[i];
        if (!audio) {
          audio = new Audio(blobUrl);
          audio.preload = 'auto';
          audio.playbackRate = playbackRate;
          audioElements[i] = audio;
        }

        // Pre-cargar el siguiente fragmento de forma proactiva
        const nextUrl = blobUrls[i + 1];
        if (nextUrl && !audioElements[i + 1]) {
          const nextAudio = new Audio(nextUrl);
          nextAudio.preload = 'auto';
          nextAudio.playbackRate = playbackRate;
          audioElements[i + 1] = nextAudio;
        }

        audioRef.current = audio;

        if (currentBlobUrl.current && currentBlobUrl.current !== blobUrl) {
          if (!cachedUrls) {
            URL.revokeObjectURL(currentBlobUrl.current);
          }
        }
        currentBlobUrl.current = blobUrl;

        await new Promise<void>((resolve, reject) => {
          audio!.onended = () => { resolve(); };
          audio!.onerror = (e) => { reject(e); };
          audio!.play().catch(reject);
        });
      }

      // Todos los chunks terminaron
      if (playIdRef.current !== currentPlayId) return;
      
      console.log('[TTS] Párrafo finalizado, avanzando al siguiente...');
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
  }, [selectedVoice, paragraphs, setStatus, prefetchNextParagraphs, nextParagraph, stop, setError, playbackRate]);

  const handlePlay = useCallback(() => {
    if (paragraphs.length === 0 || !selectedVoice) return;
    playCurrent(activeParagraphIndex);
  }, [paragraphs.length, selectedVoice, playCurrent, activeParagraphIndex]);

  const handlePause = useCallback(() => {
    playIdRef.current++; // cancel pending fetches
    audioRef.current?.pause();
    setStatus('paused');
  }, [setStatus]);

  const handleResume = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
      audioRef.current.play().catch(e => {
        console.warn('Error resuming audio:', e);
        setStatus('error');
      });
      setStatus('playing');
    } else {
      handlePlay();
    }
  }, [handlePlay, setStatus, playbackRate]);

  // Aplicar cambios de velocidad al vuelo
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  const handleStop = useCallback(() => {
    playIdRef.current++;
    audioRef.current?.pause();
    if (currentBlobUrl.current) {
      URL.revokeObjectURL(currentBlobUrl.current);
      currentBlobUrl.current = null;
    }
    stop();
  }, [stop]);

  const handlePrev = useCallback(() => {
    playIdRef.current++;
    audioRef.current?.pause();
    prevParagraph();
    const prevIdx = activeParagraphIndex > 0 ? activeParagraphIndex - 1 : 0;
    if (status === 'playing' || status === 'loading') {
      playCurrent(prevIdx);
    }
  }, [prevParagraph, activeParagraphIndex, status, playCurrent]);

  const handleNext = useCallback(() => {
    playIdRef.current++;
    audioRef.current?.pause();
    nextParagraph();
    const nextIdx = activeParagraphIndex < paragraphs.length - 1 ? activeParagraphIndex + 1 : activeParagraphIndex;
    if (status === 'playing' || status === 'loading') {
      playCurrent(nextIdx);
    }
  }, [nextParagraph, activeParagraphIndex, paragraphs.length, status, playCurrent]);

  // Escuchar evento personalizado para reproducir/pausar con la tecla Espacio
  useEffect(() => {
    const handleToggle = () => {
      if (paragraphs.length === 0 || !selectedVoice) return;
      if (status === 'playing' || status === 'loading') {
        handlePause();
      } else if (status === 'paused') {
        handleResume();
      } else {
        handlePlay();
      }
    };

    window.addEventListener('toggle-tts', handleToggle);
    return () => window.removeEventListener('toggle-tts', handleToggle);
  }, [status, paragraphs.length, selectedVoice, handlePlay, handlePause, handleResume]);

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
          <SkipBack size={17} aria-hidden="true" />
        </button>

        {status === 'idle' || status === 'error' ? (
          <button
            id="tts-play-btn"
            onClick={handlePlay}
            disabled={isDisabled}
            aria-label="Reproducir"
            className="tts-btn tts-btn--primary"
          >
            {isLoading ? (
              <LoaderCircle className="icon-spin" size={18} aria-hidden="true" />
            ) : (
              <Play size={18} fill="currentColor" aria-hidden="true" />
            )}
          </button>
        ) : status === 'playing' || status === 'loading' ? (
          <button
            id="tts-pause-btn"
            onClick={handlePause}
            disabled={isLoading}
            aria-label="Pausar"
            className="tts-btn tts-btn--primary"
          >
            {isLoading ? (
              <LoaderCircle className="icon-spin" size={18} aria-hidden="true" />
            ) : (
              <Pause size={18} fill="currentColor" aria-hidden="true" />
            )}
          </button>
        ) : (
          <button
            id="tts-resume-btn"
            onClick={handleResume}
            disabled={isDisabled}
            aria-label="Reanudar"
            className="tts-btn tts-btn--primary"
          >
            <Play size={18} fill="currentColor" aria-hidden="true" />
          </button>
        )}

        <button
          id="tts-next-btn"
          onClick={handleNext}
          disabled={isDisabled || activeParagraphIndex >= paragraphs.length - 1}
          aria-label="Párrafo siguiente"
          className="tts-btn"
        >
          <SkipForward size={17} aria-hidden="true" />
        </button>

        <button
          id="tts-stop-btn"
          onClick={handleStop}
          disabled={status === 'idle'}
          aria-label="Detener"
          className="tts-btn"
        >
          <Square size={15} fill="currentColor" aria-hidden="true" />
        </button>

        <button
          onClick={() => setShowSettings(!showSettings)}
          aria-label="Ajustes de voz"
          className={`tts-btn ${showSettings ? 'tts-btn--active' : ''}`}
          style={{ marginLeft: '0.25rem' }}
        >
          <Settings2 size={17} aria-hidden="true" />
        </button>
      </div>

      {/* Popover de Ajustes TTS */}
      {showSettings && (
        <div className="tts-settings-popup">
          <div className="tts-settings-header">
            <span className="tts-settings-title">Ajustes de Voz</span>
            <button className="tts-settings-close" onClick={() => setShowSettings(false)}>
              <X size={16} />
            </button>
          </div>
          
          <div className="tts-setting-row">
            <span className="tts-setting-label">Voz</span>
            <VoiceSelector />
          </div>

          <div className="tts-setting-row">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="tts-setting-label">Velocidad</span>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                {playbackRate}x
              </span>
            </div>
            <input
              type="range"
              min="0.5"
              max="2.5"
              step="0.1"
              value={playbackRate}
              onChange={(e) => setPlaybackRate(parseFloat(e.target.value))}
              style={{ accentColor: 'var(--color-accent)', width: '100%', cursor: 'pointer' }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
