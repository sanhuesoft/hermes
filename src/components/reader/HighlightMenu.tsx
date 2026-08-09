'use client';

import { useState } from 'react';
import type { HighlightColor } from '@/types/epub';

interface HighlightMenuProps {
  cfiRange: string;
  selectedText: string;
  onConfirm: (color: HighlightColor, note?: string) => void;
  onCancel: () => void;
}

const COLORS: { id: HighlightColor; label: string; bg: string }[] = [
  { id: 'yellow', label: 'Amarillo', bg: '#FEF08A' },
  { id: 'green',  label: 'Verde',    bg: '#BBF7D0' },
  { id: 'blue',   label: 'Azul',     bg: '#BFDBFE' },
  { id: 'pink',   label: 'Rosa',     bg: '#FBCFE8' },
];

export default function HighlightMenu({
  selectedText,
  onConfirm,
  onCancel,
}: HighlightMenuProps) {
  const [selectedColor, setSelectedColor] = useState<HighlightColor>('yellow');
  const [note, setNote] = useState('');

  return (
    <div className="highlight-menu" role="dialog" aria-label="Menú de resaltado">
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
