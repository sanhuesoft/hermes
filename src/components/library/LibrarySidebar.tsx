'use client';

import { useState, useRef, useEffect } from 'react';
import { useLibraryStore } from '@/stores/useLibraryStore';

export default function LibrarySidebar() {
  const {
    folders,
    books,
    selectedFolderId,
    setSelectedFolder,
    addFolder,
    renameFolder,
    removeFolder,
  } = useLibraryStore();

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [contextMenu, setContextMenu] = useState<{
    id: string;
    x: number;
    y: number;
  } | null>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  // Cerrar menú contextual al hacer clic fuera
  useEffect(() => {
    if (!contextMenu) return;
    const handle = (e: MouseEvent) => {
      if (
        contextMenuRef.current &&
        !contextMenuRef.current.contains(e.target as Node)
      ) {
        setContextMenu(null);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [contextMenu]);

  // Foco en input al renombrar
  useEffect(() => {
    if (renamingId) renameInputRef.current?.select();
  }, [renamingId]);

  const handleAddFolder = async () => {
    const folder = await addFolder('Nueva carpeta');
    setRenamingId(folder.id);
    setRenameValue(folder.name);
  };

  const commitRename = async () => {
    if (renamingId && renameValue.trim()) {
      await renameFolder(renamingId, renameValue.trim());
    }
    setRenamingId(null);
  };

  const bookCountFor = (folderId: string) =>
    books.filter((b) => b.folderId === folderId).length;

  return (
    <aside className="lib-sidebar">
      {/* Header */}
      <div className="lib-sidebar__header">
        <span className="lib-sidebar__brand">📚 Biblioteca</span>
      </div>

      {/* "Todos los libros" */}
      <button
        id="lib-folder-all"
        className={`lib-sidebar__item ${selectedFolderId === 'all' ? 'lib-sidebar__item--active' : ''}`}
        onClick={() => setSelectedFolder('all')}
      >
        <span className="lib-sidebar__item-icon">🏠</span>
        <span className="lib-sidebar__item-label">Todos los libros</span>
        <span className="lib-sidebar__item-count">{books.length}</span>
      </button>

      {/* Separador */}
      {folders.length > 0 && (
        <p className="lib-sidebar__section-label">COLECCIONES</p>
      )}

      {/* Carpetas */}
      {folders.map((folder) => (
        <div key={folder.id} className="lib-sidebar__folder-row">
          {renamingId === folder.id ? (
            <input
              ref={renameInputRef}
              className="lib-sidebar__rename-input"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitRename();
                if (e.key === 'Escape') setRenamingId(null);
              }}
              maxLength={40}
              autoFocus
            />
          ) : (
            <button
              id={`lib-folder-${folder.id}`}
              className={`lib-sidebar__item ${selectedFolderId === folder.id ? 'lib-sidebar__item--active' : ''}`}
              onClick={() => setSelectedFolder(folder.id)}
              onDoubleClick={() => {
                setRenamingId(folder.id);
                setRenameValue(folder.name);
              }}
            >
              <span className="lib-sidebar__item-icon">📁</span>
              <span className="lib-sidebar__item-label">{folder.name}</span>
              <span className="lib-sidebar__item-count">
                {bookCountFor(folder.id)}
              </span>
            </button>
          )}

          {/* Botón de opciones (⋮) */}
          {renamingId !== folder.id && (
            <button
              className="lib-sidebar__folder-menu-btn"
              aria-label={`Opciones de ${folder.name}`}
              onClick={(e) => {
                e.stopPropagation();
                const rect = (
                  e.currentTarget as HTMLElement
                ).getBoundingClientRect();
                setContextMenu({ id: folder.id, x: rect.right, y: rect.top });
              }}
            >
              ⋮
            </button>
          )}
        </div>
      ))}

      {/* Botón nueva carpeta */}
      <button
        id="lib-new-folder-btn"
        className="lib-sidebar__new-folder-btn"
        onClick={handleAddFolder}
      >
        <span>＋</span> Nueva carpeta
      </button>

      {/* Menú contextual de carpeta */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="lib-context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <button
            className="lib-context-menu__item"
            onClick={() => {
              const folder = folders.find((f) => f.id === contextMenu.id);
              if (folder) {
                setRenamingId(folder.id);
                setRenameValue(folder.name);
              }
              setContextMenu(null);
            }}
          >
            ✏️ Renombrar
          </button>
          <button
            className="lib-context-menu__item lib-context-menu__item--danger"
            onClick={async () => {
              const count = bookCountFor(contextMenu.id);
              const msg =
                count > 0
                  ? `¿Eliminar esta carpeta? Los ${count} libro(s) pasarán a "Sin carpeta".`
                  : '¿Eliminar esta carpeta?';
              if (confirm(msg)) {
                await removeFolder(contextMenu.id);
              }
              setContextMenu(null);
            }}
          >
            🗑️ Eliminar
          </button>
        </div>
      )}
    </aside>
  );
}
