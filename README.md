# ClickKit

### Everyday digital tools, without the fuss.

ClickKit is a growing collection of small, practical tools for the digital tasks that pop up every day. Count and reshape text, check a calculation, convert a measurement, or get a quick answer without signing up or working through a complicated workflow.

Tools are designed to be quick, clear, and private. Most work right in your browser, so what you enter stays on your device.

## Find a tool

- **Text & writing** — count, clean, compare, convert, hard-wrap, run Caesar and ROT13 ciphers on, spot invisible characters, and analyse text, including word and phrase frequency, keyword density, readability, and extraction.
- **Calculators** — solve everyday sums and advanced scientific calculations, including trigonometry, statistics, combinatorics, and numerical integrals; calculate percentages, discounts, sales tax, loans, and compound savings growth; split bills, add up time durations, compare unit prices, work out a GPA, compare dates with working-day counts, resize with an aspect ratio calculator, convert Roman numerals and number words, convert units, explore fuel economy and geometry, and view BMI as a general adult screening measure.
- **Developer tools** — format, flatten, compare, patch, and convert JSON, YAML, TOML, XML, and SQL; generate TypeScript types, Zod schemas, Go, Rust, Python, Java, C#, Kotlin, and Swift models, and JSON Schemas; turn JSON into SQL; encode Base64; convert CSV and JSON; query JSON with JSONPath; validate JSON against a schema; hash local files; generate `.gitignore` templates; inspect `.env` files; explain cron schedules; compare semantic versions; calculate subnets and Unix permissions; check color contrast; generate and inspect UUID, ULID, and NanoID identifiers; generate hashes; test regular expressions; inspect URLs, convert query strings and cURL commands, look up HTTP status codes, convert number bases, escape strings, look up MIME types, review HTTP headers, format JSON Lines, test XPath queries, sign HMACs and generate TOTP codes, convert docker run to Compose, convert CSV/TSV to JSON or SQL, re-indent code, convert HTML to JSX, build CSS gradients, convert .env files, optimise SVG markup, extract JSON from SQL inserts, generate Mongoose/Prisma models, build fluid clamp() sizes, convert Compose services back to docker run, inspect MongoDB ObjectIds, generate C#, Kotlin & Swift models, convert SQL DDL to Prisma/TS/Mongoose, draw Mermaid ER diagrams from JSON, generate seedable JSON fixtures, and verify supported JWT signatures; generate colour shade ramps for CSS or Tailwind, read browser user agent strings, and work with Unix timestamps; and split long copy into numbered chunks for character limits.
- **Image & files** — generate QR codes, resize, compress, and crop images, build a full favicon set from one picture, rasterise SVG to PNG, pull the dominant colours out of a photo, read EXIF and image metadata, check what a file really is from its signature bytes, rotate and mirror a photo, stamp text or your own logo as a watermark, apply filter adjustments, strip metadata before sharing, generate placeholder images, pack several files into a ZIP, frame a screenshot for a post, redact private details, split an image into a grid of tiles, sample exact pixel colours, convert a whole batch of images at once, tile a contact sheet, compare two versions behind a slider, split a file into parts and join them again — all locally in your browser.
- **Productivity** — generate strong local passwords, run a focus-and-break timer, pick fairly from a list, shuffle names into balanced teams, or find a meeting hour that works across time zones.

ClickKit is built around a simple idea: help you finish the task and get on with your day.

## Recently added and the changelog

New tools are tracked automatically. `lib/tool-dates.generated.json` maps every tool to the day it first appeared in the catalogue, read from git history by `npm run tool-dates`; the site marks anything inside a two-week window with a **New** badge, lists it in the *Recently added* section on the home page, and dates it on its own page.

`npm run changelog` turns the commit history into `lib/changelog.generated.json` and `CHANGELOG.md`, which the `/changelog` page renders day by day.

## Pages that stay current without a reload

Every deploy publishes its identity at `/api/version` — the newest generated changelog commit plus the catalogue size. The root layout hands that same string to `components/live-updates.tsx`, so an open tab knows which build it is looking at. It re-checks 8 seconds after load and then every 45 seconds (and immediately when the tab is focused or the connection returns); when the served build differs, listings, the home page, and the changelog call `router.refresh()`, which re-renders the server components in place — new entries and tool lists appear without a reload, and scroll position and filters survive. Tool pages are the exception: they can hold a loaded picture or a half-finished setup, so instead of swapping the app under someone they show a notice with a **Refresh now** button (and a warning that refreshing clears anything loaded there). A small status line says what changed, and the changelog adds a manual "Check for new entries" button. The service worker deliberately never caches `/api/` responses or Next's RSC payloads, so an in-place refresh always reaches the newest deployment.

## Install it, and get told when a tool lands

`app/manifest.ts` plus `public/sw.js` make ClickKit installable: the service worker caches the shell so tools keep opening when the connection drops, and pages are fetched network-first so a new tool is never hidden behind a stale cache. A card in the corner (`components/pwa-widget.tsx`) invites people to install it — Chrome and Android through the browser's own prompt, iOS through the share-sheet instructions — and remembers a "Not now" for three weeks.

The same card, and a compact switch on `/changelog`, ask for notification permission. After that, when a visit finds tools added since the last alert, the service worker shows one notification; tapping it opens the changelog, or the tool itself when only one is new. What has been announced is remembered as a list of tool slugs rather than a date, because several tools usually land on the same day. An open tab also alerts as soon as its build check sees the new deploy, so a reload is not needed to hear about it. `public/sw.js` also handles a standard `push` event, so a push service can deliver `{ title, body, url }` to the same handler — that is the piece that needs a small server (VAPID keys plus somewhere to store subscriptions), since the site itself is static.

Run `npm run sync-meta` after adding or renaming a tool, and commit both generated files — they are part of the build, not a runtime fetch.

## Tests

`npm test` runs Vitest across `features/**`, `lib/**`, and `components/**`; `npx tsc --noEmit`, `npx eslint .`, and `npm run build` should all come back clean before a change lands.

Every control on a tool page needs a test that exercises it **after the page has state** — a file queued into the contact sheet, a value typed into a field, an option switched twice. A control that stops responding once something is selected (a column count pinned to the number of pictures, say) is a bug, not a cosmetic detail, and the test is what keeps it fixed. Test the ordinary path as well as the edges: clamped numbers, skipped files too large or of the wrong type, and what happens to a result when the settings behind it change.

Have an idea, spotted a problem, or want to help improve a tool? [Report an issue](https://github.com/detachedsoul/click-kit/issues/new), [share a suggestion](https://github.com/detachedsoul/click-kit/issues), or [open a pull request](https://github.com/detachedsoul/click-kit/compare).
