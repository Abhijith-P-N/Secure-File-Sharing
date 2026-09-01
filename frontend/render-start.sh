#!/bin/sh
set -e

# Render injects PORT and BACKEND_URL. If PORT is present, generate the nginx
# config from the template so it listens on the Render-assigned port and
# proxies /api to the internal backend service.
if [ -n "$PORT" ]; then
  echo "Render detected: PORT=$PORT BACKEND_URL=${BACKEND_URL:-http://vaultguard-backend:10000}"
  BACKEND_URL="${BACKEND_URL:-http://vaultguard-backend:10000}" \
    envsubst '${PORT} ${BACKEND_URL}' \
    < /etc/nginx/templates/default.conf.template \
    > /etc/nginx/conf.d/default.conf
else
  echo "No PORT set; using static nginx.conf (docker-compose)."
fi

exec nginx -g "daemon off;"
