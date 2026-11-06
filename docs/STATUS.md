# Delivery status

## Implemented

- Expo SDK 58 / React Native / TypeScript application with responsive iPhone/desktop navigation, original branded icon and house illustration, light/dark appearance, and pt-BR/en-US UI.
- Supabase Auth registration/login/recovery, PKCE callback handling, native Keychain sessions, isolated business creation, employee invitation acceptance, role/assignment-based RLS, and audited writes.
- Client/house fields, manual CRUD, checklists, restrictions/products/pets/warnings, encrypted access instructions, private property/completion photos, staff CRUD and initial avatars.
- Daily/weekly/monthly grouped calendars and employee filtering; one-time/weekly/biweekly/monthly/custom N-week recurrence, individual exceptions, future-series splits, whole-series changes, estimated end times, employee assignments, overlap/duplicate prevention.
- Cleaning statuses and checklist completion, server-recorded actual start/end, notes, historical duration suggestions that managers explicitly apply.
- Authenticated bilingual AI extraction/search/answers with editable structured proposals, follow-up output, and explicit confirmation. House+schedule+encrypted access can commit atomically. Secrets remain on the server. Per-user assistant rate limit.
- Database-grounded daily text/voice briefing, local morning/upcoming reminders, in-app change/request alerts, Apple Maps address navigation.
- Explicit client-message import, AI-assisted rescheduling extraction, pending-request storage, manager approve/decline/manual alternatives, SMS draft composer.
- Native iOS Share Extension source, App Group bridge, target generation, and signed-build configuration.
- Five database migrations, opt-in sample seed, repeatable setup scripts, domain/database/encryption/browser tests, and operational/iOS documentation.

## Verified in this workspace

The final command outcomes are listed in the handoff. Test categories are intentionally distinct:

- TypeScript application/test/seed compilation.
- Domain tests with actual recurrence across DST, monthly missing dates, exceptions/cancellations, conflict overlap, cutoff behavior, duration learning, schema rejection, bilingual database-grounded briefings, partial edits, and cross-device timezone consistency.
- Real PostgreSQL 17 migration application and integration assertions using minimal Auth/Storage fixtures: business isolation, employee admission, unauthorized writes, duplicate rejection, DST, one-occurrence cancellation, nonexistent dates, visit transitions, ciphertext table isolation, audit events, and atomic assistant rollback.
- Deno server-function type checks and actual Web Crypto AES-GCM tests (round-trip, random nonces, authenticated tenant binding, invalid keys).
- Chromium: honest unconfigured setup/localization and fixture-backed manager sign-in, house save, scheduling, AI review without automatic writes, mobile navigation, Portuguese, and dark mode. Fixtures are test-only, never an application fallback.
- Expo web production export and iOS JavaScript bundle export. Expo iOS prebuild generates the Xcode app and Share Extension targets; this is not a signed native build.

Screenshots in `docs/screenshots` come from browser tests. Authenticated screenshots use explicit test fixtures; they are not evidence of a connected production account.

## Required external configuration / unverified integrations

The user has configured Supabase and Apple/EAS accounts and reported a working installed iPhone app. This cloud workspace has no live Supabase/Apple credentials and cannot independently verify those integrations or deliver a new signed binary. New migrations, server functions, automation and native changes still require deployment on the authenticated Mac and device verification. No App Store submission was made.

Use README.md to create/link the intended Supabase project, apply all migrations, deploy the functions, supply server-only secrets, and populate the two public frontend variables. Use docs/IOS.md for Apple signing/App Groups. You do not need to send secret values through chat.

## Still unfinished / release limitations

