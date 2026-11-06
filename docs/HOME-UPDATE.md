# House covers, saved-content translation and blue branding

The app now uses a soft-blue light palette, a matching navy/sky-blue dark palette,
and an illustrated cleaning mascot based on the owner's supplied business card.
The source icon is a square RGB PNG without transparency. Expo generates the
platform-specific sizes at native prebuild. Existing Apple/EAS identifiers stay
unchanged; native installation is needed to see the new app icon.

## House photos

A manager chooses one photo per house as its cover. It appears instead of the
house icon in the list and at the top of the house details. Existing photos are
not automatically promoted to covers. **Use as house photo** promotes an existing
record; replacing/removing a cover preserves that image among the records.
**Photos and records** stores other images, dates and optional descriptions, with
a larger viewer and manager caption editing. Deleting a record asks confirmation.

Covers and records share the original private storage bucket and house RLS.
Nothing becomes publicly accessible. Short-lived signed URLs refresh while the
image is mounted or on return to the foreground. The server serializes cover
selection and enforces one cover per house. Assigned employees can attach/read
records; managers choose covers, edit descriptions and delete images. The upload
picker allows cropping covers; JPEG, PNG and WEBP up to 10 MB are supported.
Native picker/permissions and live storage still need verification on the phone.

## Saved text translation

Interface translations are separate from record content. The `translate-content`
Edge Function translates descriptive house fields (tasks, restrictions, products,
pets, warnings, notes and parking), team availability, appointment/visit notes,
client request text, photo descriptions and notification text for reading in the
selected pt-BR/en-US locale. Proper names, addresses, phones, IDs and explicit
private access fields are excluded. Original values remain in the database and in
editing forms. Task completion continues to use original task values, so changing
language cannot lose completed checks or silently rewrite records.

Translations use the existing server-only OpenAI key and model. Input/output are
validated and authenticated, and share the assistant's hourly quota. Translations
are cached only in memory, scoped by user and language; switching to a previously
loaded locale reuses the cache. A new session/process may request translations
again. No client texts or signed image URLs are written to unencrypted local
storage by these features. There is no translation API key in the mobile binary.

Translation runs in the background; failures retain original text quietly. Settings offers an explicit retry, without a persistent home-screen warning. Very
long fields beyond 8,000 characters / the bounded request size remain original. AI translations require live deployment/connectivity and
may need review, especially warnings. Browser fixtures verify UI behavior and
original preservation, not actual model quality. No live translation key or
native runtime is available in this workspace.

## Apply on the authenticated Mac

Run `scripts/update-home.cjs` after downloading it from the repository. It checks
file hashes before writing, backs up changed files under ignored `.expo`, and
preserves `.env`, Apple team and Expo project settings. Known old brand background
colors in `app.config.ts` are updated without replacing that configuration file.

Then run:

```sh
node scripts/setup-home-update.cjs
```

This deploys only `translate-content` (no new AI key needed). On macOS it copies
`202611060007_house_cover.sql` to the clipboard. Open **Supabase → SQL Editor →
New query**, paste and run it. If clipboard access is unavailable, open the printed
migration file and copy its contents manually. This migration contains no secret.
It can be rerun. It adds photo metadata/permissions/RPC; existing images remain.

After SQL succeeds:

```sh
node scripts/iphone.cjs --build
```

Install the new successful build over the previous app. Backend setup alone does
not update an installed binary. No App Store publication or new device enrollment
is required for the same registered phone.
