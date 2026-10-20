// Evermore v2.0 QA suite — runs the real HTML file in Chromium via Playwright.
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
const require = createRequire('/opt/node-tools/');
const { chromium } = require('/opt/node-tools/node_modules/playwright');

const FILE = path.resolve(process.argv[2]);
const V1 = process.argv[3] ? path.resolve(process.argv[3]) : null;
const PAGE_URL = 'file://' + FILE;
const OUT = path.dirname(new globalThis.URL(import.meta.url).pathname);
const results = [];
let browser;

function iso(offsetDays) {
  const d = new Date(); d.setHours(12); d.setDate(d.getDate() + offsetDays);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function basePlan(over = {}) {
  const plan = {
    setupDone: true,
    profile: { partnerA: 'Alex', partnerB: 'Sam', date: iso(40), vibe: 'garden party', story: 'We met at a bookshop.', currency: 'USD' },
    budget: [
      { name: 'Venue', planned: 10000, spent: 4000 },
      { name: 'Catering & Bar', planned: 8000, spent: 0 },
      { name: 'Photography', planned: 3000, spent: 3500 },
      { name: 'Buffer / Misc', planned: 0, spent: 0 }
    ],
    guests: [
      { name: 'Jordan Lee', status: 'Pending', meal: '', plusOne: false, plusOneName: '' },
      { name: 'Priya Nair', status: 'Yes', meal: '', plusOne: true, plusOneName: '' },
      { name: 'Chris Wong', status: 'No', meal: '', plusOne: false, plusOneName: '' },
      { name: 'Taylor Kim', status: 'Yes', meal: 'Fish', plusOne: false, plusOneName: '' }
    ],
    vendors: [
      { name: 'Rosewood Estate', category: 'Venue', contact: 'events@rosewood.example', status: 'Contracted',
        deposit: iso(-30), final: iso(-3), cost: 10000, depositAmount: 2000, paidAmount: 4000 },
      { name: 'Lens & Light', category: 'Photography', contact: '555-0100', status: 'Quoted',
        deposit: iso(-5), final: '', cost: 3500, depositAmount: 500, paidAmount: 0 }
    ],
    timeline: [
      { phase: '1 Month Out', tasks: [{ text: 'Give the caterer your final headcount', done: false, key: false },
        { text: 'Confirm timings with every vendor', done: false, key: true }] },
      { phase: 'Week Of', tasks: [{ text: 'Hold the rehearsal', done: false, key: false }] }
    ],
    diary: [{ date: iso(-10), text: 'SECRET DIARY TEXT', mood: 'Joyful', shared: true }],
    vows: { tone: 'Heartfelt', opening: 'You are my home.', memory: '', promises: '', closing: '' }
  };
  return Object.assign(plan, over);
}

async function fresh(opts = {}) {
  const ctx = await browser.newContext({ viewport: opts.viewport || { width: 1280, height: 900 }, acceptDownloads: true });
  const page = await ctx.newPage();
  page.errors = [];
  page.csp = [];
  page.dialogs = [];
  page.on('pageerror', e => page.errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') page.errors.push('console: ' + m.text()); });
  page.on('dialog', async d => { page.dialogs.push(d.message()); if (opts.dismiss) await d.dismiss(); else await d.accept(); });
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', e => { (window.__csp = window.__csp || []).push(e.violatedDirective + ' ' + e.blockedURI); });
  });
  if (opts.storage) {
    await page.addInitScript(s => { if (!sessionStorage.getItem('__seeded')) { sessionStorage.setItem('__seeded', '1'); for (const k in s) localStorage.setItem(k, s[k]); } }, opts.storage);
  }
  await page.goto(opts.url || PAGE_URL);
  return { ctx, page };
}

async function test(name, fn) {
  const t0 = Date.now();
  try { await fn(); results.push({ name, ok: true, ms: Date.now() - t0 }); console.log('PASS', name); }
  catch (e) { results.push({ name, ok: false, err: String(e && e.stack || e).slice(0, 900) }); console.log('FAIL', name, '\n   ', String(e && e.message || e).slice(0, 600)); }
}
function assert(c, msg) { if (!c) throw new Error('Assertion failed: ' + msg); }
async function noErrors(page) {
  const csp = await page.evaluate(() => window.__csp || []);
  assert(!page.errors.length, 'page errors: ' + page.errors.join(' | '));
  assert(!csp.length, 'CSP violations: ' + csp.join(' | '));
}
const planStore = p => ({ evermore_planner_v1: JSON.stringify(p) });