- Hosted integration and physical-device testing, release hardening, monitoring, backup automation/restore drill, account deletion/export and privacy/retention UX.
- Server-scheduled morning dispatch, per-category notification preferences, local briefing reminder resync without opening the app, and interactive notification approvals. Local briefing/appointment reminders cover seven days. Server request reminders are implemented separately; deployment and live APNs delivery still require verification (see REQUESTS.md).
- Embedded map display, genuine routing/travel estimates, route optimization, and travel-aware conflict detection. Only real-address Maps links are implemented.
- Employee profile-photo uploads and a richer avatar editor. Initials/color architecture exists; advanced avatars are intentionally deferred.
- Dedicated custom holiday calendars and arbitrary RRULE editors. Current custom recurrence is every N weeks; holidays/skips use individual cancellations. Monthly UI is a grouped agenda, not a month grid. Default monthly series skip nonexistent dates.
- Staff availability is descriptive text. Cross-business scheduling and automatic availability matching are not implemented. Conflict checks cover the next 365 days, rather than proving an infinite series collision-free.
- Full multi-action conversational planning, durable operation idempotency, an undo history, and quality/evaluation tests with an actual bilingual AI provider. AI assignment changes currently target individual occurrences; broader edits remain manual.
- Pause-adjusted active labor duration, staffing-normalized statistical estimates, and historical-time charts. Current suggestions use elapsed completion time and require at least three visits.
- Employee role promotion, invitation revocation, and business-timezone editing UIs. Authentication roles are not elevated by editing employee labels.
- Native code compilation and signing on macOS/EAS; iOS native source generation alone does not establish runtime compatibility.

High/critical npm advisories were addressed with patched validation/build dependencies. Remaining moderate/low advisories in the pinned Expo/build-tool chain are recorded by `npm audit --omit=dev`; audit findings require reassessment before release. Compatible dependency overrides are verified by the build/prebuild checks, not a claim that every native dependency has been independently audited.

The future roadmap (payroll, invoicing, customer portal, payments, consent-based tracking, advanced avatars, inventory, Apple Watch/Siri/Shortcuts) is intentionally not implemented. The tenant-scoped data and feature modules provide extension points without placeholder buttons for those features.

The SDK 58 migration adds official iOS 27 scene lifecycle generation, safe-area API updates, matching speech/native dependencies, Device Hub support, and generated-native scene checks. Browser, domain, and bundle checks are repeated after migration; signed macOS native compilation and iPhone/simulator runtime must still be verified on the user machine.

Owner-provided Apple Team ID and the confirmed Expo owner/project are now configured.
The preview profile generates a standalone internally distributed iPhone build;
the guided setup and manual GitHub build workflow are included. Tests verify local
configuration preservation, public-only connection settings, and extension signing
metadata. Physical-device registration, Apple credential authorization, EAS token
configuration and new signed build execution remain external steps; the user reported installation of the prior binary.

## Rescheduling update (November 6)

Client requests now propose free windows and allow manual business-time entry;
only explicit confirmation applies the change. Server push reminders (first after
one hour, then every five hours while pending) are implemented with service-only
queue leases and Expo device registration. They require the new migration,
Edge deployment, Supabase Cron/Vault setup, and a rebuilt installed app. Live push
delivery has not been verified from this workspace. See [REQUESTS.md](REQUESTS.md).

## Plain-language assistant review

Assistant proposals now use editable cards in pt-BR/en-US, including client, address, cleaning tasks, schedule, team and protected access details. Raw JSON/UUIDs are not shown. Confirmation is still required; validation errors use field labels. House, partial house edits, employee, recurring schedule and single-occurrence changes are covered by browser tests, with a Portuguese iPhone-sized preview. A newly signed installed build is required to see this UI; the server/database do not need changes for this review update.

## Covers, translated content and blue identity

Implemented selectable private house covers, separate photo records with descriptions/viewer, original-preserving AI translations of saved descriptive content, a soft-blue/navy theme and the owner-supplied mascot adapted as the icon. PostgreSQL tests cover cover selection/replacement/removal and permissions. Browser fixtures cover covers and locale changes without overwriting stored content. New deployment and on-device verification remain necessary; see [HOME-UPDATE.md](HOME-UPDATE.md).

## Scripture and quiet translation fallback

Removed the persistent translation failure banner from the home screen; Settings retains an explicit retry. Added offline bilingual Scripture/reflections with daily in-app markers, morning local notifications at an adjustable time, and a closing message/alert only after all remaining houses are marked completed. Notification scheduling preserves work reminders. This update needs a new signed build, with no new server deployment or SQL. See [DEVOTIONS.md](DEVOTIONS.md) for the rolling notification window and on-device verification limits.
