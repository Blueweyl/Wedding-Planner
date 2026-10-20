# Evermore QA

Automated checks for the v2.0 planner, run in Chromium with Playwright.

```bash
# planner suite (second argument: the v1.0 file, for the backward-compatibility test)
node qa/evermore-v2.test.mjs EVERMORE-WEDDING-PLANNER-v2.0/Evermore-Wedding-Planner.html \
  EVERMORE-WEDDING-PLANNER-v1.0/Evermore-Wedding-Planner.html

# phone build: serve the folder, then run the offline check
(cd EVERMORE-MOBILE-WEB-v2.0 && python3 -m http.server 8765) &
node qa/phone-offline.test.mjs
```

The scripts load Playwright from `/opt/node-tools/node_modules/playwright`; change that path
if yours is installed elsewhere. Screenshots and `results.json` are written next to the script.
