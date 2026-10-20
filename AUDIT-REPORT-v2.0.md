# Evermore v2.0: audit and QA report

This report is for the seller. Don't put it in the buyer ZIP.

## Score

| | v1.0 (as audited) | v2.0 |
|---|---|---|
| Data integrity and backup safety (25) | 17 | 24 |
| Security and privacy (20) | 16 | 20 |
| Correctness of calculations and dates (15) | 11 | 15 |
| Feature completeness against the brief (15) | 8 | 13 |
| UX, accessibility and mobile (15) | 12 | 14 |
| Delivery and commercial readiness (10) | 9 | 9 |
| **Total** | **73** | **95** |

This is my own assessment against the brief, not an independent certification. The optional AI assistant from the brief was built, then removed at the seller's request because it needed buyer API keys. Its two feature points are deducted, and privacy now scores full marks because the planner can't make any network connection at all. The points that are still missing are listed under "Remaining issues" below.

There are **no known critical or high-severity defects.**

## Phase 1: what the audit found in v1.0

| Severity | Issue | Fix in v2.0 |
|---|---|---|
| **Critical** | When the saved data couldn't be read, the warning said it was "left untouched". The next `save()` then overwrote it, so the couple's plan was permanently lost. | The unreadable copy is moved to `evermore_planner_rescue_v2` before anything else can write. The couple can download it, and later saves never overwrite it. |
| **High** | One bad field (an impossible date, a non-number amount, an unknown status) made the whole plan unreadable. Combined with the critical bug above, that meant data loss. | Damaged values are reset to safe defaults, the user sees how many were reset, and the rest of the plan loads. Files that aren't a plan at all are still rejected. |
| **High** | After the wedding date had passed, Settings refused every name edit because it re-checked the old saved date. | Only a *newly chosen* date has to be in the future. |
| **High** | Money was rounded to whole units, so a 0.05 balance showed "paid in full" and totals drifted with float sums. Inputs used `step=50`, which flagged ordinary amounts as invalid. | Amounts are stored and summed in cents. Cents are shown only when present (JPY never shows them). Inputs use `step=0.01`. |
| Medium | `isIsoDate` accepted 2026-02-31, which the browser quietly turned into 3 March. | Dates must round-trip exactly. |
| Medium | `today()` used UTC, so diary entries could be filed under the wrong day. | Local date. |
| Medium | A currency label from an edited backup was printed without escaping in some places, which allowed HTML injection. | The label is limited to letters and currency signs, and every `money()` output is escaped. |
| Medium | The page made requests to Google Fonts on every open, which sent IP and referrer data to Google and broke the look offline. | The fonts are embedded (OFL 1.1, licence included). The page makes zero network requests. |
| Medium | There was no Content-Security-Policy. | Strict CSP: `default-src 'none'` and `connect-src 'none'`, so the page cannot connect anywhere. Also `object-src 'none'`, `base-uri 'none'` and `form-action 'none'`. A test shows `fetch` is blocked. |
| Medium | Restoring a backup replaced everything with no way back, and reset had no safety net. | Three automatic safety copies (daily, and before each restore, reset or Concierge change), undo after a restore, and a summary of the backup before confirming. |
| Low | Several text colours fell below WCAG AA contrast (muted text was 3.8:1). | Raised to 4.9:1 or better. Added a skip link, focus-trapped dialogs with Escape to close, and a label on every control (tested). |
| Low | The phone tab bar wrapped onto 3 rows. | It now scrolls sideways. A test checks for no horizontal page scroll on every tab at 375px. |
| Low | Warnings were rewritten on every keystroke, which also reset a half-chosen file in the restore picker. | They're only written when they change. |
| Low | CSV export garbled accented names in Excel. | The file now starts with a UTF-8 BOM, and the filename is dated. |
| Low | The phone build's CSP blocked its own home-screen icon. That was found during v2 QA, before release. | `img-src 'self'` added. |

## What was built

