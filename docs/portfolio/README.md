# Portfolio media and GitHub presentation

## Included assets

All portfolio screenshots and the walkthrough are in English and use synthetic data. They were captured from the actual React Native Web interface with the repository's Playwright API fixtures. The AI proposal is also fixture-backed. These assets demonstrate UI behavior; they do not establish live provider accuracy, real customer activity, or native device performance.

- `dashboard.png`: sample appointments and the daily overview.
- `houses.png`: synthetic customer/house profiles.
- `schedule.png`: sample appointments in the daily schedule.
- `assistant.png`: readable proposal cards before confirmation.
- `settings-dark.png`: the blue dark theme and preferences.
- `../demo/saboia-cleaning-demo.mp4`: browser interaction recording.
- `../demo/saboia-cleaning-preview.gif`: a shortened animated preview.

The mascot is the app's existing owner-supplied brand adaptation. Customer names, access instructions, phone numbers and production photos were not used in this recording.

## Reproduce the capture

Install dependencies and the Playwright Chromium/ffmpeg dependencies, then run:

```sh
npm ci
npx playwright install --with-deps chromium ffmpeg
RECORD_PORTFOLIO_DEMO=1 npx playwright test --config playwright.auth.config.ts --grep "English portfolio walkthrough"
```

Screenshots are written here and the raw video is written under `test-results`. The opt-in recording is skipped by normal test runs. The capture includes assertions for the real UI flow and explicit confirmation. Short pauses are for recording readability.

Use ffmpeg to export the recorded WebM to MP4 with H.264/AAC-compatible browser settings (this video has no audio):

```sh
ffmpeg -i PATH_TO_RECORDED_VIDEO.webm -an -c:v libx264 -pix_fmt yuv420p -movflags +faststart docs/demo/saboia-cleaning-demo.mp4
```

## Prepared account-level presentation

`github-metadata.json` contains the proposed English repository description, topics and profile bio. `../PROFILE-README.md` contains the prepared English profile introduction.

The repository files can be published through Git. Updating GitHub About/profile fields and creating a profile repository require separate GitHub API access. In this cloud session those API requests were rejected with `Forbidden`, so those account-level changes were not applied.

On a machine with the official GitHub CLI signed in to the project owner's account, run:

```sh
gh auth login
node scripts/publish-portfolio.cjs
```

The script verifies the authenticated account before any changes, updates description/topics/bio, and creates a public profile README repository if needed. It preserves any existing profile README for deliberate merging. It keeps the application repository name and URLs stable for existing update helpers. Credentials remain managed by `gh`.

After publishing, use **Customize your pins** on the GitHub profile to feature Saboia Cleaning. Pinning is a manual GitHub profile operation and is not performed by this script.
