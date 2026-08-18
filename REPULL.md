Para garantizar que las notas, bases de datos y archivos subidos sobrevivan a las actualizaciones (re-pull, recreación o eliminación del contenedor), debes separar completamente el almacenamiento de la capa del contenedor mediante Volúmenes de Docker o Bind Mounts.

Los contenedores son efímeros por diseño: cualquier archivo guardado fuera de un volumen montado se destruye al recrear el contenedor.

1. Centraliza las rutas de datos dentro de tu app

Asegúrate de que tu aplicación guarde todo el estado persistente en un directorio unificado (o variables de entorno que apunten a él), por ejemplo:

Archivos subidos: /app/data/uploads

Base de datos / notas (ej. SQLite, archivos Markdown o JSON): /app/data/storage

2. Persistencia según el método de despliegue

Opción A: Con Docker Compose (Recomendado)

Usa un volumen nombrado o un bind mount local en el archivo docker-compose.yml:

YAML
services:
  app:
    image: ghcr.io/tu-usuario/tu-app:latest
    ports:
      - "8080:8080"
    volumes:
      # Opción 1: Directorio local del host (Bind mount)
      - ./app_data:/app/data
      
      # Opción 2: Volumen gestionado por Docker (Named Volume)
      # - app_storage:/app/data
    restart: unless-stopped

# Descomentar si usas la Opción 2
# volumes:
#   app_storage:
Flujo de actualización:

Bash
docker compose pull
docker compose up -d
Docker descargará la nueva imagen de GHCR y recreará el contenedor reenganchando el mismo volumen sin tocar los archivos.

Opción B: Con docker run (Línea de comandos)

Si tus usuarios despliegan directamente con la CLI, deben incluir el flag -v:

Bash
docker run -d \
  --name mi-app \
  -p 8080:8080 \
  -v /ruta/en/el/host/data:/app/data \
  ghcr.io/tu-usuario/tu-app:latest
Flujo de actualización:

Bash
docker pull ghcr.io/tu-usuario/tu-app:latest
docker stop mi-app
docker rm mi-app
docker run -d --name mi-app -p 8080:8080 -v /ruta/en/el/host/data:/app/data ghcr.io/tu-usuario/tu-app:latest
3. Buenas prácticas en el Dockerfile

Declarar el volumen (opcional pero orientativo): Puedes incluir la directiva VOLUME ["/app/data"] en tu Dockerfile para documentar la ruta y evitar que Docker descarte datos si alguien olvida montar un volumen explícito.

Permisos de usuario (UID/GID): Si tu imagen corre bajo un usuario no-root (ej. USER appuser), asegúrate de que tenga permisos de lectura y escritura en la carpeta de datos (/app/data), o implementa soporte para variables como PUID y PGID si manejas bind mounts en entornos Linux/NAS.