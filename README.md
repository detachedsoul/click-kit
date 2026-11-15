# ClickKit

ClickKit is a collection of practical, browser-based utilities for everyday digital tasks. The interface is being built incrementally; catalog entries are labelled as in progress until their functionality is implemented and verified.

## Local development

- Node.js 20.9 or newer
- `npm install`
- `npm run dev`

## Quality checks

- `npm run lint`
- `npm run build`

## Structure

- `src/app` — App Router routes, metadata, and global styling
- `src/components` — shared shell and discovery components
- `src/lib/tools.ts` — canonical tool and category catalog
- Future tool logic belongs in focused feature modules under `src/features`
