#!/bin/sh
set -e

# Asegurar que existan los directorios requeridos dentro del volumen persistente
mkdir -p "${DATA_DIR:-/data}/books" "${DATA_DIR:-/data}/covers"

# Ajustar permisos para que el usuario nextjs (UID 1001) pueda escribir en el volumen montado
chown -R nextjs:nodejs "${DATA_DIR:-/data}"

# Ejecutar el servidor Next.js como el usuario nextjs
exec su-exec nextjs:nodejs node server.js
