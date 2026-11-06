# Saboia Cleaning

An iPhone-oriented Expo / React Native application for a cleaning business, with a Supabase PostgreSQL backend. English and Brazilian Portuguese, light/dark appearance, house profiles, private photos, employees, recurring calendars, cleaning checklists, daily voice briefings, client rescheduling review, and a conversational assistant that proposes changes before confirmation.

**This is an implemented application under development, not a production release.** The source, database policies, recurrence logic, and browser workflows have been tested locally. A live Supabase project, server-side AI/encryption secrets, and an Apple development account are still needed to validate hosted integrations and physical-device behavior. See [delivery status](docs/STATUS.md) for exact limits.

## Run the app

Requirements: Node 22 LTS or Node 24, npm, and a Supabase project (or the Supabase local development stack). The repository is already isolated in `/workspace/projeto-1`; use the existing checkout, without creating a worktree.

```sh
cd /workspace/projeto-1
npm ci
cp .env.example .env
# Fill ONLY the two public Supabase values in .env.
npm start
```

`EXPO_PUBLIC_SUPABASE_URL` is the project URL. `EXPO_PUBLIC_SUPABASE_ANON_KEY` is its public anon/publishable key; authorization is enforced with database policies. Never put a service-role key, AI key, or encryption key in an `EXPO_PUBLIC_*` variable. Without these public values, the app displays connection instructions and does not fabricate client data.

For web: `npm run web`. In this managed environment, `EXPO_OFFLINE=1 npm run web` skips Expo's optional remote compatibility lookup. It does not disable npm integrity or TLS verification. Use a supported Chromium browser for web speech recognition. On iPhone, use the development build described below. Expo Go can exercise ordinary screens, typing, photos, and speech synthesis where supported; speech recognition and the Share Extension require a native development build.

## Set up Supabase

