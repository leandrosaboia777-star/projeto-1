# Install a standalone test build on the owner's iPhone

The Apple team is `7MWAZDHJCJ`. The linked Expo project is
`@leandrosaboias-team/saboia-cleaning`, ID `4fbec1be-289f-4f57-b6ba-08ede8c06f6b`.
These are identifiers, not credentials. Private Apple passwords, two-factor codes,
certificates, provisioning profiles, and Expo access tokens must not be committed
or supplied through chat.

## First build from the existing Mac checkout

The user already has a working SDK 58 checkout, Expo CLI login, a Supabase `.env`,
and an active paid Apple Developer membership. Use the existing `SaboiaCleaning`
folder. `scripts/iphone.cjs` provides three explicit steps:

```sh
node scripts/iphone.cjs --prepare
node scripts/iphone.cjs --register
node scripts/iphone.cjs --build
```

`--prepare` configures the known signing team, Expo owner/project, standalone
`preview` profile, extension signing metadata, and `.easignore`. It preserves
`.env`, rejects conflicting existing Expo IDs, and creates backups under
`.expo/saboia-backups`. It never initiates a build or authenticates an Apple account.

`--register` runs the pinned EAS device-registration wizard. Open its registration
URL/QR in **Safari on the actual iPhone to be installed**, follow the device-profile
instructions, and return to the terminal. This registers the device identifier
needed for internal distribution. It does not make an App Store submission.

`--build` copies **only the two validated public Supabase connection settings**
from `.env` to the EAS project's `preview` environment, then starts the interactive
EAS iOS build. The script rejects private/`service_role` credentials in those public
fields. Server-only AI and encryption keys remain in Supabase Edge Function secrets.
`.env` files are excluded from uploaded build sources. Public configuration appears
in the generated app bundle by design; server RLS remains authoritative.

The first build needs the user's Apple account authorization/2FA and permission to
create signing credentials for both `com.saboiacleaning.app` and its `SaboiaShare`
extension (`com.saboiacleaning.app.share`). Both use App Group
`group.com.saboiacleaning.app`. Choose the correct Apple team and registered device.
EAS can manage the certificates/profiles; leave their private material in its
credential service. If any identifier is unavailable, stop and review the exact
error before changing app/extension/group identifiers together.

The build profile is **standalone Release/internal**, not a development client and
not a simulator build. Once it completes, open the EAS installation page on the
registered iPhone and follow Install. This version bundles JavaScript and works
without Metro or the Mac running; online data and AI still require Internet access.
Only registered devices included in the profile can install this build. Adding
another phone requires registering it and rebuilding or re-signing appropriately.

A build uses the Expo account's available quota/credits. An Apple membership does
not include paid Expo build capacity. Inspect any EAS plan/quota prompt before
agreeing to a purchase. No remote build has been launched from this workspace.

For native email recovery/confirmation, configure Supabase Auth URL Configuration
to permit `saboiacleaning://auth/callback`. Existing confirmed accounts can sign in
with their email/password. Test real-device speech, encrypted access, notifications,
photos, sharing, and the callback separately after installation.

## Later builds with a GitHub button

The repository includes `.github/workflows/iphone.yml`, triggered **only manually**
via Actions → Build iPhone test app → Run workflow. It tests the source, invokes a
non-interactive EAS `preview` build, and puts the installation-page link in the
workflow summary. It does not publish to the App Store.

Prerequisites:

1. Complete the first interactive build to register the iPhone and provision main
   app/extension credentials in EAS.
2. Keep both public Supabase values in the EAS `preview` environment (the local
   `--build` command configures these).
3. Create an Expo access token for the authorized account and add it to the
   repository's **Settings → Secrets and variables → Actions → Secrets** under
   `EXPO_TOKEN`. Enter the value there directly, never in code/chat. Use a suitably
   limited account/token with project/build permission. This workflow needs no
   Apple password or App Store Connect private key in GitHub.
4. Run the workflow manually. EAS uses the stored signing credentials; expired
   certificates/profiles, new devices, quota, or team changes may require another
   interactive credentials update before automation succeeds.

The automation is configured and locally checked, but its external authenticated
build and resulting install cannot be claimed successful until actually completed.
An App Store/TestFlight release is a separate flow with store metadata, privacy
requirements, and any applicable Apple review.
