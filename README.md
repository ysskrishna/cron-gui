Cron GUI
========

[![npm](https://img.shields.io/npm/v/cron-gui.svg?style=flat-square)](https://www.npmjs.com/package/cron-gui)
[![npm](https://img.shields.io/npm/l/cron-gui.svg?style=flat-square)](LICENSE)

Modern web UI for managing crontab jobs — forked and redesigned from [crontab-ui](https://github.com/alseambusher/crontab-ui).


![flow](https://github.com/alseambusher/crontab-ui/raw/gh-pages/screenshots/flow.gif)

## Features

1. Easy setup; import from an existing system crontab
2. Safe add, edit, pause, and delete jobs
3. Server-side backups and restore
4. Export/import `crontab.db` across machines
5. Per-job stdout/stderr logging
6. Optional nodemailer notifications after job runs

## Setup

Requires Node.js 20+.

```bash
npm install -g cron-gui
cron-gui
```

The `crontab-ui` command is kept as a backward-compatible alias.

### Environment variables

| Variable | Purpose |
|----------|---------|
| `HOST` | Bind address (default `127.0.0.1`) |
| `PORT` | Port (default `8000`) |
| `BASE_URL` | URL path prefix when behind a reverse proxy |
| `CRON_DB_PATH` | Directory for `crontab.db`, backups, and logs |
| `CRON_PATH` | Directory for generated crontab files |
| `BASIC_AUTH_USER` / `BASIC_AUTH_PWD` | HTTP basic auth |
| `SSL_CERT` / `SSL_KEY` | HTTPS |
| `ENABLE_AUTOSAVE` | Auto-deploy on DB changes |

Example:

```bash
HOST=0.0.0.0 PORT=9000 BASE_URL=/cron CRON_DB_PATH=/var/lib/cron-gui cron-gui
```

Autosave to system crontab:

```bash
cron-gui --autosave
```

Reset local database:

```bash
cron-gui --reset
```

## Docker

Pull the published image:

```bash
docker pull ysskrishna/cron-gui:latest
docker run -d -p 8000:8000 ysskrishna/cron-gui
```

Build and run locally:

```bash
git clone https://github.com/ysskrishna/cron-gui.git
cd cron-gui
docker build -t ysskrishna/cron-gui .
docker run -d -p 8000:8000 ysskrishna/cron-gui
```

With auth:

```bash
docker run -e BASIC_AUTH_USER=user -e BASIC_AUTH_PWD=SecretPassword -d -p 8000:8000 ysskrishna/cron-gui
```

Persist data:

```bash
mkdir -p crontabs/logs
docker run --mount type=bind,source="$(pwd)/crontabs",target=/crontab-ui/crontabs -d -p 8000:8000 ysskrishna/cron-gui
```

Or use Compose:

```bash
docker compose up -d
```



## Migrating from crontab-ui

- Install `cron-gui` instead of `crontab-ui`; existing `crontab.db` files are compatible.
- The `crontab-ui` CLI alias still works.
- **Hooks:** The old UI had a hooks editor (never fully implemented). The backend still runs `hook` commands on jobs that already have them, but the new UI has no hook editor. Editing a job in the UI preserves an existing `hook` field; hooks cannot be added or changed from the UI.
- **Schedule presets:** The new UI uses 5-field cron expressions plus `@reboot`. Macros like `@hourly` still work in crontab if typed manually.

## Screenshots

> Screenshots below show the legacy UI and will be updated before release.

![basic](https://github.com/alseambusher/crontab-ui/raw/gh-pages/screenshots/main.png)
![import](https://github.com/alseambusher/crontab-ui/raw/gh-pages/screenshots/import.gif)
![backup](https://github.com/alseambusher/crontab-ui/raw/gh-pages/screenshots/backup.png)
![export](https://github.com/alseambusher/crontab-ui/raw/gh-pages/screenshots/import_db.png)
![logs](https://github.com/alseambusher/crontab-ui/raw/gh-pages/screenshots/log.gif)

## Resources

- [Pre-release review / open issues](REVIEW.md)
- [nginx integration](README/nginx.md)
- [Upstream crontab-ui docs](https://github.com/alseambusher/crontab-ui)

## Changelog

See [CHANGELOG](CHANGELOG.md) for release history.

## Support

If you find this project helpful:

- ⭐ Star the [repository](https://github.com/ysskrishna/cron-gui)
- 🐛 [Report issues](https://github.com/ysskrishna/cron-gui/issues)
- 🔀 Submit pull requests
- 💝 [Sponsor on GitHub](https://github.com/sponsors/ysskrishna)

## License

MIT © [Y. Siva Sai Krishna](https://github.com/ysskrishna) — see [LICENSE](LICENSE) for details.

Based on [crontab-ui](https://github.com/alseambusher/crontab-ui) by Suresh Alse (MIT).

---

<p align="left">
  <a href="https://github.com/ysskrishna">Author's GitHub</a> •
  <a href="https://linkedin.com/in/ysskrishna">Author's LinkedIn</a> •
  <a href="https://ysskrishna.space">Author's site</a> •
  <a href="https://clawhub.ai/user/ysskrishna">ClawHub</a> •
  <a href="https://github.com/ysskrishna/cron-gui/issues">Report Issues</a>
</p>
