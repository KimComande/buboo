# Member Alias History Design

## Goal

Make member search explain why a result matched old names or nicknames, and show the participation history behind those aliases.

## Design

- Keep the existing phone-based member identity model.
- Keep search matching against canonical, latest, and alias fields.
- Add submitted name and submitted nickname to each admin member history item.
- Show aliases in the member search row:
  - Name aliases when present.
  - Nickname aliases when present.
  - Recent participation history using event date, participant label, submitted name, and submitted nickname.

## Scope

- Admin dashboard payload and UI only.
- No database schema changes.
- No search algorithm changes.
- No participant-facing page changes.

## Verification

- Add a domain test proving member history carries submitted nicknames across repeated participation.
- Add a UI source test proving alias/history copy is rendered in the member row.
- Run `npm test` and `npm run build`.
