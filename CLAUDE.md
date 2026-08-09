# Plan de Implementación: EPUB Reader Web con Next.js, Edge-TTS y Sistema de Anotaciones

Este documento define la arquitectura, especificaciones técnicas y hoja de ruta para construir una aplicación web moderna de lectura de archivos EPUB, optimizada para ejecución local en navegador, síntesis de voz mediante `edge-tts` y persistencia de notas en formato sidecar.

---

## 1. Stack Tecnológico y Arquitectura

* **Framework Base:** Next.js (App Router, TypeScript).
* **UI & Estilos:** Tailwind CSS, Shadcn UI / Radix Primitives, Lucide Icons.
* **Motor EPUB:** `epubjs` (o `@epubjs/core`) para el parsing, renderizado e interacción con el DOM de las páginas.
* **Motor TTS:** `msedge-tts` (librería Node.js/WebSocket) integrado a través de API Routes de Next.js.
* **Gestión de Estado:** Zustand (para el estado del reproductor, ajustes tipográficos y modo Zen) + React Context/Hooks locales.
* **Persistencia:** Browser Memory / IndexedDB (`localforage`) para caché local de sesión y exportación/importación de archivos JSON secundarios (`.epub.notes.json`).

---

## 2. Estructura del Proyecto

```text
├── app/
│   ├── api/
│   │   └── tts/
│   │       ├── voices/route.ts      # Filtra y entrega voces es-CL y en-US
│   │       └── synthesize/route.ts  # Genera audio streaming via msedge-tts
│   ├── layout.tsx
│   └── page.tsx                     # Contenedor principal de la aplicación
├── components/
│   ├── reader/
│   │   ├── EpubViewer.tsx           # Canvas e iframe de renderizado EPUB
│   │   ├── ZenOverlay.tsx           # Botón y menú flotante minimalista
│   │   └── HighlightMenu.tsx        # Menú contextual de resaltado y notas
│   ├── tts/
│   │   ├── TtsControls.tsx          # Barra de reproducción (play/pause/next)
│   │   └── VoiceSelector.tsx        # Selector de voces es-CL y en-US
│   └── settings/
│       └── ReaderSettingsModal.tsx  # Temas, fuentes, tamaños, márgenes
├── lib/
│   ├── epub/
│   │   ├── parser.ts                # Lectura y procesamiento local de EPUB
│   │   └── highlight-manager.ts     # Manejo de CFIs y anotaciones
│   ├── tts/
│   │   └── edge-tts-client.ts       # Cliente para consumo de endpoints TTS
│   └── storage/
│       └── sidecar-manager.ts       # Exportación e importación de JSON
├── types/
│   ├── epub.ts
│   └── tts.ts
└── stores/
    ├── useReaderStore.ts            # Estado de lectura, tipografía y tema
    └── useTtsStore.ts               # Estado de audio, párrafo activo y voz
```

---

## 3. Fases de Desarrollo Paso a Paso

### Fase 1: Motor EPUB y Carga de Archivos
1. **Dropzone de Archivo:**
   * Crear interfaz para que el usuario seleccione o arrastre un archivo `.epub` desde su dispositivo.
   * Procesar el archivo mediante `FileReader` como ArrayBuffer sin subirlo a servidores externos (100% cliente).
2. **Renderizado Básal (`EpubViewer`):**
   * Inicializar `epubjs` apuntando a un contenedor `div`.
   * Manejar eventos de navegación (página siguiente/anterior, cambio de capítulo mediante TOC).

### Fase 2: Motor de TTS (`edge-tts`) y Sincronización de Lectura
1. **API Endpoint de Voces (`/api/tts/voices`):**
   * Consultar la lista completa de voces neurales de Edge.
   * Aplicar un filtro estricto por regex para exponer únicamente las voces cuyos IDs inicien con:
     * `es-CL-` (ej. `es-CL-LorenzoNeural`, `es-CL-CatalinaNeural`)
     * `en-US-` (ej. `en-US-AvaNeural`, `en-US-AndrewNeural`)
2. **API Endpoint de Síntesis (`/api/tts/synthesize`):**
   * Recibir el texto del párrafo activo y el ID de la voz seleccionada.
   * Retornar un stream de audio en formato MP3 utilizando `msedge-tts`.
3. **Extracción e Identificación de Párrafos:**
   * Al cargar un capítulo, parsear los elementos `<p>` del iframe renderizado por `epubjs`.
   * Asignar un atributo temporal `data-paragraph-index` a cada párrafo.
