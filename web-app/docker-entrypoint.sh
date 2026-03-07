#!/bin/sh
set -eu

mkdir -p /usr/share/nginx/html/assets

cat > /usr/share/nginx/html/assets/build-info.json <<EOF
{
  "gitCommit": "${GIT_COMMIT:-unknown}",
  "buildTimestamp": "${BUILD_TIMESTAMP:-unknown}"
}
EOF
