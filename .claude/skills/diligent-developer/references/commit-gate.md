# Commit Gate Protocol

Use this protocol at every HARD GATE (Phase 1.3, Phase 1.5, Step D). The calling section specifies the transcript name, commit format, and what to re-read after clearing.

## Steps

1. **Save conversation transcript** to `conversations/<transcript-name>.md`. Include:
   - **Summary at the top:** Key decisions, outcomes, rationale
   - **Full transcript below:** All messages and decisions since the previous commit
2. Ask the user: "[Gate name] complete. Ready to commit?"
3. Stage all relevant files (code, tests, docs, results, RTM, transcript)
4. Commit using the format specified by the calling section ([commit-formats.md](commit-formats.md))
5. If a remote is configured (`git remote -v` shows output), push: `git push -u origin <branch>`
6. **Clear the context window** using `/clear`. Inform the user: "[Gate name] committed. Clearing context before starting [next phase/milestone]."
7. After clearing, re-read the files specified by the calling section to re-establish context
8. **Do NOT proceed until this commit is done**
