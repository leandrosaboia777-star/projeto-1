# Daily Scripture and reflections

The home screen no longer displays the persistent translation loading/error
banner. Failed translations retain original text quietly. Settings has an
explicit **Retry saved information translation** button. Other operation errors
still appear normally; the translation service itself is unchanged.

The new Scripture feature is enabled by default on each signed-in device:

- A morning reading opens on the first use of each business calendar day.
- A closing reading opens when every non-canceled appointment visible in that
  day's schedule has a corresponding completed visit. Zero appointments or only
  canceled appointments do not count as a completed workday. Duration/clock time
  never marks visits complete and never triggers the closing message by itself.
- Each automatic reading is shown once per user/day/period on that device.
  Tapping a notification can reopen it. Continuing opens the schedule.
- Each reading includes a short Scripture excerpt, reference and a separate
  original reflection. The embedded collection rotates seven morning and seven
  closing readings, in pt-BR/en-US, without an AI call or Internet dependency for
  the reading. English excerpts use the public-domain KJV; Portuguese uses
  modernized Almeida wording. Reflections are explanations, not additional
  Scripture. Optional audio plays only when the user taps Listen.

## Phone notifications

Morning defaults to **07:00 in the business timezone**, adjustable in Settings →
Scripture and reflections. The first native use can request iOS notification
permission; the app does not repeatedly prompt after denial. Permission is
required for phone alerts, not for the in-app reading. Settings can disable the
feature or save preferences without notifications. Preferences and automatic
reading markers are local and scoped by user ID. Normal sign-out cancels these
local alerts.

Morning notifications contain the passage, reference and reflection, and are
scheduled for a rolling 14-day window. Opening/foregrounding the app renews this
window. Delivery depends on iOS, permission, connectivity-independent local
scheduling, Focus modes, device power, and app installation. Notifications may be
visually shortened by iOS; tapping opens the full reading. If the app is not
opened for more than 14 days, these varying daily notifications stop until it is
opened again. This feature does not require a server cron, push token, new SQL,
or new AI key. The existing schedule reminder planner now cancels only its own
alerts, preserving the Scripture notifications; together the current planners
remain within iOS's pending-notification limit.

A closing notification is emitted after completion is observed in this running
app and only if notifications are enabled/permitted. It is not a new server push
worker: a completion entered on another device reaches this device on its next
successful data sync/app opening. The calendar detail closes after a successful
completion; the reflection uses an app overlay to avoid presenting a second
native modal over that detail screen. Actual visit completion still needs the
existing backend operation. Cached sign-in is sufficient for a morning reading
when profile refresh is unavailable.

## Update

On the authenticated Mac download and run `scripts/update-devotions.cjs`. It
preserves `.env` and Apple/EAS identifiers, verifies downloaded hashes and makes
backups under `.expo`. Then generate/install a new standalone build with:

```sh
node scripts/iphone.cjs --build
```

No Supabase changes are required for this update if the earlier home update was
already installed. This workspace verifies domain rules, bilingual UI behavior,
notification planning with mocked native APIs (including DST and preservation of
work reminders), and the JavaScript iOS bundle. Actual iPhone alert/audio
permission and delivery need verification after installation.
