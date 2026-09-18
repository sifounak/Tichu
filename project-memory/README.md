# Project Memory

This directory holds historical project context that is useful as reference but too noisy for everyday code search.

## What Belongs Here

- `archive/conversations/`: dated conversation summaries and milestone notes.
- `archive/plans/`: implementation plans kept for historical context.
- `archive/superpowers/`: generated planning/spec artifacts from earlier workflows.
- `archive/results/`: generated test output snapshots and milestone result artifacts.

## What Stays Searchable

- `documentation/`: durable architecture, gameplay, deployment, and decision records.
- `specifications/`: current or traceable product requirements and RTMs.
- `code/`: live application source and tests.

Default `rg` searches ignore `project-memory/archive/` via `.rgignore`. To search archived material, use:

```powershell
rg --no-ignore "search term" project-memory/archive
```

## Status Labels

When adding historical notes, include one of these near the top of the file:

- `Status: Current` for notes still expected to guide implementation.
- `Status: Implemented` for completed work kept as history.
- `Status: Superseded` for notes replaced by newer docs/specs.
- `Status: Reference only` for transcripts, generated outputs, or exploratory material.

Prefer compact durable summaries in `documentation/` when knowledge should guide future engineering.
