---
name: ship
description: Finish a feature branch — run /simplify on the diff, run only the test suites that match the changed paths (backend pytest / ruff / pyright, frontend jest + svelte-check, e2e Playwright), then commit, push, and open a PR. Triggered by `/ship` or when the user asks to "wrap up", "ship this branch", or "finish and PR this".
---

# /ship — simplify, test, commit, push, PR

Final step of a feature branch. Do not run on `master`/`main` — bail out
immediately if the current branch is one of those.

## Workflow

### 1. Sanity-check the branch state

- `git rev-parse --abbrev-ref HEAD` — must not be `master`/`main`. If it is,
  stop and tell the user to switch to a feature branch first.
- `git status --short` — collect a list of modified + untracked files.
- `git diff --name-only origin/master...HEAD` and `git diff --name-only` —
  the union of these two is the **changed set** that drives test selection.
  Use repo-root-relative paths.
- If the working tree is completely clean and there are no commits ahead of
  `origin/master`, stop — nothing to ship.

### 2. Run /simplify on the changes

Invoke the existing `simplify` skill via the `Skill` tool. It reviews the
changed code for reuse, quality, and efficiency and applies fixes.

If `simplify` writes any new edits, re-run `git status` afterwards so the
test step picks them up. **Do not skip simplify**, even if the diff looks
trivial — that decision is the skill's, not yours.

### 3. Pick the test suites to run

Match the **changed set** against these path globs and run only the
intersecting suites. Run them in parallel where they don't share state.

| Changed paths                                              | Run                                                                                       |
|------------------------------------------------------------|-------------------------------------------------------------------------------------------|
| `backend_py/**` (any `.py`)                                | `uv run pytest`, `uv run ruff check`, `uv run pyright` (from `backend_py/`)               |
| `frontend/**` (`.ts`, `.js`, `.svelte`, `.json`)           | `npm test`, `npm run check` (from `frontend/`)                                            |
| `e2e/**`                                                   | Ask the user before running — e2e is slow. If they say yes: `npm test` from `e2e/`.       |
| `template.yaml`, `samconfig.toml`, `Makefile`              | No test command, but call them out in the PR body so the user double-checks SAM build.    |
| `.github/workflows/**`                                     | `gh workflow view <file>` to confirm syntax; mention in the PR body.                      |
| `.claude/**`, `*.md`                                       | No automated test. Skip silently.                                                         |

If any command fails, **stop** — do not commit. Surface the failure, ask
the user how to fix. Never paper over with `--no-verify` or skipping
tests.

### 4. Commit

If `git status` shows changes after simplify, stage them and commit. Mirror
the repository's commit-message style (look at `git log --oneline -5` for
recent format). Keep the subject ≤72 chars in imperative mood; add a short
body when the change is non-trivial. Always include the Claude
co-author trailer:

```
Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

If the working tree is already clean (everything was committed earlier),
skip this step and proceed to push.

### 5. Push

`git push -u origin <branch>` if the branch has no upstream, otherwise
`git push`. Never force-push from this skill.

### 6. Open the PR

Use the existing CLAUDE.md pattern: title ≤70 chars, summary bullets,
"Test plan" checklist, Claude Code trailer.

```sh
gh pr create --title "<title>" --body "$(cat <<'EOF'
## Summary
- <1-3 bullets>

## Test plan
- [x] <suites that passed>
- [ ] <manual steps if relevant>

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Print the URL `gh` returns at the end.

## Gotchas

- **Backend test execution path**: always `uv run pytest` from
  `backend_py/`, never `python -m pytest` or `pytest` directly — `uv`
  handles the venv and Python version.
- **Frontend cwd matters**: `npm test` / `npm run check` must run from
  `frontend/`, not the repo root.
- **Don't auto-run e2e**: it spins up DynamoDB Local + backend + frontend
  and takes minutes. Confirm before invoking unless the user explicitly
  asked.
- **Issue references**: if the branch name matches `*/<number>-*` or the
  commit history mentions `#<n>`, add `Closes #<n>` to the PR body.
- **Untracked unrelated files** (e.g. `.claude/skills/<other>/`): don't
  stage them. Stage only files that belong to this change.
- **Dirty `master` from earlier work**: if you find yourself on
  `master`/`main`, stop. The user can rename the branch or check out a
  proper feature branch first.

## Example

```
User:   /ship
Claude: Changed paths: frontend/src/graphTools.js, frontend/src/initialLayout.ts, …
        → running simplify on diff
        <simplify runs, makes no edits>
        → frontend changes detected; running npm test + npm run check
        <both pass>
        → committing, pushing, creating PR
        PR: https://github.com/Salamahin/stemma/pull/93
```
