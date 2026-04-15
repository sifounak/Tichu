# ADR-006: pnpm Workspaces + Turborepo Monorepo

**Date:** 2026-03
**Status:** Accepted

## Context

The project has three packages (client, server, shared) that must share TypeScript types,
Zod schemas, and the game engine logic. The shared code must be identical on both client
and server to prevent rule divergence.

## Decision

Use pnpm workspaces for dependency management and Turborepo for build orchestration
across the monorepo.

## Rationale

- pnpm's strict dependency resolution prevents phantom dependencies, where a package
  accidentally imports a transitive dependency not listed in its own package.json
- Turborepo caches build outputs and parallelizes independent tasks (lint, typecheck,
  build) across packages, reducing CI and local build times
- The @tichu/shared package ensures game rules, message schemas, and types are literally
  the same code on client and server with no version drift
- The alternative of separate repositories would require publishing @tichu/shared to a
  registry (npm or GitHub Packages) and managing version synchronization manually
- pnpm's disk-efficient content-addressable store reduces node_modules duplication

## Consequences

- All three packages are versioned and deployed from a single repository
- A change to @tichu/shared is immediately visible to both client and server without
  a publish-and-update cycle
- CI must build in dependency order (shared first, then client and server in parallel),
  which Turborepo handles via its pipeline configuration
