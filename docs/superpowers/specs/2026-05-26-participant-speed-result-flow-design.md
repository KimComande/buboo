# Participant Speed and Result Flow Design

## Goal

Make the participant voting page feel immediate on mobile during an offline event, and match the expected flow where result lookup appears after voting is closed.

## Decisions

- Keep one participant URL for both genders.
- Server-render the participant event metadata before the client form loads.
- Replace the initial public event API path with a light event-only lookup.
- Keep the public API available for client fallback and external smoke checks.
- Show the result lookup section only when the event status is `closed`, `released`, or `ended`.
- Use a spinner for rare fallback loading states instead of visible loading copy.

## Performance Scope

This change optimizes first page load and the public event metadata API. It does not rewrite vote submission storage yet. Submission still uses the existing snapshot mutation path and should be measured separately before a large live event.

## Verification

- Add tests proving the event page receives `initialEventData`.
- Add tests proving the public route uses `readPublicEvent` instead of `readDb`.
- Add tests proving the participant UI uses a spinner and gates result lookup.
- Run full tests, production build, and production response-time smoke checks.
