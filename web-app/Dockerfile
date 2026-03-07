FROM node:22-alpine AS builder

WORKDIR /app

COPY web-app/package*.json ./
RUN npm ci

COPY web-app/ ./
RUN npm run build -- --configuration production

FROM nginx:1.27-alpine

ARG GIT_COMMIT=unknown
ARG BUILD_TIMESTAMP=unknown
ENV GIT_COMMIT=${GIT_COMMIT}
ENV BUILD_TIMESTAMP=${BUILD_TIMESTAMP}

COPY web-app/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY web-app/docker-entrypoint.sh /docker-entrypoint.d/40-build-info.sh
COPY --from=builder /app/dist/web-app/browser/ /usr/share/nginx/html/

RUN chmod +x /docker-entrypoint.d/40-build-info.sh

EXPOSE 80
