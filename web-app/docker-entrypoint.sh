#!/bin/sh
set -eu

mkdir -p /usr/share/nginx/html/assets

PROPERTIES_FILE="/usr/share/nginx/html/assets/hsm-web.properties"
API_PROXY_PASS="http://mock-api:8000"

if [ -f "$PROPERTIES_FILE" ]; then
  USE_MOCK_API="$(sed -n 's/^[[:space:]]*useMockApi[[:space:]]*=[[:space:]]*//p' "$PROPERTIES_FILE" | tail -n1 | tr '[:upper:]' '[:lower:]')"
  API_BASE_URL="$(sed -n 's/^[[:space:]]*apiBaseUrl[[:space:]]*=[[:space:]]*//p' "$PROPERTIES_FILE" | tail -n1)"

  if [ "$USE_MOCK_API" = "false" ] && [ -n "$API_BASE_URL" ]; then
    API_PROXY_PASS="${API_BASE_URL%/}"
    case "$API_PROXY_PASS" in
      */api)
        API_PROXY_PASS="${API_PROXY_PASS%/api}"
        ;;
    esac
  fi
fi

cat > /etc/nginx/conf.d/default.conf <<EOF
server {
  listen 80;
  server_name _;

  root /usr/share/nginx/html;
  index index.html;

  location /api/ {
    proxy_pass ${API_PROXY_PASS};
    proxy_http_version 1.1;
    proxy_set_header Host \$proxy_host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
  }

  location = /health-mock {
    proxy_pass http://mock-api:8000/;
  }

  location / {
    try_files \$uri \$uri/ /index.html;
  }
}
EOF

cat > /usr/share/nginx/html/assets/build-info.json <<EOF
{
  "gitCommit": "${GIT_COMMIT:-unknown}",
  "buildTimestamp": "${BUILD_TIMESTAMP:-unknown}"
}
EOF
