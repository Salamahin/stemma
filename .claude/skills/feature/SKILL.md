---
name: feature
description: Open a GitHub issue for a feature request or bug. Triggered by `/feature <description>` (the description becomes ARGS) or when the user asks to "create an issue for X" / "open a feature request for X". Syncs the local `master` first, expands a rough description into a clean issue with title + body + acceptance criteria, asks for confirmation, then opens the issue via `gh issue create`.
---

# /feature — open a GitHub issue from a rough description

## Workflow

### 1. Sync `master` before drafting

The skill name implies the user is about to start a new piece of work; make sure
local `master` is current so the eventual feature branch forks from the right
ref.

- Run `git status`. If the working tree is dirty, **don't silently switch** —
  surface the modified files and ask whether to stash, commit, or abort.
- Run `git checkout master && git pull --ff-only`. If `--ff-only` fails
  (diverged history), surface the error and ask the user how to proceed.

### 2. Decide if ARGS is clear enough to draft

A description is "clear enough" when it has both a verb (add / fix / refactor /
remove / improve / …) and a concrete noun phrase. Examples:

| ARGS                                                  | Clear? |
|-------------------------------------------------------|--------|
| `add dark mode toggle to settings`                    | yes    |
| `support exporting a stemma as GEDCOM`                | yes    |
| `dark mode`                                           | no — what kind of change? |
| `fix the bug where login sometimes fails`             | no — repro steps? |
| `clean up the storage layer`                          | no — what specifically? |

If unclear, ask **1–2 sharp** clarifying questions before drafting — not a
generic "tell me more". Pick the smallest set of questions that lets you
write a useful title.

### 3. Draft the issue

**Title** — imperative mood, ≤70 chars. Reads as a command, not a description.

> Add dark-mode toggle to the settings page

not

> Dark mode would be nice to have

**Body** — one short paragraph of context (what + why), then an "Acceptance
criteria" checklist of observable outcomes:

```
<one paragraph: what + why>

## Acceptance criteria
- [ ] <observable behaviour 1>
- [ ] <observable behaviour 2>
- [ ] <test coverage / migration notes if relevant>
```

Acceptance criteria should be testable from outside ("toggle persists across
reloads"), not implementation choices ("uses CSS variables"). Include test
expectations only when the user implies them.

### 4. Show the draft + confirm

Print the title + body, then ask "create it? [y/N]". Skip the prompt **only** if
ARGS contained an explicit "go" / "just do it" / "create it" — otherwise
always confirm.

### 5. Open the issue

```sh
gh issue create --title "<title>" --body "$(cat <<'EOF'
<body>
EOF
)"
```

Print the URL `gh` returns.

Don't pass `--label` unless the user asked for a specific label, and verify it
exists first: `gh label list --search <name>`.

## Gotchas

- **Wrong repo**: `gh` reads the remote of the current working directory. If
  the user is in a worktree or nested repo, double-check with
  `gh repo view --json nameWithOwner -q .nameWithOwner`.
- **One issue per invocation**: if ARGS describes multiple unrelated changes,
  ask whether to split — don't pack them into one issue.
- **No assignees by default.** The user creates the issue; if they want it
  assigned, they'll ask.
- **Don't open the PR.** This skill ends at the issue. The user (or a later
  flow) creates a branch and opens a PR referencing the issue number.

## Examples

```
User:   /feature add dark mode toggle to settings
Claude: <syncs master, drafts, confirms, opens issue>
```

```
User:   /feature dark mode
Claude: Quick clarification — is this:
        (a) a manual toggle in settings, or
        (b) auto-detect from the OS preference, or
        (c) both?
User:   a
Claude: <drafts, confirms, opens issue>
```

```
User:   /feature add a print-friendly stylesheet, just do it
Claude: <syncs master, drafts, opens issue without confirmation prompt>
```
