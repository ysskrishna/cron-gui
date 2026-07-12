# Agent guidelines

## Version bumps and releases

When the user asks to **bump the version**, **prepare a release**, or similar:

### 1. Propose a version — do not edit files yet

Read the current version in `package.json` and **every change since the last release tag** — not just the latest commit or commit count.

**Find the last tag** (e.g. `git tag -l 'v*' --sort=-v:refname | head -1`).

**Review all changes since that tag:**

```bash
git log <last-tag>..HEAD --oneline
git diff <last-tag>..HEAD --stat
git diff <last-tag>..HEAD          # read the full diff for notable changes
git status                         # include uncommitted / unstaged work
git diff                           # uncommitted changes vs HEAD
```

Do **not** summarize from commit messages alone. One commit can touch many files; read the diff and group changes by user impact (Added / Changed / Fixed / Removed).

Suggest the next **MAJOR.MINOR.PATCH** using [Semantic Versioning](https://semver.org/):

| Bump | When |
|------|------|
| **PATCH** | Backward-compatible bug fixes |
| **MINOR** | New backward-compatible features |
| **MAJOR** | Breaking API, config, or behavior changes |

Briefly say why you recommend that bump. Wait for explicit confirmation before changing files.

If the user names a version, use it (still confirm if it breaks semver expectations).

### 2. After confirmation — update files only

Update:

1. **`package.json`** — `"version"` field
2. **`package-lock.json`** — top-level `"version"` and `packages[""].version` (run `npm install` only if deps changed; otherwise edit both fields to match)
3. **`CHANGELOG.md`** — new section at the top (below the header), [Keep a Changelog](https://keepachangelog.com/) style:

```markdown
## [1.2.3] - YYYY-MM-DD

Short summary line.

### Added
- ...

### Changed
- ...

### Fixed
- ...

[1.2.3]: https://github.com/ysskrishna/cron-gui/releases/tag/v1.2.3
```

Use today's date. Summarize **all** changes since the last release tag (see step 1 commands), including uncommitted work if it will ship in this release. Omit empty sections.

Do **not** run `make release`, create git tags, or publish unless the user explicitly asks.

### 3. Tell the user the release steps

**Commit and push to `main` first**, then tag. Required because:

- `make release` fails if the working tree is not clean
- CI checks that the tagged commit is on `origin/main`

Suggest this sequence (adjust version as needed):

```bash
git add package.json package-lock.json CHANGELOG.md
git commit -m "chore: release v1.2.3"
git push origin main
make release
```

Only create the commit or run these commands when the user asks.

`make release` tags `v` + `package.json` version and pushes the tag. GitHub Actions then creates the GitHub Release and publishes npm + Docker.

For **npm only** or **Docker only** republish, point to **Actions → Publish npm** or **Publish Docker → Run workflow** with the tag. See [workspace/README.md](workspace/README.md).

### 4. Prereleases

For versions like `1.0.0-beta.1`, use the same changelog section header `## [1.0.0-beta.1]`. Tags with a `-` suffix are treated as prereleases in CI.

## General

- Match existing code style and keep diffs focused.
- Do not commit, tag, or publish without being asked.
