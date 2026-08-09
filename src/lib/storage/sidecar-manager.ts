import type { SidecarFile, Highlight, EpubMeta } from '@/types/epub';

/**
 * Construye y descarga un archivo sidecar .epub.notes.json con los highlights actuales.
 */
export function exportSidecar(
  bookMeta: EpubMeta,
  highlights: Highlight[],
  fileName: string
): void {
  const sidecar: SidecarFile = {
    version: '1.0',
    bookMeta: {
      title: bookMeta.title,
      identifier: bookMeta.identifier,
    },
    updatedAt: new Date().toISOString(),
    highlights,
  };

  const json = JSON.stringify(sidecar, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `${fileName}.notes.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Lee un archivo .epub.notes.json del sistema de archivos del usuario
 * y retorna el contenido deserializado.
 */
export async function importSidecar(file: File): Promise<SidecarFile> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string) as SidecarFile;
        if (data.version !== '1.0') {
          reject(new Error('Versión de sidecar no compatible'));
          return;
        }
        resolve(data);
      } catch {
        reject(new Error('El archivo no es un JSON válido'));
      }
    };
    reader.onerror = () => reject(new Error('Error al leer el archivo'));
    reader.readAsText(file);
  });
}
