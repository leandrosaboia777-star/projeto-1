# iOS, speech, notifications, and Messages

## Supported integration boundary

An ordinary third-party iOS app has no public API for reading the user's full incoming SMS/iMessage inbox. Saboia Cleaning does not access it. Use explicit paste/import, or share text through a system share sheet when the source application provides that action. Messages may offer Copy without a general text Share action; in that case paste the copied message into Client requests or the Assistant.

The source includes a native `com.apple.share-services` extension in `targets/share`. It uses Apple's `SLComposeServiceViewController`, accepts shared text, and writes a single pending message into the signed App Group container. The main app consumes/deletes that message on launch/foreground and pre-fills the Assistant. It does not send it to AI or commit database changes automatically. Users explicitly tap Send, review extraction, and confirm changes. The extension deliberately does not try to force-open its containing app through private APIs; open Saboia Cleaning after sharing.

Native generation uses `@bacons/apple-targets`. The main app and extension must both have App Group `group.com.saboiacleaning.app`. The extension bundle is `com.saboiacleaning.app.share`. Set `APPLE_TEAM_ID` before signing and configure both identifiers/entitlements in Apple Developer/EAS. Linux prebuild can generate these targets; native compilation, entitlement provisioning, share-sheet behavior, and actual device permissions require Xcode/macOS or signed EAS builds. They are not yet device-verified.

The Client requests screen offers a prefilled `sms:` link to the system messaging composer. No message is sent automatically. Recipients and draft content remain under user control. Future authorized business-messaging providers should implement a server-side inbound adapter that creates pending `client_requests` only; manager approval remains the sole schedule write path.

## Voice

`expo-speech-recognition@sdk-54` bridges Apple's `SFSpeechRecognizer`, requests speech and microphone permissions, and returns text. `expo-speech` performs text-to-speech. Natural-language understanding runs server-side through the authenticated assistant function. Recognition uses the selected pt-BR/en-US locale; mixed-language text is supported by AI, but mixed-language speech accuracy depends on the installed device recognizer. There is no claim of perfect automatic code-switch recognition.

Speech recognition is not in Expo Go. Use a development build. Denied permissions must still leave typed instructions usable. On web, the app uses the browser SpeechRecognition implementation when present; secure context, microphone permission, and browser service connectivity are required. The app must be opened to speak a briefing; iOS background audio restrictions are respected.

## Notifications

`expo-notifications` schedules local morning summaries and upcoming-appointment reminders on the current device. The next seven days are refreshed while the app runs. Tapping an upcoming reminder opens Schedule; tapping a briefing opens Overview, where the user can tap Read daily briefing. There is no automatic background speech. The app also persists in-app alerts for changed schedules, client requests, and important house warnings.

Cross-device push delivery, durable server-scheduled morning jobs, push-token registration, badge synchronization, and notification category/action handling are unfinished. Local reminders can be stale when another manager changes the schedule while this app remains closed; opening it refreshes reminders. Do not depend on local reminders as a guaranteed dispatch system.

## Maps

`maps.apple.com` opens the actual saved address for navigation. A provider-backed route service, map pins inside the app, travel estimates, and route optimization are not implemented. No placeholder travel times are presented.

## Apple API references

These are the official API contracts used by the implementation. Live Apple documentation fetches were not available under this workspace's current network allowlist; verify the linked documentation and App Store rules when preparing your signed release.

- [Share extensions](https://developer.apple.com/library/archive/documentation/General/Conceptual/ExtensibilityPG/Share.html)
- [SLComposeServiceViewController](https://developer.apple.com/documentation/social/slcomposeserviceviewcontroller)
- [App Groups entitlement](https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.security.application-groups)
- [Speech framework](https://developer.apple.com/documentation/speech)
- [UserNotifications](https://developer.apple.com/documentation/usernotifications)
- [MFMessageComposeViewController](https://developer.apple.com/documentation/messageui/mfmessagecomposeviewcontroller) — reference for a future native composer; current app uses the supported SMS URL route.
- [Apple Maps links](https://developer.apple.com/library/archive/featuredarticles/iPhoneURLScheme_Reference/MapLinks/MapLinks.html)

## Xcode Device Hub compatibility with Expo SDK 54

If `xcrun simctl list devices booted` succeeds but Expo reports it cannot determine
Simulator's app ID, check `osascript -e 'id of app "Device Hub"'`. For Apple's
`com.apple.dt.Devices` application, run `node scripts/expo-device-hub.cjs` on the Mac,
then `npx expo run:ios`. This narrowly scoped temporary helper adjusts Expo CLI 54's
app discovery, running-process check, and activation to Device Hub. It validates
expected installed source/syntax, retains backups, and does not disable native
build, simctl, or signing checks. `npm ci` removes the changes; rerun the helper
if still needed after reinstalling dependencies. Unknown CLI layouts are rejected.
The helper's transforms were checked against the installed CLI on Linux; actual
Device Hub operation and native compilation must be verified on macOS.

## Third-party Pod deployment targets below the installed Xcode minimum

If Xcode rejects third-party resource bundles that declare iOS 12.4 or 13.4,
run `node scripts/fix-ios-deployment.cjs` before `npx expo run:ios`.
The helper preserves user configuration and adds an Expo Podfile config plugin.
Its post-install hook raises Pod deployment targets below 15.1 after React Native's
post-install hook, leaving higher minimums unchanged. Backups are kept in the
ignored `.expo/saboia-backups` directory. Future prebuilds reapply the hook.
Transform/registration tests and native project generation are validated on Linux;
full CocoaPods installation and Xcode compilation require macOS validation.
