# docker run -d -p 8000:8000 ysskrishna/cron-gui
FROM node:22-alpine AS build

WORKDIR /cron-gui
COPY package.json package-lock.json ./
ENV NODE_ENV=production
RUN npm ci --omit=dev

FROM node:22-alpine

ENV   CRON_PATH=/etc/crontabs
RUN   touch $CRON_PATH/root && chmod +x $CRON_PATH/root

RUN   apk --no-cache add \
      curl \
      supervisor \
      tini \
      tzdata

WORKDIR /cron-gui

LABEL org.opencontainers.image.title="cron-gui"
LABEL org.opencontainers.image.description="Web interface for managing cron jobs without editing crontab by hand"
LABEL org.opencontainers.image.source="https://github.com/ysskrishna/cron-gui"
LABEL org.opencontainers.image.licenses="MIT"

COPY --from=build /cron-gui/node_modules ./node_modules
COPY . .

ENV   HOST=0.0.0.0
ENV   PORT=8000
ENV   CRON_IN_DOCKER=true

EXPOSE $PORT

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:${PORT}/ || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["supervisord", "-c", "/cron-gui/supervisord.conf"]
