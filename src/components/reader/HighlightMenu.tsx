'use client';

import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import type { HighlightColor } from '@/types/epub';

interface HighlightMenuProps {
  cfiRange: string;
  selectedText: string;
  position?: { x: number; y: number };
  onConfirm: (color: HighlightColor, note?: string) => void;
  onCancel: () => void;
}

const COLORS: { id: HighlightColor; label: string; bg: string }[] = [
  { id: 'yellow', label: 'Amarillo', bg: '#ffc701' },
  { id: 'green',  label: 'Verde',    bg: '#c7e372' },
  { id: 'blue',   label: 'Azul',     bg: '#9ad0dc' },
  { id: 'pink',   label: 'Rosa',     bg: '#ef5a68' },
];

export default function HighlightMenu({
  selectedText,
  position,
  onConfirm,
  onCancel,
}: HighlightMenuProps) {
  const [selectedColor, setSelectedColor] = useState<HighlightColor>('yellow');
  const [note, setNote] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPosition, setMenuPosition] = useState<{ left: number; top: number } | null>(null);

  const updateMenuPosition = useCallback(() => {
    if (!position || !menuRef.current) {
      setMenuPosition(null);
      return;
    }

    const menuRect = menuRef.current.getBoundingClientRect();
    const viewportPadding = 8;
    const gap = 10;
    const halfWidth = menuRect.width / 2;
    const left = Math.min(
      window.innerWidth - halfWidth - viewportPadding,
      Math.max(halfWidth + viewportPadding, position.x)
    );
    const fitsBelow = position.y + gap + menuRect.height <= window.innerHeight - viewportPadding;
    const top = fitsBelow
      ? position.y + gap
      : Math.max(viewportPadding, position.y - menuRect.height - gap);

    setMenuPosition({ left, top });
  }, [position]);

  useLayoutEffect(() => {
    updateMenuPosition();
    window.addEventListener('resize', updateMenuPosition);
    return () => window.removeEventListener('resize', updateMenuPosition);
  }, [updateMenuPosition]);

  return (
    <div
      ref={menuRef}
      className="highlight-menu"
      role="dialog"
      aria-label="Menú de resaltado"
      style={menuPosition ? { left: menuPosition.left, top: menuPosition.top, bottom: 'auto' } : undefined}
    >
      {/* Texto seleccionado */}
      <p className="highlight-menu__preview">
        &ldquo;{selectedText.slice(0, 80)}{selectedText.length > 80 ? '…' : ''}&rdquo;
      </p>

      {/* Selector de color */}
      <div className="highlight-menu__colors" role="group" aria-label="Color de resaltado">
        {COLORS.map((color) => (
          <button
            key={color.id}
            id={`highlight-color-${color.id}`}
            onClick={() => setSelectedColor(color.id)}
            aria-label={color.label}
            aria-pressed={selectedColor === color.id}
            className="highlight-menu__color-btn"
            style={{
              backgroundColor: color.bg,
              outline: selectedColor === color.id ? '2px solid #6366f1' : 'none',
            }}
          />
        ))}
      </div>

      {/* Nota opcional */}
      <textarea
        id="highlight-note"
        className="highlight-menu__note"
        placeholder="Añadir nota (opcional)…"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={3}
      />

      {/* Acciones */}
      <div className="highlight-menu__actions">
        <button
          id="highlight-cancel-btn"
          onClick={onCancel}
          className="highlight-menu__btn highlight-menu__btn--cancel"
        >
          Cancelar
        </button>
        <button
          id="highlight-confirm-btn"
          onClick={() => onConfirm(selectedColor, note || undefined)}
          className="highlight-menu__btn highlight-menu__btn--confirm"
        >
          Guardar
        </button>
      </div>
    </div>
  );
}