browser = await chromium.launch();

await test('Boots to setup with no errors and no CSP violations', async () => {
  const { ctx, page } = await fresh();
  await page.waitForSelector('#su-a');
  assert(await page.title() === 'Evermore — Wedding Planner', 'title');
  await noErrors(page);
  await ctx.close();
});

await test('Setup validates names, date and rejects a past date', async () => {
  const { ctx, page } = await fresh();
  await page.click('text=Start planning');
  assert((await page.textContent('.notice')).includes('names'), 'missing-all message');
  await page.fill('#su-a', 'Alex'); await page.fill('#su-b', 'Sam'); await page.fill('#su-date', iso(-2));
  await page.click('text=Start planning');
  assert((await page.textContent('.notice')).includes('already passed'), 'past date message');
  await page.fill('#su-date', iso(200));
  await page.click('text=Start planning');
  await page.waitForSelector('#home-concierge');
  assert((await page.textContent('.brand')).includes('Alex & Sam'), 'brand');
  await noErrors(page);
  await ctx.close();
});

await test('Opens an existing v1.0 plan from localStorage unchanged', async () => {
  const v1 = basePlan(); delete v1.concierge; v1.vows = { tone: 'Funny', opening: 'a', memory: 'b', promises: 'c', closing: 'd' };
  v1.profile.currency = '€'; // legacy symbol form
  const { ctx, page } = await fresh({ storage: planStore(v1) });
  await page.waitForSelector('#home-concierge');
  const saved = await page.evaluate(() => { APP.go('guests'); return JSON.parse(localStorage.getItem('evermore_planner_v1')); });
  const stored = await page.evaluate(() => localStorage.getItem('evermore_planner_v1'));
  // Not written until a change, then the guests must still all be there.
  await page.click('text=Budget');
  await page.locator('input[aria-label^="Planned amount for Venue"]').fill('10001');
  await page.locator('input[aria-label^="Planned amount for Venue"]').press('Tab');
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem('evermore_planner_v1')));
  assert(after.guests.length === 4 && after.vendors.length === 2 && after.diary.length === 1, 'records kept');
  assert(after.vows.tone === 'Funny' && after.vows.promises === 'c', 'vows kept');
  assert(after.profile.currency === 'EUR', 'legacy currency migrated to code');
  assert(after.budget[0].planned === 10001, 'edit saved');
  await noErrors(page);
  await ctx.close();
});

await test('Unreadable saved data is rescued before anything can overwrite it', async () => {
  const bad = '{"profile": broken json';
  const { ctx, page } = await fresh({ storage: { evermore_planner_v1: bad } });
  await page.waitForSelector('#su-a');
  assert((await page.textContent('#warnings')).includes('could not be read'), 'warning shown');
  assert(await page.evaluate(() => localStorage.getItem('evermore_planner_rescue_v2')) === bad, 'rescued copy');
  await page.fill('#su-a', 'A'); await page.fill('#su-b', 'B'); await page.fill('#su-date', iso(100));
  await page.click('text=Start planning');
  assert(await page.evaluate(() => localStorage.getItem('evermore_planner_rescue_v2')) === bad, 'rescue survives new save');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('text=Download unreadable copy')]);
  const txt = fs.readFileSync(await dl.path(), 'utf8');
  assert(txt === bad, 'download is the original bytes');
  await ctx.close();
});

await test('Slightly damaged plan is repaired, not discarded', async () => {
  const p = basePlan();
  p.vendors[0].deposit = '2026-02-31'; p.vendors[1].status = 'Booked!!'; p.budget[1].planned = 'lots'; p.guests.push(42);
  const { ctx, page } = await fresh({ storage: planStore(p) });
  await page.waitForSelector('#home-concierge');
  const w = await page.textContent('#warnings');
  assert(/4 damaged fields/.test(w), 'repair count banner: ' + w);
  const d = await page.evaluate(() => EvermoreConcierge.analyze());
  assert(d.recs.length > 0, 'concierge runs');
  await ctx.close();
});

