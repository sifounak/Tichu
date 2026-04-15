# ADR-004: CSS Modules + Tailwind v4 Hybrid Styling

**Date:** 2026-03
**Status:** Accepted

## Context

The UI contains both complex custom components (card animations, trick displays with
Framer Motion) and standard layout needs (grids, spacing, typography). A single styling
approach does not serve both well.

## Decision

Use CSS Modules for component-scoped styles and Tailwind v4 for utility classes, with
CSS custom properties in globals.css for theming.

## Rationale

- CSS Modules provide className-based scoping required by Framer Motion's animation API,
  which needs explicit class references for enter/exit transitions
- Tailwind v4 handles utility-level styling (spacing, flex, responsive breakpoints)
  without writing custom CSS for every layout decision
- CSS custom properties in globals.css centralize theming (colors, shadows, radii) so
  both CSS Modules and Tailwind utilities reference the same design tokens
- Pure Tailwind was rejected because card and game components need complex keyframes,
  multi-step animations, and conditional class composition that are awkward in utility-only
- Pure CSS Modules was rejected because it adds unnecessary boilerplate for simple
  layout utilities

## Consequences

- Developers must understand when to use each approach: CSS Modules for animated or
  complex components, Tailwind for layout and simple styling
- The build pipeline must support both CSS Modules and Tailwind processing
- Design tokens live in one place (globals.css) and are consumed by both systems
