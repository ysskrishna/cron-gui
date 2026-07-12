# Docker Deployment

This guide covers running `cron-gui` with Docker or Compose.

## Run published image

```bash
docker pull ysskrishna/cron-gui:latest
docker run -d --name cron-gui -p 8000:8000 ysskrishna/cron-gui:latest
```

Open `http://localhost:8000`.

## Persist app data

Persist `crontab.db`, backups, logs, and `env.db`:

```bash
mkdir -p crontabs
docker run -d \
  --name cron-gui \
  -p 8000:8000 \
  --mount type=bind,source="$(pwd)/crontabs",target=/cron-gui/crontabs \
  ysskrishna/cron-gui:latest
```

## Run with authentication

```bash
docker run -d \
  --name cron-gui \
  -p 8000:8000 \
  -e BASIC_AUTH_USER=user \
  -e BASIC_AUTH_PWD=SecretPassword \
  ysskrishna/cron-gui:latest
```

## Run with custom base path

```bash
docker run -d \
  --name cron-gui \
  -p 8000:8000 \
  -e BASE_URL=/cron \
  ysskrishna/cron-gui:latest
```

## Use docker compose

From the project root:

```bash
docker compose up -d
```

The included `docker-compose.yml` creates a named volume for persistent app data.

## Build image locally

```bash
git clone https://github.com/ysskrishna/cron-gui.git
cd cron-gui
docker build -t ysskrishna/cron-gui .
docker run -d -p 8000:8000 ysskrishna/cron-gui
```

## Notes

- The container is designed to run cron jobs inside the container runtime.
- For production exposure, place it behind nginx or another reverse proxy.
- If you set `BASE_URL`, configure the reverse proxy to forward that same path.
