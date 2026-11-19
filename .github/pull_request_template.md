Closes #

## What changed
<!-- The change in a few lines, for someone who has not read the issue. -->

## Why
<!-- The problem it solves. Link the issue if it explains this already. -->

## How it was tested
- [ ] `bun run typecheck`
- [ ] `bun run test`
- [ ] Checked in a browser on a phone and a laptop (UI changes)
- [ ] Checked in Arabic, right-to-left (UI changes)

## Privacy
<!-- Ons is privacy-first: anything a match sees, or OpenAI receives, needs a deliberate decision. -->
- [ ] No new data is shown to other applicants, sent to OpenAI, or revealed before mutual acceptance
- [ ] Or: it is, and that is explained above — new shared answers are marked `shared` in `api/src/questionnaire/questions.ts`

## Checklist
- [ ] New user-facing text is in all four locale files (`en`, `fr`, `de`, `ar`)
- [ ] Colours use the design tokens; layout uses logical (`ms-`/`me-`/`ps-`/`pe-`) utilities
- [ ] Title follows Conventional Commits, e.g. `feat(frontend): …`, `fix(api): …`

## Screenshots
<!-- UI changes: before and after. Seeded demo data only — never real applicants. -->

## Notes for the reviewer
<!-- Anything risky, deliberately left out, or needing a decision. -->