Install the [Supabase CLI](https://supabase.com/docs/guides/cli), sign in to your account, and link the intended project. Review migrations before applying to any existing database.

```sh
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
supabase functions deploy assistant --import-map supabase/functions/deno.json
supabase functions deploy confirm-proposal --import-map supabase/functions/deno.json
supabase functions deploy private-access --import-map supabase/functions/deno.json
```

All five migrations in `supabase/migrations` are required. They create business-scoped tables, authentication registration, recurring scheduling RPCs, audit logs, private photo policies, employee invitations, and assistant confirmation. `supabase/config.toml` disables the gateway's legacy JWT verification for Edge Functions because each function explicitly calls `auth.getUser` with the incoming bearer token. No request bypasses that check.

In the Supabase dashboard, set **Edge Function secrets** securely:

| Secret | Purpose |
| --- | --- |
| `OPENAI_API_KEY` | Natural-language extraction and database-grounded answers |
| `OPENAI_MODEL` | Optional model override; defaults to `gpt-4.1-mini` |
| `ACCESS_ENCRYPTION_KEY` | 64 hexadecimal characters for AES-256-GCM access instructions |

Generate the encryption key with `openssl rand -hex 32`, and save it in your secure key manager. Do not commit it or paste it into chat. Supabase automatically provides the function's project URL, anon key, and service-role key. Only `private-access` uses the service-role key, after checking the caller's tenant and assignment with their own RLS-backed client. Keep backups of the encryption key separate from the database; losing it makes stored access instructions unrecoverable.

Enable email confirmations in Auth. Configure your production email/SMTP sender. Set your web origin as Auth Site URL and allow the exact deployed web callback plus `saboiacleaning://auth/callback`. PKCE callbacks exchange codes, and native sessions are stored in iOS Keychain. Password recovery returns to Settings to set a new password. Test confirmation/recovery delivery on your actual project.

Create a manager account from the app. Registration creates a separate business; it never trusts a client-supplied tenant or role. A manager can add employees, reopen a team member, generate a 48-hour invitation code, and share it through their chosen channel. The employee creates/signs into their own account and accepts the code in Settings. Acceptance changes their business and grants the employee role. Established workspaces cannot be silently moved. Employee profile titles do not elevate authentication privileges.

For local Supabase development, run `supabase start`, apply with `supabase db reset`, copy its public connection values into `.env`, and run `supabase functions serve --env-file PATH_TO_SERVER_ONLY_ENV`. Do not use the PostgreSQL test bootstrap as a production migration.

### Explicit sample data

Sample data is opt-in and visibly labeled. Use a confirmed **test** manager account:

```sh
# Set SABOIA_SEED_EMAIL and SABOIA_SEED_PASSWORD securely in your shell.
npm run seed
```

The seed reads `.env`, signs in as that manager, and uses ordinary policies. It skips sample names already present. It never bypasses authorization with an admin key.

## Daily workflows

- **Houses:** add/edit client details, language, contact preference, address, room counts, checklist, products, pets, restrictions, notes, parking, and private access instructions. Add multiple private photos. Assigned employees can read authorized house information. Managers can delete houses and their schedules.
- **Team:** add/edit employee names, phone, availability, roles, avatar color/initials, and active status. Add an invitation to bind the person to their actual account. Availability is descriptive; conflict checking uses assigned appointments, not free-text availability.
- **Schedule:** day, week, month (grouped agenda), and employee views. Add one-time, weekly, biweekly, monthly, or every-N-weeks cleanings. Select employees. Move/cancel one occurrence, future occurrences, or an entire series. Holidays are skipped by canceling individual dates. Conflicts and duplicate overlapping visits are rejected on the server.
- **Cleaning:** mark on the way, start, pause, finish, check tasks, and save completion notes. Actual timestamps are server-generated. Three completed cleanings enable an overridable median-duration suggestion on the house profile. Pauses currently remain part of elapsed duration.
- **Assistant:** speak or type naturally in Portuguese/English; review plain-language cards, edit labeled fields, and confirm to save. House creation can include a recurring schedule and encrypted access instructions in one transaction. Missing facts should produce a follow-up question. Database permissions and constraints remain authoritative if the model produces an invalid proposal. The review groups client, address, cleaning, schedule, and private access details; no JSON editor is shown.
- **Client requests:** explicitly paste/import a message. Complete AI analysis saves a pending request; incomplete details can be filled manually. Up to three free-window suggestions and manual date/time entry are available. Only manager confirmation changes the appointment. Optional server push reminders start after one hour, then repeat every five hours until resolved; deployment is described in [Client requests](docs/REQUESTS.md). A prefilled SMS composer is supported. The user presses Send in the system messaging app.
- **Briefing:** tap to read/speak the current day in the selected language. In Settings, enable local notifications and choose the briefing time. Reminders for the next seven days are refreshed when the app opens or schedules change. Notification permission is device-specific. No automatic background speech is claimed.
- **Maps:** open each real address in Apple Maps. No travel time, optimized order, or routing conflicts are invented. A directions-provider integration is an outstanding feature.

The business timezone defaults to `America/New_York`. Recurring times are expanded using that timezone, including daylight saving. Editing/reading appointment clocks follows the device timezone. Keep team devices in the business timezone for operational clarity. Changing a business timezone currently requires an administrator database update and deliberate review of future recurrence.

## iPhone development and production builds

See [iOS and Messages integration](docs/IOS.md). On macOS with Xcode 27+ for iOS 27, CocoaPods 1.16.2+, and a paid Apple Developer account:

```sh
# Set APPLE_TEAM_ID to your Apple signing team ID; it is not a secret.
npx expo prebuild --platform ios
npx expo run:ios --device
```

Or configure an Expo/EAS project with your own account:

```sh
npx eas-cli login
npx eas-cli build:configure
npx eas-cli build --platform ios --profile development
# Install the signed build on the registered iPhone.
npx expo start --dev-client
```

Set the two public Supabase variables for the EAS build environment as well as local development. Register the main bundle ID, Share Extension bundle ID, and App Group with your Apple team. Update all three together if changing `com.saboiacleaning.app`. App Group entitlement signing is required for sharing text.

For TestFlight/App Store: `npx eas-cli build --platform ios --profile production`, then `npx eas-cli submit --platform ios --latest`. These are delivery instructions, not commands already executed. Supply App Store Connect records, real screenshots, privacy policy/support URLs, speech/photo/notification purpose descriptions, App Privacy disclosures (client data, photos, shared text sent to the AI provider), export-compliance responses, account deletion/data retention flows, and review credentials. See the remaining release work in `docs/STATUS.md`.

## Validation

```sh
npm run typecheck
npm run check:codegen
# After generating ios/: npm run check:ios-scenes
npm test
npm run check:edge
npm run test:edge
npm run test:db        # Requires Docker; isolated PostgreSQL 17, no exposed ports
npm run test:browser   # Chromium; set CHROMIUM_PATH outside this environment
npm run build:web
EXPO_OFFLINE=1 npx expo export --platform ios  # Bundle check, not native compilation
```

The browser suite uses explicit API fixtures to test UI interaction; it is not evidence of live Auth or AI connectivity. The database suite applies all migrations to real PostgreSQL with minimal Supabase Auth/Storage fixtures and checks authorization, recurrence, collisions, and atomic rollback. It does not emulate Supabase's entire hosted stack.

## Structure

`src/domain` contains shared validation, recurrence, briefings, and duration learning. `src/lib` contains authentication, data access, speech, sharing, and local notifications. `src/screens` and `src/components` contain the bilingual responsive UI. `supabase/functions` contains authenticated AI/private-access/confirmation endpoints. `targets/share` is the native iOS Share Extension. `scripts` contains explicit seeding and database checks. Future modules (billing, payroll, consent-based GPS, inventory) can add business-scoped tables and feature screens without coupling to the assistant.

See [security and backups](docs/SECURITY.md), [delivery status](docs/STATUS.md), and [iOS integration details](docs/IOS.md) before handling real customer information.

### Upgrade an existing SDK 54 checkout for iOS 27

The iOS 27 crash `NoSceneLifecycleAdoption` requires the scene lifecycle now generated by Expo SDK 58. `node scripts/upgrade-ios27.cjs` prepares compatible Expo/React/React Native versions and safe-area API updates while preserving `.env` and `app.config.ts` (including EAS IDs). It creates backups under `.expo/saboia-backups`. Then run `npm install`, stop old Metro processes, regenerate only generated native files with `npx expo prebuild --clean --platform ios`, and run `npx expo run:ios`. Existing SDK 54 CLI compatibility patches are removed by the dependency upgrade; do not rerun the SDK 54 Device Hub helper on SDK 58, which supports Device Hub natively. This source/prebuild validation does not establish successful macOS compilation or device execution.

## Owner's signed iPhone build

The Apple team and linked Expo project are configured. See [iPhone installation and build automation](docs/IPHONE.md) for the guided `scripts/iphone.cjs` setup, physical-device registration, first interactive standalone build, and subsequent manually triggered GitHub builds. The `preview` profile works without Metro once installed. Apple/Expo authorization is still required; no signed remote build has been executed in this workspace.
