'use client';

import { useState } from 'react';
import { useReaderStore } from '@/stores/useReaderStore';

interface ZenOverlayProps {
  children: React.ReactNode;
}

export default function ZenOverlay({ children }: ZenOverlayProps) {
  const [panelOpen, setPanelOpen] = useState(false);
  const { isZenMode, toggleZenMode } = useReaderStore();

  return (
    <>
      {children}

      {/* Botón flotante Zen */}
      {isZenMode && (
        <div className="zen-fab-wrapper">
          <button
            id="zen-fab-btn"
            onClick={() => setPanelOpen((v) => !v)}
            aria-label="Abrir controles"
            className="zen-fab"
          >
            <span className="zen-fab-icon">
              {panelOpen ? '✕' : '⋯'}
            </span>
          </button>

          {/* Panel flotante */}
          {panelOpen && (
            <div className="zen-panel" role="dialog" aria-label="Controles Zen">
              <button
                id="zen-exit-btn"
                onClick={() => { toggleZenMode(); setPanelOpen(false); }}
                className="zen-panel-btn"
              >
                Salir del modo Zen
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
