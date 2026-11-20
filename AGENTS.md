# Ledger stat releases

When adding any new Ledger statistic:

- Register a permanent release ID, setting key, label, and description in `ledger-stat-updates.js`.
- Missing settings must default to **off for existing players**. Do not extend `legacyKeys` in `ledger-settings.js`: that list preserves only the original display choices. Do not enable a new stat through `public_full_stats` or other existing preferences.
- Queue the release ID for existing accounts with a one-time, idempotent migration. Never re-queue an already dismissed release. New profiles may opt in through the `ledger_settings` column default and must not receive historical announcements.
- Use the single `ledgerStatUpdates` notice and bulleted list; never create a separate notice per stat. Its Ledger Settings link must open the settings dialog and work as a direct link.
- Dismiss only the displayed release IDs using the owner-scoped `dismiss_ledger_stat_updates` RPC. Keep dismissal account-persistent and preserve releases added concurrently.
- Add tests for existing/new account defaults, preserved saved preferences, combined announcements, persistent dismissal/retry, owner isolation, and responsive chart/settings layouts.
- Public-profile sharing and share-image visibility require explicit handling; a new private Ledger stat must not become publicly visible automatically.

# Share exports

- Apply the empty-data rule to every share feature: omit unavailable fields, empty groups, unqualified deck slots, and entire cards with no populated content.
- Preserve meaningful recorded zeroes and explicit colorless identities. Never substitute zero or colorless for missing data.
- Build the layout from populated sections so remaining artwork and stats reflow without reserved placeholder gaps. Keep existing display/privacy settings in force.
- Cover sparse histories, missing comparisons/rivals, all-hidden settings, true zeroes, colorless data, and partial multi-image exports in regression checks.

# Universal deck preferences and new-account defaults

- Deck visibility and interactive-stat preferences live in the owner profile’s `deck_settings` and apply to every existing and future deck, including share exports. Do not read/write legacy per-deck `stat_settings` for current UI preferences.
- Creating a deck must preserve the user’s saved universal choices. New accounts and untouched defaults start with every deck and private Ledger stat/feature enabled.
- Keep existing users’ Ledger choices, public-profile privacy permissions, and announcement dismissals unchanged when updating signup defaults.

# Public changelog

- After preparing a major feature, meaningful bug fix, or stability improvement, ask the user whether they would like it added to the public changelog. Do not add an entry automatically or treat permission to implement/publish the feature as permission to add a changelog entry. This question must not block the authorized feature work.
- When the user approves a changelog entry, update `site-changelog.js` with a brief player-facing summary and publication date, newest first. Group related changes and omit minor positioning or cosmetic tweaks.
- Describe completed behavior without implementation details, private data, or unshipped promises. Keep older entries when adding new ones. Refresh the changelog import version in `site-footer.js` and footer script references when entries change.

# Playgroup membership

- Playgroups are private. Members and authenticated players with a valid invite link or pending invitation may view group details and member identities. Neither invitation nor membership grants access to a player's private Ledger, decks, or stats. Game sharing and group statistics require a separate implementation and consent model.
- Keep tables in the private schema without direct client grants. Public RPC wrappers use security invoker; private implementations must authenticate and authorize every operation. Do not derive roles from user metadata.
- Serialize membership, ownership, and invite-link mutations on the group row. Owners must transfer ownership or delete the group before leaving; only owners may appoint admins or transfer ownership. Admins cannot remove other admins or owners.
- Invitations require explicit acceptance. Copyable invite tokens stay only in private tables and are exposed through member-authorized copy RPCs. Each sharing member has a stable attributed link; owner/admin reset invalidates all existing group links. Links expire after 30 days and must be checked again under the group lock when joining. Invited viewers may see the roster, but never management controls, other invitations, or personal Ledger stats. Signup metadata is untrusted: validate the bearer token in the database and create only a pending request, never automatic membership.
- Leaving, removal, and group deletion must not change personal Ledger games or decks.

# Playgroup games

- A new or imported Ledger game defaults to no playgroup. Suggestions from tagged co-members must require an explicit choice; never assign a group automatically or backfill existing games.
- Shared game snapshots exclude personal notes and private deck lists. Ledger copies and group snapshots remain independent; explain that clearing the field or editing/deleting a Ledger copy does not remove an existing group snapshot.
- Independent accepted copies retain one shared event identity, so each playgroup counts the event once. A later copy cannot overwrite the first submitted snapshot.
- Only current group members can read game snapshots. An invitation permits roster previews, not access to member-only game history.
- Group-only tags use recorded participant IDs, not live friend links. Co-membership must not grant friend-only deck access or include non-friends in Friends statistics. Preserve normal system updates such as unfriending and group deletion.

# Playgroup dashboard

- Aggregate only `private.playgroup_games` snapshots, never personal Ledger games or private profile statistics. The public stats wrapper stays security invoker and the private implementation must require current membership; invitees cannot view the dashboard.
- Count each shared event once. Player rankings use recorded participant IDs and current membership, never names/handles guessed from free text. Win-rate ties use games played, followed by stable identity ordering.
- Commander performance counts seat appearances, including guests and former members in shared history. Mirrored commanders have multiple appearances and only the winning seat earns a win. Keep this denominator clear in the UI.
- Filter dates in the database before aggregating, use the existing group/date index, and return aggregates rather than downloading game histories. Keep ranking/commander pagination compact and reuse the central artwork cache and saved passport framing.