await test('Money is exact to the cent; JPY shows no cents', async () => {
  const p = basePlan({ budget: [{ name: 'Venue', planned: 1000.5, spent: 0.25 }, { name: 'Cake', planned: 0.1, spent: 0.2 }],
    vendors: [{ name: 'V', category: 'Venue', contact: '', status: 'Contracted', deposit: '', final: '', cost: 100.10, depositAmount: 0, paidAmount: 100.05 }] });
  const { ctx, page } = await fresh({ storage: planStore(p) });
  await page.click('.tab:has-text("Budget")');
  const planned = await page.textContent('#budget-planned');
  const remaining = await page.textContent('#budget-remaining');
  assert(planned.trim() === '$1,000.60', 'planned ' + planned);
  assert(remaining.trim() === '$1,000.15', 'remaining ' + remaining);
  await page.click('.tab:has-text("Vendors")');
  assert((await page.textContent('#vendor-balance')).trim() === '$0.05', 'still owed 5 cents');
  assert(!(await page.textContent('.card')).includes('paid in full'), 'not falsely paid in full');
  await page.click('.tab:has-text("Settings")');
  await page.selectOption('#set-currency', 'JPY');
  await page.click('.tab:has-text("Budget")');
  assert((await page.textContent('#budget-planned')).trim() === '¥1,001', 'JPY whole units');
  await noErrors(page);
  await ctx.close();
});

await test('After the wedding date, names can still be edited (v1 lockout fixed)', async () => {
  const { ctx, page } = await fresh({ storage: planStore(basePlan({ profile: { partnerA: 'Alex', partnerB: 'Sam', date: iso(-20), vibe: '', story: '', currency: 'USD' } })) });
  await page.click('.tab:has-text("Settings")');
  await page.fill('#set-a', 'Alexandra');
  assert(!(await page.isVisible('#settings-error')), 'no error');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('evermore_planner_v1')).profile.partnerA);
  assert(saved === 'Alexandra', 'name saved');
  await page.fill('#set-date', iso(-5));
  await page.dispatchEvent('#set-date', 'change');
  assert((await page.textContent('#settings-error')).includes('already passed'), 'new past date still refused');
  await ctx.close();
});

await test('XSS payloads in every field stay inert on every tab', async () => {
  const x = '<img src=x onerror="window.__xss=1"><script>window.__xss=2</script>"\'><svg onload=window.__xss=3>';
  const p = basePlan();
  p.profile.partnerA = x; p.profile.vibe = x; p.profile.story = x; p.profile.currency = '<svg/onload=alert(1)>';
  p.budget[0].name = x; p.guests[0].name = x; p.guests[1].meal = x; p.guests[1].plusOneName = x;
  p.vendors[0].name = x; p.vendors[0].category = x; p.vendors[0].contact = x;
  p.timeline[0].phase = x; p.timeline[0].tasks[0].text = x; p.diary[0].text = x; p.vows.opening = x;
  p.concierge = { snoozed: { [x]: iso(5) } };
  const { ctx, page } = await fresh({ storage: planStore(p) });
  for (const t of ['home', 'concierge', 'budget', 'guests', 'timeline', 'vendors', 'diary', 'vows', 'settings']) {
    await page.evaluate(t => APP.go(t), t);
    await page.waitForTimeout(30);
  }
  await page.evaluate(() => APP.openKeepsake());
  await page.waitForTimeout(100);
  assert(await page.evaluate(() => window.__xss) === undefined, 'no script ran');
  assert(await page.evaluate(() => document.querySelectorAll('#app img, #app svg, #app script').length) === 0, 'no injected elements');
  const cur = await page.evaluate(() => JSON.parse(localStorage.getItem('evermore_planner_v1') || 'null'));
  await ctx.close();
});

await test('Concierge ranks overdue payments first and answers questions offline', async () => {
  const { ctx, page } = await fresh({ storage: planStore(basePlan()) });
  const a = await page.evaluate(() => EvermoreConcierge.analyze());
  assert(a.next.length === 3, 'three next actions');
  assert(a.next[0].area === 'payments', 'payment first: ' + a.next[0].title);
  const ids = a.recs.map(r => r.id);
  for (const id of ['pay-fin:0', 'pay-dep:1', 'rsvp', 'meals', 'budget-over', 'vows', 'backup', 'book:missing', 'book:photo', 'buffer', 'vendor-over:2']) assert(ids.includes(id), 'has ' + id + ' in ' + ids);
  assert(!ids.includes('headcount'), 'no headcount reminder 40 days out');
  assert(!ids.includes('book:venue'), 'venue counts as booked (Contracted)');
  const owe = await page.evaluate(() => EvermoreConcierge.answer('How much do we still owe?'));
  assert(owe.includes('$9,500'), 'owe answer: ' + owe);
  const rsvp = await page.evaluate(() => EvermoreConcierge.answer('who hasnt replied to the rsvp'));
  assert(rsvp.includes('Jordan Lee'), 'rsvp answer');
  await page.click('.tab:has-text("Concierge")');
  await page.click('.chip:has-text("How can we save money?")');
  assert((await page.textContent('#cg-answer')).includes('Catering'), 'savings answer in UI');
  assert((await page.textContent('#cg-savings')).includes('Guest list'), 'per-guest savings');
  await noErrors(page);
  await ctx.close();
  const near = basePlan(); near.profile.date = iso(25);
  const b = await fresh({ storage: planStore(near) });
  const ids2 = (await b.page.evaluate(() => EvermoreConcierge.analyze())).recs.map(r => r.id);
  assert(ids2.includes('headcount'), 'headcount reminder 25 days out');
  await b.ctx.close();
});

