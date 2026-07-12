<p align="center">
  <img src="public/img/icon-512-dark.png" alt="Cron GUI" width="96" height="96" />
</p>

Cron GUI
========

[![npm](https://img.shields.io/npm/v/cron-gui.svg?style=flat-square)](https://www.npmjs.com/package/cron-gui)
[![npm](https://img.shields.io/npm/l/cron-gui.svg?style=flat-square)](LICENSE)

Cron GUI is a web interface for managing cron jobs without editing `crontab` text by hand.
Create, edit, pause, run, back up, and restore jobs from one place.

![flow](https://github.com/alseambusher/crontab-ui/raw/gh-pages/screenshots/flow.gif)

## Why Cron GUI

- Import from an existing system crontab
- Add, edit, pause, resume, run, and delete jobs safely
- Backup and restore server-side job state
- Export/import `crontab.db` between environments
- Store per-job stderr/stdout logs
- Send optional email notifications after job runs

## Quick start

Requires Node.js 20+.

```bash
npm install -g cron-gui
cron-gui
```

Default URL: `http://127.0.0.1:8000`

## Configuration (essential)

| Variable | Purpose |
|----------|---------|
| `HOST` | Bind address (default `127.0.0.1`) |
| `PORT` | Port (default `8000`) |
| `BASE_URL` | URL path prefix when behind a reverse proxy |
| `CRON_DB_PATH` | Directory for `crontab.db`, backups, and logs |
| `BASIC_AUTH_USER` / `BASIC_AUTH_PWD` | HTTP basic auth |
| `SSL_CERT` / `SSL_KEY` | HTTPS (both must be set together) |
| `ENABLE_AUTOSAVE` | Auto-deploy on DB changes |

Example:

```bash
HOST=0.0.0.0 PORT=9000 BASE_URL=/cron CRON_DB_PATH=/var/lib/cron-gui cron-gui
```

Common flags: `--autosave`, `--reset`

## Docker quick start

```bash
docker pull ysskrishna/cron-gui:latest
docker run -d -p 8000:8000 ysskrishna/cron-gui:latest
```

Or with Compose:

```bash
docker compose up -d
```

## Migrating from crontab-ui

- Install `cron-gui` instead of `crontab-ui`; existing `crontab.db` files are compatible.
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

- [Configuration and CLI options](docs/configuration.md)
- [Docker deployment guide](docs/docker.md)
- [nginx integration](docs/nginx.md)
- [Troubleshooting notes](docs/issues.md)
- [Pre-release review / open issues](REVIEW.md)
- [Upstream crontab-ui docs](https://github.com/alseambusher/crontab-ui)
- [Release history (CHANGELOG)](CHANGELOG.md)

## Support

If you find this project helpful:

- ⭐ Star the [repository](https://github.com/ysskrishna/cron-gui)
- 🐛 [Report issues](https://github.com/ysskrishna/cron-gui/issues)
- 🔀 Submit pull requests
- 💝 [Sponsor on GitHub](https://github.com/sponsors/ysskrishna)

## Credits

This package is a fork of the [crontab-ui](https://www.npmjs.com/package/crontab-ui) npm package by [alseambusher](https://github.com/alseambusher).

## License

MIT © [Y. Siva Sai Krishna](https://github.com/ysskrishna) — see [LICENSE](LICENSE) for details.

---

<p align="left">
  <a href="https://github.com/ysskrishna">Author's GitHub</a> •
  <a href="https://linkedin.com/in/ysskrishna">Author's LinkedIn</a> •
  <a href="https://ysskrishna.space">Author's site</a> •
  <a href="https://clawhub.ai/user/ysskrishna">ClawHub</a> •
  <a href="https://github.com/ysskrishna/cron-gui/issues">Report Issues</a>
</p>
