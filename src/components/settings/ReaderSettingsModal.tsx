'use client';

import { useReaderStore } from '@/stores/useReaderStore';
import type { ReaderTheme, FontFamily } from '@/types/epub';

interface ReaderSettingsModalProps {
  open: boolean;
  onClose: () => void;
}

const THEMES: { id: ReaderTheme; label: string; icon: string }[] = [
  { id: 'light', label: 'Claro',  icon: '☀️' },
  { id: 'dark',  label: 'Oscuro', icon: '🌙' },
  { id: 'sepia', label: 'Sepia',  icon: '📜' },
];

const FONTS: { id: FontFamily; label: string; preview: string }[] = [
  { id: 'inter',         label: 'Inter',          preview: 'Aa' },
  { id: 'merriweather',  label: 'Merriweather',   preview: 'Aa' },
  { id: 'garamond',      label: 'EB Garamond',    preview: 'Aa' },
  { id: 'mono',          label: 'Monospace',       preview: 'Aa' },
  { id: 'opendyslexic',  label: 'OpenDyslexic',   preview: 'Aa' },
];

const LINE_HEIGHTS = [1.2, 1.5, 1.8, 2.0];

export default function ReaderSettingsModal({ open, onClose }: ReaderSettingsModalProps) {
  const {
    theme, fontFamily, fontSize, lineHeight, marginX,
    setTheme, setFontFamily, setFontSize, setLineHeight, setMarginX,
  } = useReaderStore();

  if (!open) return null;

  return (
    <div
      className="settings-modal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Configuración del lector"
    >
      <div
        className="settings-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="settings-modal__header">
          <h2 className="settings-modal__title">Ajustes de lectura</h2>
          <button
            id="settings-close-btn"
            onClick={onClose}
            aria-label="Cerrar"
            className="settings-modal__close"
          >
            ✕
          </button>
        </div>

        <div className="settings-modal__body">
          {/* Tema */}
          <section className="settings-section">
            <h3 className="settings-section__label">Tema</h3>
            <div className="settings-section__group">
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  id={`theme-btn-${t.id}`}
                  onClick={() => setTheme(t.id)}
                  aria-pressed={theme === t.id}
                  className={`settings-theme-btn ${theme === t.id ? 'settings-theme-btn--active' : ''}`}
                >
                  <span>{t.icon}</span>
                  <span>{t.label}</span>
                </button>
              ))}
            </div>
          </section>

          {/* Fuente */}
          <section className="settings-section">
            <h3 className="settings-section__label">Fuente</h3>
            <div className="settings-section__group settings-section__group--fonts">
              {FONTS.map((f) => (
                <button
                  key={f.id}
                  id={`font-btn-${f.id}`}
                  onClick={() => setFontFamily(f.id)}
                  aria-pressed={fontFamily === f.id}
                  className={`settings-font-btn ${fontFamily === f.id ? 'settings-font-btn--active' : ''}`}
                >
                  <span className="settings-font-btn__preview">{f.preview}</span>
                  <span className="settings-font-btn__label">{f.label}</span>
                </button>
              ))}
            </div>
          </section>

          {/* Tamaño de fuente */}
          <section className="settings-section">
            <h3 className="settings-section__label">
              Tamaño de fuente
              <span className="settings-section__value">{fontSize}px</span>
            </h3>
            <input
              id="font-size-slider"
              type="range"
              min={12}
              max={32}
              step={1}
              value={fontSize}
              onChange={(e) => setFontSize(Number(e.target.value))}
              className="settings-slider"
              aria-label="Tamaño de fuente"
            />
          </section>

          {/* Interlineado */}
          <section className="settings-section">
            <h3 className="settings-section__label">Interlineado</h3>
            <div className="settings-section__group">
              {LINE_HEIGHTS.map((lh) => (
                <button
                  key={lh}
                  id={`lineheight-btn-${lh}`}
                  onClick={() => setLineHeight(lh)}
                  aria-pressed={lineHeight === lh}
                  className={`settings-tag-btn ${lineHeight === lh ? 'settings-tag-btn--active' : ''}`}
                >
                  {lh}×
                </button>
              ))}
            </div>
          </section>

          {/* Márgenes */}
          <section className="settings-section">
            <h3 className="settings-section__label">
              Márgenes
              <span className="settings-section__value">{marginX}%</span>
            </h3>
            <input
              id="margin-slider"
              type="range"
              min={0}
              max={25}
              step={1}
              value={marginX}
              onChange={(e) => setMarginX(Number(e.target.value))}
              className="settings-slider"
              aria-label="Márgenes horizontales"
            />
          </section>
        </div>
      </div>
    </div>
  );
}
