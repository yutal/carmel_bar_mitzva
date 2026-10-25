#!/bin/sh
# Hosted volumes (Railway, Render) are mounted root-owned over /data.
# Fix ownership once as root, then run the server as the unprivileged node user.
set -e
if [ "$(id -u)" = "0" ]; then
  mkdir -p "${DATA_DIR:-/data}"
  chown node:node "${DATA_DIR:-/data}"
  exec setpriv --reuid=node --regid=node --init-groups "$@"
fi
exec "$@"