await test('Concierge fix needs confirmation, keeps a safety copy, and can be undone', async () => {
  const { ctx, page } = await fresh({ storage: planStore(basePlan()) });
  await page.click('.tab:has-text("Concierge")');
  const btn = page.locator('button:has-text("Record the deposit as paid")').first();
  await btn.click();
  await page.waitForSelector('.modal');
  await page.keyboard.press('Escape');
  assert(!(await page.isVisible('.modal')), 'escape closes');
  let v = await page.evaluate(() => JSON.parse(localStorage.getItem('evermore_planner_v1')).vendors[1]);
  assert(v.paidAmount === 0 && v.status === 'Quoted', 'unchanged after cancel');
  await btn.click();
  await page.click('#modal-ok');
  v = await page.evaluate(() => JSON.parse(localStorage.getItem('evermore_planner_v1')).vendors[1]);
  assert(v.paidAmount === 500 && v.status === 'Deposit Paid', 'applied ' + JSON.stringify(v));
  const snaps = await page.evaluate(() => JSON.parse(localStorage.getItem('evermore_snapshots_v2')));
  assert(snaps.some(s => s.reason === 'Before a Concierge change'), 'snapshot');
  await page.click('.undo-bar button:has-text("Undo")');
  v = await page.evaluate(() => JSON.parse(localStorage.getItem('evermore_planner_v1')).vendors[1]);
  assert(v.paidAmount === 0, 'undone');
  // Snooze hides it for a week
  await page.click('.tab:has-text("Concierge")');
  const first = await page.textContent('#cg-next-0 .t');
  await page.click('#cg-next-0 .btn-link');
  assert((await page.textContent('#cg-next-0 .t')) !== first, 'snoozed item moved away');
  await noErrors(page);
  await ctx.close();
});

await test('Backup round-trip, dated filename and v1 envelope', async () => {
  const { ctx, page } = await fresh({ storage: planStore(basePlan()) });
  await page.click('.tab:has-text("Settings")');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('button:has-text("Save backup file")')]);
  assert(/^evermore-backup-\d{4}-\d{2}-\d{2}\.json$/.test(dl.suggestedFilename()), 'filename ' + dl.suggestedFilename());
  const file = await dl.path();
  const txt = fs.readFileSync(file, 'utf8');
  const parsed = JSON.parse(txt);
  assert(parsed._evermore && parsed._evermore.version === '2.0' && parsed.guests.length === 4, 'v2 meta + plan at top level');
  fs.copyFileSync(file, path.join(OUT, 'backup-v2.json'));
  assert((await page.textContent('#last-backup')).includes('today'), 'last backup shown');
  await ctx.close();

  // Restore into a fresh browser
  const b = await fresh();
  await b.page.fill('#su-a', 'X'); await b.page.fill('#su-b', 'Y'); await b.page.fill('#su-date', iso(300));
  await b.page.click('text=Start planning');
  await b.page.click('.tab:has-text("Settings")');
  await b.page.setInputFiles('.card input[type=file]', path.join(OUT, 'backup-v2.json'));
  await b.page.waitForSelector('.undo-bar');
  const restored = await b.page.evaluate(() => JSON.parse(localStorage.getItem('evermore_planner_v1')));
  assert(restored.profile.partnerA === 'Alex' && restored.guests.length === 4 && restored.diary[0].text === 'SECRET DIARY TEXT', 'restored');
  assert(b.page.dialogs.some(d => d.includes('4 guests, 2 vendors')), 'restore summary shown');
  // Undo restore brings back X & Y
  await b.page.click('.undo-bar button:has-text("Undo")');
  const back = await b.page.evaluate(() => JSON.parse(localStorage.getItem('evermore_planner_v1')).profile.partnerA);
  assert(back === 'X', 'undo restore');
  // A non-backup file changes nothing
  const junk = path.join(OUT, 'junk.json'); fs.writeFileSync(junk, '{"hello":"world"}');
  await b.page.click('.tab:has-text("Settings")');
  await b.page.setInputFiles('.card input[type=file]', junk);
  await b.page.waitForTimeout(200);
  assert(b.page.dialogs.some(d => d.includes("isn't a wedding planner backup")), 'rejected');
  assert(await b.page.evaluate(() => JSON.parse(localStorage.getItem('evermore_planner_v1')).profile.partnerA) === 'X', 'unchanged');
  await noErrors(b.page);
  await b.ctx.close();
});