4. **Resaltado Dinámico en Tiempo Real:**
   * Mantener el índice del párrafo actual en `useTtsStore`.
   * Aplicar CSS dinámico (`bg-yellow-200/50` o `dark:bg-yellow-500/30`) al elemento `<p>` activo dentro del DOM del EPUB.
   * Auto-scroll del iframe para mantener siempre visible el párrafo que se está leyendo.

### Fase 3: Personalización de Apariencia y Modo Zen
1. **Opciones de Personalización:**
   * **Modo:** Claro, Oscuro, Sepia.
   * **Fuentes:** Serif (Merriweather, Garamond), Sans-serif (Inter), Monospace, Dyslexic-friendly.
   * **Tamaño de Fuente:** Rango dinámico (12px a 32px).
   * **Interlineado:** 1.2, 1.5, 1.8, 2.0.
   * **Márgenes Horizontales:** Rango ajustable (0% a 25%).
2. **Inyección de Estilos en EPUB:**
   * Utilizar la API `rendition.themes.register()` y `rendition.themes.select()` de `epubjs` para propagar instantáneamente los ajustes dentro del iframe del libro.
3. **Modo Zen:**
   * Implementar un estado global `isZenMode`.
   * Cuando esté activo:
     * Ocultar barras de navegación, encabezados, selectores de voz y paneles laterales con animaciones CSS.
     * Dejar visible un único botón flotante semitransparente (icono minimalista de ajustes/menú) en una esquina fija de la pantalla.
     * Al hacer clic en el botón flotante, desplegar una capa flotante (overlay) con controles esenciales sin romper el estado Zen.

### Fase 4: Sistema de Resaltados, Notas y Archivo Sidecar
1. **Selección de Texto en el EPUB:**
   * Escuchar el evento `selected` de `rendition` en `epubjs`.
   * Extraer el texto seleccionado y el `CFI` (Content Finder Index) correspondiente para guardar la ubicación exacta.
2. **Menú Contextual de Anotaciones:**
   * Mostrar un popover al seleccionar texto con opciones de:
     * Elegir color de resaltado (Amarillo, Verde, Azul, Rosa).
     * Añadir / Editar nota vinculada.
     * Eliminar resaltado.
3. **Estructura del Archivo Sidecar (`.json`):**
   * Diseñar el esquema de datos estandarizado para persistencia externa:

```json
{
  "version": "1.0",
  "bookMeta": {
    "title": "Título del Libro",
    "identifier": "urn:uuid:..."
  },
  "updatedAt": "2026-08-09T12:00:00.000Z",
  "highlights": [
    {
      "id": "hl_123456789",
      "cfiRange": "epubcfi(/6/4[chap01]!/4/2/10/1:0,/1:45)",
      "text": "Texto seleccionado dentro del párrafo.",
      "color": "yellow",
      "note": "Nota opcional escrita por el usuario.",
      "createdAt": "2026-08-09T12:00:00.000Z"
    }
  ]
}
```

4. **Exportación e Importación:**
   * **Exportar:** Botón para descargar un archivo nombrado `<nombre_epub>.notes.json`.
   * **Importar:** Opción para cargar manualmente un archivo `.json` previo que vuelva a renderizar todos los resaltados en el libro mediante `rendition.annotations.add()`.

---

## 4. Requisitos y Contratos Técnicos Específicos

1. **Aislamiento de Voces TTS:**
   * El filtro debe ser estricto. Ejemplo de validación en la API:
   ```typescript
   const ALLOWED_VOICE_PREFIXES = ['es-CL-', 'en-US-'];
   const filteredVoices = allVoices.filter(voice => 
     ALLOWED_VOICE_PREFIXES.some(prefix => voice.ShortName.startsWith(prefix))
   );
   ```
2. **Resaltado y TTS:**
   * La lectura debe avanzar automáticamente al siguiente párrafo cuando finalice el audio actual.
   * El usuario debe poder hacer clic en cualquier párrafo del libro para saltar la lectura de TTS directamente a ese punto.
3. **Prensa local y privacidad:**
   * Toda la manipulación de EPUB, renderizado y guardado de anotaciones debe ejecutarse localmente en el navegador. Las únicas peticiones de red deben ser las llamadas al servidor de Next.js para convertir texto a audio via `edge-tts`.

---

