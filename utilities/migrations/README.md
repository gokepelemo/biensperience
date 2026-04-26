# Database Migrations

One-shot migration scripts that must be run on production (and any other
long-lived environment) to keep the database aligned with the current schema.

## Conventions

- File name: `YYYY-MM-DD-short-description.js`
- Standalone runnable: `node utilities/migrations/<file>.js`
- Connects via `mongoose` using `MONGODB_URI` from the environment.
- Idempotent: safe to re-run; tolerate "already done" states gracefully.
- Logs via `utilities/backend-logger.js` (no `console.log`).
- Exports its main function so it can be required from a runner or test if
  needed.

## Pending migrations to run on next deploy

| Date | Script | What it does | Notes |
|------|--------|--------------|-------|
| 2026-04-26 | `2026-04-26-drop-experience-permissions-id-solo-index.js` | Drops the subsumed solo index `permissions._id_1` from the `experiences` collection (bd #8f36.9). The schema declaration was removed because two compound indexes already lead with `permissions._id`, making the solo index dead weight. | Idempotent — tolerates `IndexNotFound` (code 27). Safe on dev/test where the index never existed. |

After running a migration on production, move its row out of the table above
(or delete the row) so the list always reflects what is still pending.

## Related historical scripts

- `scripts/migrate-photos-to-entries.js` — pre-existing one-shot migration for
  the `photos`/`default_photo_id` consolidation. Kept under `scripts/` for
  historical reasons; new migrations go under `utilities/migrations/`.
