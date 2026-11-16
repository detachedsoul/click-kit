# ClickKit

ClickKit is a collection of practical, browser-based utilities for everyday digital tasks. The app is built incrementally; each catalog entry is labelled as ready or in progress. Available tools run locally in the browser unless clearly noted otherwise.

## Local development

- Node.js 20.9 or newer
- `npm install`
- `npm run dev`

## Quality checks

- `npm run lint`
- `npm run test`
- `npm run build`

## Structure

- `app` — App Router routes, metadata, and global styling
- `components` — shared shell and discovery components
- `features/text-tools` — text utility UI, pure transformation logic, and tests
- `lib/tools.ts` — canonical tool and category catalog
