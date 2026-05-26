# Admin Mobile Responsive Design

## Goal

Make the Buboo admin dashboard usable on mobile without changing data flow, API behavior, authentication, or desktop layout.

## Scope

- Convert the most operationally important admin tables to mobile-friendly cards:
  - Member search and status management.
  - Participant submission/version review.
- Keep lower-priority admin tables as scrollable tables for now:
  - Match results.
  - Vote statistics.
  - Contact view logs.
- Add a small horizontal-scroll hint for remaining tables on mobile.

## Design

On desktop, keep the existing table layout.

On screens up to 640px wide:

- Hide table headers for card-enabled tables.
- Render each row as a bordered block.
- Use `data-label` attributes on cells so each value appears with a clear field label.
- Stack member profile inputs vertically.
- Keep buttons full-width inside mobile cards.

This preserves one React component per table while using CSS media queries for the mobile presentation.

## Non-Goals

- No visual redesign of brand, colors, or typography.
- No changes to matching logic or member identity logic.
- No change to admin password or secrets in this step.

## Verification

- `npm test`
- `npm run build`
- Manual production smoke after push:
  - `/buboo-ops-local?event=demo`
  - `/e/demo`
