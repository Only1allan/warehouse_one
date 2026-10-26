#!/bin/sh
set -eu

# Render (and some other hosts) mount the persistent disk as root-owned. Make
# sure the unprivileged app user can write to it, then drop privileges.
if [ "$(id -u)" = "0" ]; then
  mkdir -p "${HOME:-/data/home}" \
    "$(dirname "${WAREHOUSE_DB_PATH:-/data/warehouse.db}")" \
    "${WAREHOUSE_UPLOAD_DIR:-/data}"

  # Only walk the disk on first boot. It can hold several GB of model files.
  if [ ! -f /data/.owned-by-node ]; then
    chown -R node:node /data
    touch /data/.owned-by-node
    chown node:node /data/.owned-by-node
  fi

  exec gosu node "$@"
fi

exec "$@"
