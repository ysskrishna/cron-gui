# Changelog

All notable changes to `cron-gui` are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).  
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-07-12

First stable release of **Cron GUI**.

### Added

- Server-side cron schedule validation (expressions and `@` macros) with clear error messages
- Soft-delete workflow: pending-delete jobs, undelete action, and dashboard indicator
- System crontab view (`/system_crontab`) and backup list/delete API endpoints
- Smarter crontab import with line parsing, preview, and error handling
- Preview endpoint accepts `env_vars` query param for unsaved environment changes
- Structured Vitest suite: integration tests (backup, deploy, jobs, logs, pages, schedule, security) and unit tests (crontab, routes)
- Test harness with `CRON_GUI_TEST=1` so the server exports without binding a port
- `scripts/seed-demo-data.js` for local demo data
- README screenshots and workflow GIF

### Changed

- Settings drawer UI and environment-variable descriptions
- Major client-side refresh (`public/js/app.js`, `public/css/app.css`)
- `app.js` refactored for testability; monolithic `tests/test.js` replaced by focused test files
- **Publish npm** workflow: Node.js 22 → 24
- README overhaul with badges, highlights table, and updated quick-start docs

### Fixed

- Crontab import failures now surface as HTTP errors instead of failing silently
- Import/preview edge cases in `crontab.js` (wrapped commands, line parsing)

[1.0.0]: https://github.com/ysskrishna/cron-gui/releases/tag/v1.0.0

## [0.1.4] - 2026-07-12

Simplify release CI and switch npm publishing to trusted publishing.

### Changed

- **Publish npm** workflow: use npm trusted publishing (OIDC) instead of `NPM_TOKEN`
- **Publish npm** and **Publish Docker** workflows: remove prerelease handling; all releases publish as stable
- **Create Release** workflow: all GitHub Releases are full releases
- **validate-release** action: tags must match `vMAJOR.MINOR.PATCH` exactly
- **README**: remove ClawHub footer link
- **AGENTS.md**: remove prerelease guidance

[0.1.4]: https://github.com/ysskrishna/cron-gui/releases/tag/v0.1.4

## [0.1.3] - 2026-07-12

Fix manual republish workflows ignoring the entered release tag.

### Fixed

- **Publish Docker** and **Publish npm** workflows: prefer `workflow_dispatch` tag input over `github.ref_name` so manual runs from `main` use the requested tag (e.g. `v0.1.2`) instead of the branch name

[0.1.3]: https://github.com/ysskrishna/cron-gui/releases/tag/v0.1.3

## [0.1.2] - 2026-07-12

Fix publish workflows to read secrets from the `prod` environment.

### Fixed

- **Publish Docker** and **Publish npm** workflows: set `environment: prod` so Docker Hub and npm credentials resolve correctly

[0.1.2]: https://github.com/ysskrishna/cron-gui/releases/tag/v0.1.2

## [0.1.1] - 2026-07-12

Release automation docs and CI publish triggers on tag push.

### Added

- `AGENTS.md` with semver guidance, full diff review steps, and release workflow for agents

### Changed

- **Publish Docker** workflow: trigger on `v*` tag push; resolve release tag from `github.ref_name` when not a GitHub Release event; treat hyphenated tags as prereleases
- **Publish npm** workflow: same tag-push trigger and tag/prerelease handling as Docker

[0.1.1]: https://github.com/ysskrishna/cron-gui/releases/tag/v0.1.1

## [0.1.0] - 2026-07-12

First preview release of **Cron GUI**.

### Added

- New web UI: job table, search, status filters, pagination (prev/next + ellipsis), bulk actions, dark mode
- Settings drawer for environment variables
- In-app backup restore preview (replaces legacy `/restore` page)
- Schedule presets, job create/edit dialogs, stdout/stderr log drawer
- `cron-gui` npm package and CLI
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

### Removed

- Unused per-job `hook` post-run command support (never exposed in UI; upstream crontab-ui showed “Coming Soon” only)

[0.1.0]: https://github.com/ysskrishna/cron-gui/releases/tag/v0.1.0
