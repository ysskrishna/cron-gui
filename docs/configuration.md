# Configuration and CLI

This page covers runtime configuration, CLI flags, and operational notes.

## Requirements

- Node.js `>=20`
- A system with `crontab` available in `PATH`

## Start command

```bash
cron-gui
```

## Environment variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `HOST` | `127.0.0.1` | Bind address for the web server |
| `PORT` | `8000` | HTTP/HTTPS port |
| `BASE_URL` | empty | Path prefix when behind a reverse proxy (example: `/cron`) |
| `CRON_DB_PATH` | `<install_dir>/crontabs` | Storage directory for `crontab.db`, backups, logs, and `env.db` |
| `CRON_PATH` | `/tmp` | Directory for generated cron files used during deploy |
| `BASIC_AUTH_USER` | unset | Username for app-level HTTP basic auth |
| `BASIC_AUTH_PWD` | unset | Password for app-level HTTP basic auth |
| `SSL_CERT` | unset | Path to certificate file for HTTPS |
| `SSL_KEY` | unset | Path to private key file for HTTPS |
| `ENABLE_AUTOSAVE` | unset | If set, automatically deploys changes whenever DB changes |
| `HUMANCRON` | `en` | Locale for human-readable cron text |
| `NODE_BIN` | current Node executable | Node binary used by the mailer helper |

## Common examples

Run on all interfaces, custom port, proxy base path, and persistent DB folder:

```bash
HOST=0.0.0.0 PORT=9000 BASE_URL=/cron CRON_DB_PATH=/var/lib/cron-gui cron-gui
```

Enable app-level basic auth:

```bash
BASIC_AUTH_USER=user BASIC_AUTH_PWD=SecretPassword cron-gui
```

Enable HTTPS:

```bash
SSL_CERT=/path/to/server.crt SSL_KEY=/path/to/server.key cron-gui
```

## CLI flags

Autosave to system crontab:

```bash
cron-gui --autosave
```

Reset local DB and env file (`crontab.db` and `env.db`):

```bash
cron-gui --reset
```

## Operational notes

- **Use `CRON_DB_PATH` for upgrades:** if you install globally via npm and update packages later, a custom data path avoids losing local app state.
- **Auth requires both values:** set both `BASIC_AUTH_USER` and `BASIC_AUTH_PWD` to enable auth.
- **HTTPS requires both files:** setting only one of `SSL_CERT` or `SSL_KEY` exits the app at startup.
- **Permissions matter:** ensure the runtime user can write to `CRON_DB_PATH` and read `SSL_CERT`/`SSL_KEY`.
- **Reverse proxy paths:** when serving under a subpath, set `BASE_URL` to that same subpath.
