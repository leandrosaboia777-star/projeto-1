# Security and operations

## Implemented controls

- Supabase Auth sessions; PKCE email callbacks. Native session material uses chunked iOS Keychain storage (`WHEN_UNLOCKED_THIS_DEVICE_ONLY`); web sessions use browser storage and depend on a trusted origin and XSS prevention.
- Business isolation with RLS on every application table. Registration assigns a server-created business and manager role. Employee invitations require explicit acceptance, expire in 48 hours, and store only SHA-256 token hashes. Existing operational workspaces cannot be moved by invitation.
- Managers manage houses, staff, schedules, and approvals. Employees read assigned house/series data and update authorized occurrence checklists/status/notes. Employees cannot change their profile business or authentication role. The employee `role` label is descriptive.
- Access instructions use AES-256-GCM, random nonces, and business/house authenticated data. The encryption key lives only in Edge Function secrets. Clients cannot query the envelope table. The private-access function checks the caller's actual tenant/assignment before using its admin client. Access reads/writes are audited without logging plaintext.
- Property photos use a private bucket, 10 MB limit, image MIME allowlist, tenant/house path restrictions, RLS, and short-lived signed URLs. These URLs are bearer capabilities until expiration; do not share them publicly. The image picker strips quality/metadata according to platform behavior; inspect production EXIF handling before storing sensitive photos.
- Assistant requests are authenticated, bounded, rate-limited to 60/hour/user, parsed against shared validation, and use the caller's RLS-visible database context. The API key never enters the app bundle. The model proposes; a separate explicit confirmation endpoint executes an atomic database transaction. Repeatedly confirming the same natural-language proposal can create another row; there is currently no durable client operation-id/idempotency ledger.
- Scheduling writes are manager-only transactional RPCs, serialize per business, validate same-tenant references and recurrence dates, and reject overlapping houses/shared employees. Rolling conflict validation covers 365 days from the changed start. Free-text availability, indefinite future collisions, and travel conflicts need further product work.
- Audit logs record entity IDs, action, actor, and time, without copied client/access contents. The actor of server-admin envelope writes is additionally recorded explicitly. Administrative queries and key rotation require separate operational auditing.
- No service-role credential is present in frontend source. `.env`, generated native output, and build caches are ignored. TLS, package checksums, and signatures remain enabled.

## Before real customer deployment

Use HTTPS on the deployed origin. Configure Auth confirmation/SMTP, password policy, rate limits, and abuse controls on the Supabase project. Test every role with actual Supabase Auth/Storage and device builds. Define employee access retention, especially access to houses from historic recurring assignments. Current access is assignment-based, not limited to a narrow appointment time window. Employees on a series can view its base schedule; occurrence updates use occurrence-specific assignments.

Add account/business deletion, retention and export workflows, invitation revocation UI, stronger access-code reveal controls, and step-up authentication for especially sensitive actions. Do not represent this implementation as a completed security certification or penetration test. An owner cannot promote an employee authentication account from the ordinary UI; use a carefully audited backend administrative procedure if needed.

Speech recognition may use Apple's/browser vendor's online services. The assistant sends your explicitly entered/shared instructions plus a bounded authorized set of client/schedule context to the configured AI provider. Explain this to users, obtain the appropriate consent, and configure provider retention/DPA requirements before operational use. Sensitive access extraction is sent to that provider only when included in an instruction. Text histories are held in UI memory; the app has no permanent assistant conversation table. Shared text is temporarily stored in the private App Group container until consumed when opening the app. Device Keychain and App Group protection do not replace device passcodes and proper signing.

## Backup and recovery strategy

1. Enable Supabase managed daily backups and PITR where available. Define business recovery targets and retention.
2. Maintain independent encrypted offsite PostgreSQL backups through the project's supported export/backup mechanism, including policies and migrations. Never put backup credentials in the mobile application.
3. Back up private Storage objects separately: database backups do not contain object file bytes. Retain metadata and object paths consistently.
4. Keep the access-encryption key version in your secure key manager and in an independently recoverable secret backup. Do not rotate by simply replacing the key: deploy a versioned decrypt/re-encrypt migration and retain the old key until all envelopes are verified.
5. Perform a restore drill into a separate Supabase project: restore tables/policies, restore objects, inject secrets, test tenant isolation, check actual encrypted access reads and signed photos, and verify calendar/visit history. Verify restored user authentication behavior separately.
6. Record restore evidence and restrict who can read backups. Never test a restore by overwriting production.

Backup jobs, PITR, monitoring, restore drills, and encryption-key rotation are operational configuration that has not been executed in this workspace. The repository contains a strategy, not a claim that automated backups are running.