**Smart Concierge** (offline, rule-based, read-only):
- A Concierge tab and a "next steps" card on Home.
- Areas covered:
  - **Payments:** overdue or upcoming deposits and finals, status/money conflicts, missing due dates.
  - **RSVPs:** urgency scales with days to go; missing meals, unnamed plus-ones, duplicate guests, caterer headcount at 35 days out.
  - **Budget:** not set, over budget, unplanned spending, vendor quotes above their category, payments not reflected in spend, contingency.
  - **Deadlines:** overdue phase, current phase, vows.
  - **Essential bookings:** 8 vendor types against typical lead times.
  - **Backups.**
- Ranks everything and shows the top three as "next three actions".
- Savings ideas, plus the catering cost of each extra guest.
- An offline Q&A box.
- A one-week "Not now" snooze.
- Every one-click fix shows a before/after dialog, takes a snapshot first, and can be undone.

**Optional AI: removed.** A bring-your-own-key AI assistant was built and tested, then removed at the seller's request because it needed API keys. All its code, settings and docs are gone. On load, the planner deletes the two storage keys an early 2.0 build could have used (`evermore_ai_v2` and `evermore_ai_session_key_v2`).

## Phase 6: testing that was actually run

**Automated suite:** `qa/evermore-v2.test.mjs`, Playwright on Chromium, run against the real HTML file over `file://`. **19/19 passed** on the final build. It covers:
- Boot with no errors and no CSP violations; setup validation.
- Opening a v1.0 plan from localStorage (records kept, legacy € migrated).
- Rescue of corrupt storage, and that the rescued copy survives later saves and downloads byte-for-byte.
- Repair of damaged fields, with the count shown.
- Money exact to the cent; JPY in whole yen.
- Name edits after the wedding date.
- XSS payloads in every field, checked on all tabs and the keepsake.
- Concierge ranking, and the headcount rule at 25 vs 40 days.
- Fixes: confirm, Escape, snapshot, undo, snooze.
- Backup round-trip: dated name, restore summary, undo restore, junk file rejected.
- A **v2 backup restored into the real v1.0 file.**
- **Zero network requests** across every tab and the Concierge, with `fetch` blocked by the CSP, leftover AI keys wiped, and no AI wording left on the page.
- The Concierge working with the browser offline.
- Timeline task add, remove and undo; vows in the keepsake; print media.
- No horizontal overflow at 375px on every tab.
- Accessible names on every control.
- Performance with 1,500 guests and 150 vendors: worst tab render about 120 ms, Concierge analysis about 12 ms.

**Phone build:** served over HTTP, the service worker reached "ready", and after going offline a reload worked, including the Concierge tab, with no console or CSP errors.

**Guide:** the START-HERE page makes no network requests, have no horizontal overflow at 375px, and all table-of-contents links resolve.

## Remaining issues

These are all low or medium severity, and none of them block release.

1. **Only Chromium was automated.** Firefox and Safari weren't available in this environment. The code is plain ES5 with standard DOM APIs. Please do a quick manual pass in Safari and Firefox before listing.
2. **The CSP still needs `'unsafe-inline'`** for scripts, because the v1 architecture uses inline handlers everywhere. That's mitigated by escaping everything that's rendered (and tested). Moving to `addEventListener` would allow a nonce-based CSP, but it would mean a large rewrite, which the brief ruled out.
3. **Deletes and restores still use the browser's own `confirm()` dialog.** It's reliable and accessible, but plain-looking. The Concierge's flows use the styled dialog.
4. **Seller to-dos:**
   - Re-deploy `EVERMORE-MOBILE-WEB-v2.0/` to the existing phone link (the sw cache version is bumped to 2.0.0).
   - Refresh the Etsy listing copy and photos to show the Concierge.
   - Have the LICENSE reviewed before publishing.

## Deliverables

- `EVERMORE-WEDDING-PLANNER-v2.0.zip`, the buyer download, containing:
  - `Evermore-Wedding-Planner.html`
  - `START-HERE.html`
  - `LICENSE.txt`
  - `FONT-LICENSE.txt`
  - `CHANGELOG.txt`
- `EVERMORE-MOBILE-WEB-v2.0/` and its `.zip`: the hosted phone build, for the seller to deploy.
- `qa/`: the automated test suite.
- The v1.0 folders and zips are left unchanged for reference.
