# Evermore v2.0: audit and QA report

This report is for the seller. Don't put it in the buyer ZIP.

## Score

| | v1.0 (as audited) | v2.0 |
|---|---|---|
| Data integrity and backup safety (25) | 17 | 24 |
| Security and privacy (20) | 16 | 19 |
| Correctness of calculations and dates (15) | 11 | 15 |
| Feature completeness against the brief (15) | 8 | 15 |
| UX, accessibility and mobile (15) | 12 | 14 |
| Delivery and commercial readiness (10) | 9 | 9 |
| **Total** | **73** | **96** |

This is my own assessment against the brief, not an independent certification. The points that are still missing are listed under "Remaining issues" below.

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
| Medium | The page made requests to Google Fonts on every open, which sent IP and referrer data to Google and broke the look offline. | The fonts are embedded (OFL 1.1, licence included). The page makes zero network requests unless the AI assistant is used. |
| Medium | There was no Content-Security-Policy. | Strict CSP: `connect-src` allows only the listed AI endpoints plus localhost, with `default-src 'none'`, `object-src 'none'`, `base-uri 'none'` and `form-action 'none'`. A test shows it blocks requests to any other host. |
| Medium | Restoring a backup replaced everything with no way back, and reset had no safety net. | Three automatic safety copies (daily, and before each restore, reset or AI/Concierge change), undo after a restore, and a summary of the backup before confirming. |
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

**Optional AI** (bring your own key, no backend):
- **Providers:** Anthropic Claude (default `claude-opus-5-5`; Sonnet 5.5 and Haiku 5.5 selectable), OpenAI, Google Gemini, OpenRouter, and a local model restricted to localhost.
- **Features:** planning advice, vow drafts, vendor emails, open questions.
- **Off by default.** A provider only unlocks after a successful connection test, which sends no plan data.
- **Consent:** a consent dialog appears before the first send, and again whenever the provider or the sharing scope changes. A "see exactly what is sent" preview is always available.
- **What's sent:** guest names, meals, contacts and the diary are never sent. Names are off by default.
- **Key storage:** the key is held only for the tab session unless "remember" is ticked, and it is never in backups or snapshots. Error messages strip anything that looks like a key.
- **Output:** escaped before light formatting. It never changes the plan. Vow text and suggested tasks go through confirm dialogs with snapshot and undo.
- **Errors handled:** 401/403, 404, 429, 5xx/529, refusal, empty or non-JSON body, network/CORS failure, offline, timeout after 150 s, and user cancel.
- **Anthropic call details:** `anthropic-dangerous-direct-browser-access`, adaptive thinking at `effort: medium`, and `fallbacks: "default"` (with the `server-side-fallback-2026-07-01` header) on Opus/Sonnet 5.5.

## Phase 6: testing that was actually run

**Automated suite:** `qa/evermore-v2.test.mjs`, Playwright on Chromium, run against the real HTML file over `file://`. **30/30 passed** on the final build. It covers:
- Boot with no errors and no CSP violations; setup validation.
- Opening a v1.0 plan from localStorage (records kept, legacy € migrated).
- Rescue of corrupt storage, and that the rescued copy survives later saves and downloads byte-for-byte.
- Repair of damaged fields, with the count shown.
- Money exact to the cent; JPY in whole yen.
- Name edits after the wedding date.
- XSS payloads in every field, checked on all tabs and the keepsake.
- Concierge ranking, and the headcount rule at 25 vs 40 days.
- Fixes: confirm, Escape, snapshot, undo, snooze.
- Backup round-trip: dated name, no AI key inside, restore summary, undo restore, junk file rejected.
- A **v2 backup restored into the real v1.0 file.**
- AI: no network requests while it's off; request headers and body on the connection test; consent gating; a privacy leak check on the actual request body; escaping of AI HTML; confirm/cancel for tasks and vows, with undo.
- 7 AI error types, cancel, and offline.
- Rejection of non-local endpoints, and the CSP blocking other hosts.
- Timeline task add, remove and undo; vows in the keepsake; print media.
- No horizontal overflow at 375px on every tab.
- Accessible names on every control.
- Performance with 1,500 guests and 150 vendors: worst tab render about 140 ms, Concierge analysis about 10 ms.

**Live check:** the real Chromium build, opened from `file://`, called the real `api.anthropic.com` with a deliberately invalid key. CORS preflight and the response both went through, and the 401 came back as "Your API key was not accepted". That proves the browser path. A successful generation couldn't be run here because no API key was available.

**Phone build:** served over HTTP, the service worker reached "ready", and after going offline a reload worked, including the Concierge tab, with no console or CSP errors.

**Guides:** the START-HERE and AI-SETUP-GUIDE pages make no network requests, have no horizontal overflow at 375px, and all table-of-contents links resolve.

## Remaining issues

These are all low or medium severity, and none of them block release.

1. **OpenAI, Gemini and OpenRouter weren't tested end to end.** The sandbox's proxy blocked those hosts. The in-app connection test checks them on the buyer's machine, and if it fails the assistant stays off. The default OpenAI model name `gpt-5-mini` is unverified, but the field can be edited.
2. **No successful AI generation was run against a live account,** because there was no key. Request and response shapes are tested against mocks built from the documented API.
3. **Only Chromium was automated.** Firefox and Safari weren't available in this environment. The code uses nothing beyond ES5 plus `fetch` and `AbortController`, and the AI is disabled if those are missing. Please do a quick manual pass in Safari and Firefox before listing.
4. **The CSP still needs `'unsafe-inline'`** for scripts, because the v1 architecture uses inline handlers everywhere. That's mitigated by escaping everything that's rendered (and tested). Moving to `addEventListener` would allow a nonce-based CSP, but it would mean a large rewrite, which the brief ruled out.
5. **A remembered AI key is stored in plain text in localStorage.** That is unavoidable without a backend. The UI says so and recommends a provider spending cap.
6. **Deletes and restores still use the browser's own `confirm()` dialog.** It's reliable and accessible, but plain-looking. The new flows use the styled dialog.
7. **Seller to-dos:**
   - Re-deploy `EVERMORE-MOBILE-WEB-v2.0/` to the existing phone link (the sw cache version is bumped to 2.0.0).
   - Refresh the Etsy listing copy and photos to show the Concierge.
   - Have the LICENSE draft reviewed (it adds an AI section) before publishing.

## Deliverables

- `EVERMORE-WEDDING-PLANNER-v2.0.zip`, the buyer download, containing:
  - `Evermore-Wedding-Planner.html`
  - `START-HERE.html`
  - `AI-SETUP-GUIDE.html`
  - `LICENSE.txt`
  - `FONT-LICENSE.txt`
  - `CHANGELOG.txt`
- `EVERMORE-MOBILE-WEB-v2.0/` and its `.zip`: the hosted phone build, for the seller to deploy.
- `qa/`: the automated test suite.
- The v1.0 folders and zips are left unchanged for reference.
