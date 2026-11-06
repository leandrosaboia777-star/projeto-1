# Saboia Cleaning — product case study

## The problem

A family-run cleaning business needed a clear way to keep client instructions, recurring appointments, access details, photos, and changes together. The primary user needed an interface that made sense during a working day, rather than technical forms or structured code.

The product brief came from direct conversations about daily cleaning work. Requirements were refined using screenshots, owner feedback, and internally installed iPhone builds.

## Product direction

Leandro Saboia led requirements, acceptance testing, connected-account setup, and product decisions. OpenAI coding tools assisted substantially with implementation, debugging, tests, and documentation. Image-generation assistance adapted the business mascot into an app icon.

Examples of feedback that became concrete changes:

| Observation | Resulting change |
| --- | --- |
| A structured AI response was difficult for the business user to read. | Editable cards for client details, address, cleaning tasks, schedule, and private access. |
| A house list needed faster visual recognition. | Selectable cover photos, with other images retained separately as records. |
| Switching the interface language left saved instructions unchanged. | Optional display translation of descriptive text while retaining original records. |
| Persistent translation errors distracted from the daily workflow. | Quiet original-text fallback and a manual retry in Settings. |
| A client message needed human scheduling judgment. | Imported-message analysis, available-window suggestions, manual alternatives, and explicit approval. |
| The user wanted the app to reflect the business identity. | A blue visual system and a mascot adapted from the business's supplied card. |
| The user requested encouragement around the workday. | Optional bilingual Scripture/reflections at the start and after actual completion of the day's appointments. |

## Implementation highlights

### Confirmed AI operations

Natural-language interpretation produces a proposal. Shared validation checks its shape; the user reviews readable fields; a separate authenticated function confirms an authorized transaction. This makes an AI suggestion inspectable before it changes business records.

### Scheduling in a business timezone

Recurring work is expanded using the business timezone. Domain tests cover DST transitions, monthly dates that do not exist in every month, cancellations, moved visits, and series cutoffs. Database operations enforce tenant references and conflicting house/employee assignments within a bounded horizon.

### Access boundaries and sensitive records

Supabase policies separate businesses and limit employees by assignments. Private access instructions are stored as AES-256-GCM envelopes and accessed through a checked server function. Photo covers and records use private storage and short-lived URLs. These are implemented controls, not a claim of completed external security certification.

### Native integration and delivery

The project includes a Share Extension, App Group bridge, native speech integration, local notifications, and internal iPhone build helpers. Installation and Apple/Expo authorization were performed on the owner's machine. Source update helpers preserve local environment/signing settings and verify downloaded file hashes.

## Validation evidence

- Domain and schema tests for scheduling rules, original-preserving translations, and completion conditions.
- Real PostgreSQL integration assertions for tenant/role boundaries, transactions, cover selection, and reminder queues.
- Deno checks and encryption tests for server code.
- Fixture-backed Playwright workflows for the actual responsive interface.
- Expo JavaScript exports and generated-native project checks.
- Owner-reported installation and use of core workflows on a physical iPhone.

The portfolio recording uses synthetic data and API fixtures. It does not establish live AI quality, production backend availability, real device performance, or notification delivery. No numerical business impact has been measured or claimed.

## Current outcome

A working codebase and internally distributed iPhone application have been iterated against the business user's feedback. The owner reported successful installation and operation of core workflows. This is an active product project with documented release limitations, not an App Store launch or a claim of broad customer adoption.

## Next steps

- Complete release/privacy requirements and account deletion/export flows.
- Validate live translation quality, device alerts, recovery paths, and notification preferences.
- Improve travel-aware scheduling and structured availability.
- Strengthen observability, backup/restore drills, and operational support.
- Evaluate broader conversational edits and durable operation idempotency.

## What this portfolio demonstrates

Product discovery with a real stakeholder; translating feedback into UI changes; coordinating mobile/backend/platform setup; evaluating AI-assisted implementation; and documenting what has and has not been verified.

Owner: [Leandro Saboia](https://github.com/leandrosaboia777-star) · [Application source](../README.md)
