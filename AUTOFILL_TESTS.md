# Autofill regression checks

Run `npm run test:dropdowns` for the dropdown memory flow. It checks native selects, disabled options, readonly ARIA dropdowns, portal lists, button dropdowns, missing/ambiguous choices, virtualized lists, and saving/reusing a dropdown answer across websites. The picker identifies the question, captures available options, and lets you choose an answer in the assistant before adding it to Entered fields. Native selects and custom comboboxes can reuse the same saved dropdown answer. Search-backed dropdowns that load options only after typing must be filtered in the browser before capture.

Run `npm run test:autofill` after installing dependencies and Playwright Chromium (`npx playwright install chromium`). The fixtures run headlessly with intercepted browser requests; they do not contact employers or submit applications. Memory checks use temporary storage.

The edge suite contains 27 browser cases covering hidden/disabled/readonly controls, anonymous fields, duplicate IDs, checkbox groups, same-name radios in separate forms, question labels, required flags, search/login exclusion, disabled options, uncertain answers, preserving manual values, approved answer-bank overrides, resume versus other uploads, validation visibility, shadow roots, iframes, ARIA comboboxes, conditional fields, stable selectors, picker consistency, inherited frame origins, human attention, missing upload targets, application-tab selection, and full-name mapping.

The companion suite checks exact option matching, picker restrictions, loopback request validation, and the selected-answer approval lifecycle. Initially 15 of the first 18 edge cases failed; all 27 pass after the fixes.

## One filling pipeline

Lever now handles its entry link and delegates to the generic engine. The shared pipeline discovers fields, resolves answers, fills supported controls, and reports validation. Both the picker and filler use the same field descriptions. Frame-aware selectors identify individual controls without relying on unique website IDs.

Saved questions are drafts. Approving a question adds it to Entered fields; those approved answers take priority. Other existing manual values are preserved. Low-confidence optional answers are skipped, and unknown required answers request human input. Only identified resume inputs receive the resume; other attachments remain manual.

The engine rescans up to three times for newly revealed fields. It stops for manual navigation and submission. Slow-loading later fields may need another Scan & Fill. Unsupported custom widgets, closed shadow roots, authentication and CAPTCHA still require manual interaction. Passing these local fixtures does not establish compatibility with every employer's form.
