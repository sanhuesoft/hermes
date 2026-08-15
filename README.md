# 📖 Hermes

**Hermes** es un lector de libros electrónicos EPUB moderno, ligero y auto-alojado (*self-hosted*), diseñado especialmente para entusiastas del *homelab*, lectores ávidos e investigadores. Integra síntesis de voz neuronal (TTS), un sistema robusto de notas y resaltados, y organización bibliográfica con citekeys.

---

## ✨ Características Principales

- 📚 **Lector EPUB Rápido y Personalizable:**
  - Modos de lectura: **Paginado** y **Continuo (Scroll)**.
  - Tipografías integradas: *Inter*, *Merriweather*, *EB Garamond*, *JetBrains Mono* y *OpenDyslexic*.
  - Temas visuales: **Claro**, **Oscuro** y **Sepia**, con paleta de acento dinámica configurable.
  - Ajuste de interlineado, tamaño de fuente y márgenes laterales.
  - **Modo Zen:** Lectura minimalista a pantalla completa sin distracciones.

- 🎙️ **Text-to-Speech (Edge-TTS) Neural en Tiempo Real:**
  - Síntesis de voz con voces neurales de alta fidelidad en español e inglés.
  - Resaltado y auto-scroll del párrafo/oración que se está leyendo.
  - Selector de voces, velocidad de lectura y reproducción automática del siguiente capítulo.

- 🖍️ **Resaltados, Notas y Marcadores:**
  - Resaltado de texto en 4 colores con posibilidad de añadir comentarios.
  - Panel lateral de anotaciones para saltar rápidamente a cualquier cita o marcador.
  - Exportación e importación de notas mediante archivos sidecar estándar (`.epub.notes.json`).

- 🗂️ **Gestión de Biblioteca & Citekeys:**
  - Organización de libros en carpetas/colecciones.
  - Extracción y personalización automática de portadas de libros.
  - Identificación estandarizada con formato de citas académicas (*citekeys* como `autor2024`).

- 🏠 **Diseñado para Homelab y Self-Hosting:**
  - **1 solo contenedor (Zero-Config):** Base de datos embebida **SQLite** con **Drizzle ORM** y almacenamiento en disco. No requiere contenedores auxiliares como PostgreSQL o Redis.
  - **Bajo consumo de recursos:** Consume apenas ~40–60 MB de memoria RAM.
  - **Inicialización automática:** Configura carpetas internas y permisos automáticamente al arrancar.
  - **Respaldos en 1 paso:** Basta con respaldar la carpeta de volumen persistente `/data`.

---

## 🚀 Despliegue en Homelab con Docker Compose

### 1. `docker-compose.yml` de Ejemplo

Crea un archivo `docker-compose.yml` en tu servidor o úsalo directamente en tu gestor de contenedores:

```yaml
services:
  hermes:
    build:
      context: https://github.com/sanhuesoft/hermes.git#main
      dockerfile: Dockerfile
    container_name: hermes
    restart: unless-stopped
    ports:
      - "5050:3000" # Acceso web en http://<IP_SERVIDOR>:5050
    environment:
      - NODE_ENV=production
      - DATA_DIR=/data
      - PORT=3000
    volumes:
      # Volumen persistente donde se guardan libros, portadas y la base de datos SQLite
      - /home/tu-usuario/appdata/hermes:/data
```

### 2. Iniciar el servicio

Ejecuta en tu terminal:

```bash
docker compose up -d
```

Abre tu navegador e ingresa a `http://localhost:5050` (o la IP de tu servidor/NAS).

---

## 📦 Despliegue en Portainer

1. En tu panel de **Portainer**, dirígete a **Stacks** → **+ Add stack**.
2. Asigna un nombre al stack (ej. `hermes`).
3. Puedes elegir cualquiera de estos métodos:
   - **Opción A (Web Editor):** Pega el bloque de `docker-compose.yml` anterior adaptando la ruta del volumen a tu entorno.
   - **Opción B (Repository):** 
     - **Repository URL:** `https://github.com/sanhuesoft/hermes.git`
     - **Repository reference:** `refs/heads/main`
     - **Compose path:** `docker-compose.yml`
4. Haz clic en **Deploy the stack**.

> **Nota sobre puertos:** Se recomienda utilizar puertos externos como `5050`, `8080` o `3000`. Evita utilizar el puerto `5060` en el host, ya que los navegadores modernos lo bloquean por seguridad (*ERR_UNSAFE_PORT* al ser el puerto estándar de VoIP/SIP).

---

## 📂 Estructura de Datos Persistentes

Dentro del directorio mapeado a `/data` encontrarás:

```text
/data/
├── library.db         # Base de datos SQLite (metadatos, progreso, notas, carpetas)
├── books/             # Archivos .epub originales
└── covers/            # Imágenes de portada extraídas o subidas
```

Para realizar un **backup completo**, únicamente necesitas copiar el contenido del directorio montado.

---

## 🛠️ Desarrollo Local

Si deseas ejecutar o modificar el proyecto en local:

```bash
# 1. Clonar el repositorio
git clone https://github.com/sanhuesoft/hermes.git
cd hermes

# 2. Instalar dependencias con pnpm
pnpm install

# 3. Iniciar servidor de desarrollo
pnpm dev
```

La aplicación estará disponible en `http://localhost:3000`.

---

## 📄 Licencia

Distribuido bajo la licencia MIT. Consulta el archivo `LICENSE` para más detalles.
