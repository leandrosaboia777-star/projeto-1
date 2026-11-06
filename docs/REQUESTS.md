# Client messages and rescheduling

The iOS app cannot read the iMessage/SMS inbox or intercept incoming messages.
Copy a message into **Overview → Client requests**, or share text from an app
that offers the iOS share sheet. The share extension opens Client requests.
An SMS reply button opens a draft in Messages; the user sends it.

Analyze a pasted message to identify an existing house and appointment. Complete
analysis creates a **pending request**, never a schedule change. If information
is missing, answer the clarification or select the appointment/date manually and
save the request. Reminders begin from the saved request's creation time, not the
time the original SMS arrived.

Each pending request shows up to three suggestions on different days. The initial
window is the requested time onward, over 14 days, Monday–Friday, 08:00–18:00 in
the business timezone. Suggestions reserve the original cleaning duration,
exclude all other scheduled jobs, and allow a 30-minute gap. This conservative
rule does not determine driving times or employee availability. A manager can
enter any valid future date/time manually. The selected time is passed to
`resolve_request` **only on Confirm change**. Existing server conflict checks and
tenant/manager permissions still apply; one occurrence changes, not its series.

## Server reminders

Implemented in migration `202611060006_request_reminders.sql` and the
`request-reminders` Edge Function. This is a new backend feature: it is **not
active just because the source is pushed or a previous app is installed**.

After updating the Mac checkout, with the Supabase CLI already linked and signed
in, run:

```sh
node scripts/setup-request-reminders.cjs
```

The helper preserves `.env` and Apple/EAS settings. It generates a dedicated
random secret under ignored `.expo/request-reminders`, sets that Edge secret,
deploys the function, and writes a private `activate.sql`. Open this local SQL file
and execute it in **your project's Supabase SQL Editor**. It installs the new
migration, stores the dedicated secret in Vault, and schedules Supabase Cron
every five minutes. The migration and setup can be rerun. Never paste the generated
SQL/secret in chat or commit it. No Apple password or service-role key is requested.
The generated SQL requires Supabase's `pg_cron`, `pg_net`, and Vault support and a
project that stays running; check Cron run history for deployment failures.

Install a newly built standalone app, then enable **Settings → Request reminders →
Enable on this phone** as a manager. This requests notification permission and
registers the device's Expo push token, language, and signed-in user. An APNs push
credential must already be configured in EAS. If enhanced Expo push security is
enabled for this project, set its `EXPO_ACCESS_TOKEN` as a Supabase Edge secret.
The previous installed binary has no registration UI and will not receive these
reminders until updated. No new App Store publication is required for an internal
build. Changing backend source does not update a signed app already installed.

The service claims requests pending for at least one hour. It repeats five hours
after the last push accepted by Expo, without needing the app to stay open.
Processing adds up to about five minutes under normal load; delivery also depends
on Expo/APNs, connectivity and iOS Focus/notification settings. This is not an
exact alarm or a guarantee of receipt. Notification text is generic; client
messages, addresses, access codes, and phone numbers are never put in push text
or logs. Tapping a reminder opens Client requests, including from a cold launch.

Service-only queue leases suppress overlapping cron invocations and retry failed
attempts after ten minutes. Approved/declined requests stop producing claims and
are rechecked before sending. A push already in flight can still arrive after a
request is resolved. Expo acceptance is recorded, not proof that the user saw it;
push receipt polling is not implemented. Invalid tokens returned immediately by
Expo are removed. Managers can disable this device; normal sign-out removes its
registration. Unexpected session loss requires re-registering/disabling after
sign-in; push messages deliberately contain no client details.

## Verification

Domain tests cover conflicts, gaps, different-day suggestions, manual dates, DST,
and moved occurrences. PostgreSQL integration tests exercise first due time,
five-hour repeats, lease retries, resolution, tenant recipients, service-only
claims, and token removal. Browser tests verify no approval request before the
explicit confirmation and the manual date flow. These do not prove live APNs
delivery; validate a real saved request and Cron/Edge logs after server setup.
