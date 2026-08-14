'use client';

import { useEffect } from 'react';
import { Columns3, Moon, Rows3, ScrollText, Sun, X, type LucideIcon } from 'lucide-react';
import { useReaderStore } from '@/stores/useReaderStore';
import type { ReaderTheme, ReaderViewMode, FontFamily } from '@/types/epub';

interface ReaderSettingsModalProps {
  open: boolean;
  onClose: () => void;
}

const THEMES: { id: ReaderTheme; label: string; icon: LucideIcon }[] = [
  { id: 'light', label: 'Claro',  icon: Sun },
  { id: 'dark',  label: 'Oscuro', icon: Moon },
  { id: 'sepia', label: 'Sepia',  icon: ScrollText },
];

const VIEW_MODES: { id: ReaderViewMode; label: string; icon: LucideIcon }[] = [
  { id: 'paginated', label: 'Páginas', icon: Columns3 },
  { id: 'continuous', label: 'Continuo', icon: Rows3 },
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
    theme, viewMode, activeColor, fontFamily, fontSize, lineHeight, marginX,
    setTheme, setViewMode, setActiveColor, setFontFamily, setFontSize, setLineHeight, setMarginX,
  } = useReaderStore();

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

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
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="settings-modal__body">
          {/* Modo de lectura */}
          <section className="settings-section">
            <h3 className="settings-section__label">Modo de lectura</h3>
            <div className="settings-section__group">
              {VIEW_MODES.map((mode) => {
                const ModeIcon = mode.icon;
                return (
                  <button
                    key={mode.id}
                    id={`view-mode-btn-${mode.id}`}
                    onClick={() => setViewMode(mode.id)}
                    aria-pressed={viewMode === mode.id}
                    className={`settings-theme-btn ${viewMode === mode.id ? 'settings-theme-btn--active' : ''}`}
                  >
                    <ModeIcon size={19} aria-hidden="true" />
                    <span>{mode.label}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Color activo */}
          <section className="settings-section">
            <h3 className="settings-section__label">
              Color activo
              <span className="settings-section__value">{activeColor.toUpperCase()}</span>
            </h3>
            <label className="settings-color-control" htmlFor="active-color-picker">
              <input
                id="active-color-picker"
                type="color"
                value={activeColor}
                onChange={(event) => setActiveColor(event.target.value)}
                className="settings-color-picker"
                aria-label="Color activo"
              />
              <span>Elegir color</span>
            </label>
          </section>

          {/* Tema */}
          <section className="settings-section">
            <h3 className="settings-section__label">Tema</h3>
            <div className="settings-section__group">
              {THEMES.map((t) => {
                const ThemeIcon = t.icon;
                return (
                <button
                  key={t.id}
                  id={`theme-btn-${t.id}`}
                  onClick={() => setTheme(t.id)}
                  aria-pressed={theme === t.id}
                  className={`settings-theme-btn ${theme === t.id ? 'settings-theme-btn--active' : ''}`}
                >
                  <ThemeIcon size={19} aria-hidden="true" />
                  <span>{t.label}</span>
                </button>
                );
              })}
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