if (V1) await test('A v2.0 backup still restores into v1.0 (backward compatible)', async () => {
  const { ctx, page } = await fresh({ url: 'file://' + V1 });
  await page.fill('#su-a', 'X'); await page.fill('#su-b', 'Y'); await page.fill('#su-date', iso(300));
  await page.click('text=Start planning');
  await page.click('.tab:has-text("Settings")');
  await page.setInputFiles('input[type=file]', path.join(OUT, 'backup-v2.json'));
  await page.waitForTimeout(300);
  const r = await page.evaluate(() => JSON.parse(localStorage.getItem('evermore_planner_v1')));
  assert(r.profile.partnerA === 'Alex' && r.guests.length === 4, 'v1 accepted v2 backup');
  await ctx.close();
});

/* ---------------- privacy: no network at all ---------------- */

await test('Never touches the network; CSP blocks any connection; old AI keys are wiped', async () => {
  const { ctx, page } = await fresh({ storage: Object.assign(planStore(basePlan()),
    { evermore_ai_v2: JSON.stringify({ enabled: true, remember: true, key: 'sk-ant-OLDKEY123456' }) }) });
  let calls = 0;
  await ctx.route(/^(https?|wss?):/, r => { calls++; r.abort(); });
  for (const t of ['home', 'concierge', 'budget', 'guests', 'timeline', 'vendors', 'diary', 'vows', 'settings']) await page.evaluate(t => APP.go(t), t);
  await page.click('.tab:has-text("Concierge")');
  await page.click('.chip:has-text("What should we do next?")');
  assert(calls === 0, 'network requests: ' + calls);
  assert(await page.evaluate(() => localStorage.getItem('evermore_ai_v2')) === null, 'retired AI settings wiped');
  const blocked = await page.evaluate(() => fetch('https://example.com/x').then(() => 'reached', () => 'blocked'));
  assert(blocked === 'blocked', 'CSP blocks fetch');
  const html = await page.content();
  assert(!/api key|anthropic|openai|gemini/i.test(html.replace(/base64,[^)]+/g, '')), 'no AI wording left on the page');
  await ctx.close();
});

await test('Concierge still works with the computer offline', async () => {
  const { ctx, page } = await fresh({ storage: planStore(basePlan()) });
  await ctx.setOffline(true);
  await page.reload();
  await page.click('.tab:has-text("Concierge")');
  await page.click('.chip:has-text("How much do we still owe?")');
  assert((await page.textContent('#cg-answer')).includes('$9,500'), 'offline answer');
  await ctx.close();
});

/* ---------------- UX, mobile, performance ---------------- */

await test('Timeline tasks can be added and removed (with undo); keepsake includes vows', async () => {
  const { ctx, page } = await fresh({ storage: planStore(basePlan()) });
  await page.click('.tab:has-text("Timeline")');
  await page.fill('#add-task-0', 'Order the welcome sign');
  await page.press('#add-task-0', 'Enter');
  let tl = await page.evaluate(() => JSON.parse(localStorage.getItem('evermore_planner_v1')).timeline[0].tasks.map(t => t.text));
  assert(tl.includes('Order the welcome sign'), 'added');
  await page.click('button[aria-label="Remove task: Order the welcome sign"]');
  tl = await page.evaluate(() => JSON.parse(localStorage.getItem('evermore_planner_v1')).timeline[0].tasks.map(t => t.text));
  assert(!tl.includes('Order the welcome sign'), 'removed');
  await page.click('.undo-bar button:has-text("Undo")');
  tl = await page.evaluate(() => JSON.parse(localStorage.getItem('evermore_planner_v1')).timeline[0].tasks.map(t => t.text));
  assert(tl.includes('Order the welcome sign'), 'undo');
  await page.click('.tab:has-text("Vows")');
  await page.check('text=Include our vows in the keepsake');
  await page.click('.tab:has-text("Diary")');
  await page.click('text=Compile keepsake');
  assert((await page.textContent('.keepsake')).includes('You are my home.'), 'vows in keepsake');
  await page.emulateMedia({ media: 'print' });
  assert(!(await page.isVisible('.no-print')), 'print hides buttons');
  await ctx.close();
});

