# rca-skills-builder

Scaffold a `CLAUDE.md` file and starter `.claude/skills` into a project.

This repository is intended to be used directly from GitHub. It is not meant to be published to the npm registry.

## What It Creates

- `CLAUDE.md`
- `.claude/skills/debug-issue/SKILL.md`
- `.claude/skills/ship-feature/SKILL.md`

The default `CLAUDE.md` template is specialized for designing React applications for Salesforce, especially Revenue Cloud Advanced workflows.

## Usage

Run it directly from this GitHub repository:

```bash
npx github:your-user/rca-skills-builder
```

Run it against a specific project folder:

```bash
npx github:your-user/rca-skills-builder ./my-project
```

Refresh generated content:

```bash
npx github:your-user/rca-skills-builder --force
```

Replace `your-user/rca-skills-builder` with the actual GitHub owner and repository name.

## Merge Behavior

- If `CLAUDE.md` does not exist, it is created.
- If `CLAUDE.md` already exists, this tool appends a managed block instead of overwriting the file.
- If the managed block already exists, the file is left unchanged by default.
- Running with `--force` refreshes the managed block content.
- Skill files are preserved by default and overwritten only with `--force`.

## Example

Existing project file:

```md
# Existing Project Notes

This project already has guidance.
```

After running the scaffold:

```md
# Existing Project Notes

This project already has guidance.

<!-- rca-skills-builder:start -->
# CLAUDE.md
...
<!-- rca-skills-builder:end -->
```

## Local Development

Run the CLI locally:

```bash
node ./bin/index.js
```

Run it against a test folder:

```bash
node ./bin/index.js ./sandbox
```

## Repository Requirements

This works because the repository contains a `package.json` with a `bin` entry pointing to the CLI.

Current command name:

```bash
rca-skills-builder
```

## Notes

- Node.js 18+ is required.
- This repository can stay public on GitHub while still avoiding npm publication.
- Users do not need to install the package permanently if they run it through `npx`.
