# Changelog

All notable changes to `cron-gui` are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).  
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-07-12

First preview release of **Cron GUI**.

### Added

- New web UI: job table, search, status filters, pagination (prev/next + ellipsis), bulk actions, dark mode
- Settings drawer for environment variables
- In-app backup restore preview (replaces legacy `/restore` page)
- Schedule presets, job create/edit dialogs, stdout/stderr log drawer
- `cron-gui` npm package with `crontab-ui` CLI alias preserved
- `CHANGELOG.md`, docs cleanup, updated README and migration notes
- Vitest API coverage (30 tests)

### Changed

- Rebranded UI and logs to **Cron GUI**
- `crontab.update()` uses `$set` so `stopped`, `created`, and `hook` are preserved on edit
- Stdout empty-log message: `No output logged yet`
- Preview unsaved-changes alert only when jobs or env are dirty
- Logging label: "Log stdout and stderr"; nodemailer note moved under mail fields
- `/restore` redirects to `/?restore=` for restore modal
- Removed legacy jQuery/Bootstrap/DataTables assets and old EJS views
- Package metadata: `files` whitelist, `homepage`, `bugs`, repository URL

### Fixed

- ESLint browser globals for `public/js/app.js`
- Logging checkbox default (unchecked for new jobs)
- Redundant Express static middleware mounts

[0.1.0]: https://github.com/ysskrishna/cron-gui/releases/tag/v0.1.0