await test('Mobile 375px: no horizontal scroll on any tab; tabs scroll sideways', async () => {
  const { ctx, page } = await fresh({ viewport: { width: 375, height: 812 }, storage: planStore(basePlan()) });
  const bad = [];
  for (const t of ['home', 'concierge', 'budget', 'guests', 'timeline', 'vendors', 'diary', 'vows', 'settings']) {
    await page.evaluate(t => APP.go(t), t);
    const w = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
    if (w[0] > w[1] + 1) bad.push(t + ':' + w[0]);
    if (t === 'home' || t === 'concierge') await page.screenshot({ path: path.join(OUT, 'mobile-' + t + '.png'), fullPage: true });
  }
  assert(!bad.length, 'overflow on ' + bad.join(', '));
  const nav = await page.evaluate(() => { const n = document.querySelector('.tabs'); return [n.scrollWidth, n.clientWidth, getComputedStyle(n).overflowX]; });
  assert(nav[2] === 'auto', 'tabs scroll');
  await ctx.close();
});

await test('Desktop screenshots render', async () => {
  const { ctx, page } = await fresh({ storage: planStore(basePlan()) });
  await page.screenshot({ path: path.join(OUT, 'desktop-home.png'), fullPage: true });
  await page.click('.tab:has-text("Concierge")');
  await page.screenshot({ path: path.join(OUT, 'desktop-concierge.png'), fullPage: true });
  await page.click('.tab:has-text("Settings")');
  await page.screenshot({ path: path.join(OUT, 'desktop-settings.png'), fullPage: true });
  await noErrors(page);
  await ctx.close();
});

await test('Every form control has an accessible name', async () => {
  const { ctx, page } = await fresh({ storage: planStore(basePlan()) });
  const missing = [];
  for (const t of ['home', 'concierge', 'budget', 'guests', 'timeline', 'vendors', 'diary', 'vows', 'settings']) {
    await page.evaluate(t => APP.go(t), t);
    const m = await page.evaluate(() => Array.from(document.querySelectorAll('#app input:not([type=file]), #app select, #app textarea')).filter(el => {
      if (el.getAttribute('aria-label') || el.getAttribute('aria-labelledby')) return false;
      if (el.id && document.querySelector('label[for="' + el.id + '"]')) return false;
      if (el.closest('label')) return false;
      return true;
    }).map(el => el.outerHTML.slice(0, 90)));
    m.forEach(x => missing.push(t + ': ' + x));
  }
  assert(!missing.length, missing.join('\n'));
  await ctx.close();
});

await test('Performance: 1,500 guests and 150 vendors stay responsive', async () => {
  const p = basePlan();
  p.guests = Array.from({ length: 1500 }, (_, i) => ({ name: 'Guest ' + i, status: ['Pending', 'Yes', 'No'][i % 3], meal: i % 4 ? 'Veg' : '', plusOne: i % 5 === 0, plusOneName: '' }));
  p.vendors = Array.from({ length: 150 }, (_, i) => ({ name: 'Vendor ' + i, category: ['Venue', 'Photography', 'Florist', 'Catering'][i % 4], contact: '', status: 'Quoted',
    deposit: iso(i - 50), final: iso(i), cost: 1000 + i, depositAmount: 100, paidAmount: i % 2 ? 100 : 0 }));
  const { ctx, page } = await fresh({ storage: planStore(p) });
  const ms = await page.evaluate(() => {
    const out = {};
    for (const t of ['home', 'concierge', 'guests', 'vendors']) { const t0 = performance.now(); APP.go(t); out[t] = Math.round(performance.now() - t0); }
    const t1 = performance.now(); for (let i = 0; i < 20; i++) EvermoreConcierge.analyze(); out.analyze = Math.round((performance.now() - t1) / 20);
    return out;
  });
  console.log('    timings ms', JSON.stringify(ms));
  for (const k in ms) assert(ms[k] < 800, k + ' took ' + ms[k] + 'ms');
  await ctx.close();
});

await browser.close();
const failed = results.filter(r => !r.ok);
fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(results, null, 2));
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
