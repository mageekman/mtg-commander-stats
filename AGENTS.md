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
