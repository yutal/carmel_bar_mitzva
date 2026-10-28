#!/bin/sh
# Hosted volumes (Railway, Render) are mounted root-owned over /data.
# Fix ownership once as root, then run the server as the unprivileged node user.
set -e

# Size the V8 heap to the instance: 60% of the container's memory limit, unless NODE_OPTIONS already sets it.
case "${NODE_OPTIONS:-}" in
  *max-old-space-size*) ;;
  *)
    limit=$(cat /sys/fs/cgroup/memory.max 2>/dev/null || echo max)
    if [ "$limit" != "max" ]; then
      heap=$((limit / 1024 / 1024 * 60 / 100))
      [ "$heap" -lt 256 ] && heap=256
      export NODE_OPTIONS="${NODE_OPTIONS:+$NODE_OPTIONS }--max-old-space-size=$heap"
    fi
    ;;
esac

if [ "$(id -u)" = "0" ]; then
  mkdir -p "${DATA_DIR:-/data}"
  chown node:node "${DATA_DIR:-/data}"
  exec setpriv --reuid=node --regid=node --init-groups "$@"
fi
exec "$@"
