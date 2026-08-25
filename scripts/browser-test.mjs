/* Real-browser smoke test for Termux WebUI (Playwright, arm64-safe).
 * Drives the UI like a user: create session, type in terminal, switch tabs,
 * toggle keyboard. Collects console errors + screenshots.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = process.env.BASE || 'http://127.0.0.1:4150';
const SHOTS = '/tmp/opencode/shots';
fs.mkdirSync(SHOTS, { recursive: true });

const errors = [];
const log = (step, ok, extra = '') => {
  console.log(`${ok ? '✓' : '✗'} ${step}${extra ? ` — ${extra}` : ''}`);
  if (!ok) errors.push(step);
};

const browser = await chromium.launch({
  args: ['--no-sandbox', '--disable-gpu'],
});
const page = await browser.newPage({
  viewport: { width: 420, height: 900 },
  isMobile: true,
  hasTouch: true,
});
page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

try {
  // Clean slate: remove sessions left over from previous runs so tab names
  // and counts are deterministic.
  const leftover = await fetch(`${BASE}/api/sessions`).then((r) => r.json());
  for (const s of leftover) {
    await fetch(`${BASE}/api/sessions/${s.id}`, { method: 'DELETE' });
  }

  // 1. Home loads
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 15000 });
  await page.screenshot({ path: `${SHOTS}/01-home.png` });
  log('home loads', (await page.textContent('header')).includes('Termux WebUI'));

  // 2. Open new-session dialog
  await page.click('header >> text=⊕ 新建');
  await page.waitForSelector('text=新建会话', { timeout: 3000 });
  await page.screenshot({ path: `${SHOTS}/02-dialog.png` });
  log('dialog opens', true);

  // 3. Create shell session in /tmp
  await page.fill('input', '/tmp');
  await page.click('section >> text=终端');
  await page.waitForSelector('.xterm-rows', { timeout: 5000 });
  log('shell session created, xterm rendered', true);
  await page.screenshot({ path: `${SHOTS}/03-term.png` });

  // 3b. USER PATH: type nothing — the shell prompt must appear on its own.
  await page.waitForFunction(
    () => [...document.querySelectorAll('.xterm-rows > div')].some((r) => r.textContent.includes('#')),
    { timeout: 6000 },
  );
  log('prompt appears without any typing (replay/live stream works)', true);
  await page.screenshot({ path: `${SHOTS}/03b-prompt.png` });

  // 3c. Status lamp shows online
  const lampOnline = await page.$('header .bg-emerald-400');
  log('ws status lamp is green (online)', Boolean(lampOnline));

  // 4. Type a command; expect echo in terminal
  await page.focus('.xterm-helper-textarea');
  await page.keyboard.type('echo TERMUX-OK-$((13*2))');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(900);
  const termText1 = await page.evaluate(() =>
    [...document.querySelectorAll('.xterm-rows > div')].map((r) => r.textContent).join('\n'),
  );
  log('typed command echoed', termText1.includes('TERMUX-OK-26'));
  await page.screenshot({ path: `${SHOTS}/04-after-echo.png` });

  // 5. Second session → two canvases
  await page.click('header >> text=⊕ 新建');
  await page.waitForSelector('text=新建会话');
  await page.click('section >> text=终端');
  await page.waitForFunction(() => document.querySelectorAll('.xterm-rows').length === 2, { timeout: 5000 });
  log('second tab created (2 terminals)', true);
  await page.screenshot({ path: `${SHOTS}/05-two-tabs.png` });

  // 6. Switch back to first tab; scrollback intact
  await page.click('#tabs >> text=终端 1');
  await page.waitForTimeout(600);
  const termText2 = await page.evaluate(() =>
    [...document.querySelectorAll('.xterm-rows > div')].map((r) => r.textContent).join('\n'),
  );
  log('tab switch keeps scrollback', termText2.includes('TERMUX-OK-26'));
  await page.screenshot({ path: `${SHOTS}/06-switched.png` });

  // 7. Keyboard collapse + reopen
  await page.click('text=∨ 收起');
  await page.waitForTimeout(400);
  const kbGone = (await page.$('text=∨ 收起')) === null;
  log('keyboard collapses', kbGone);
  if (!kbGone) await page.screenshot({ path: `${SHOTS}/07-keyboard-still-there.png` });
  const reopen = await page.$('header >> text=⌨︎');
  if (reopen) {
    await reopen.click();
    await page.waitForTimeout(300);
    log('keyboard reopens from header', Boolean(await page.$('text=∨ 收起')));
  } else {
    log('header ⌨︎ button missing when keyboard hidden', false);
  }

  // 8. Session persists in list after reload
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  const tabsAfterReload = await page.$$eval('#tabs button', (bs) => bs.length);
  log('sessions survive reload (2 tabs)', tabsAfterReload === 2);
} catch (e) {
  errors.push(`fatal: ${e.message}`);
  try { await page.screenshot({ path: `${SHOTS}/99-fatal.png` }); } catch {}
} finally {
  await browser.close();
}

console.log('\n==== RESULT ====');
if (errors.length) {
  console.log(`FAILED (${errors.length}):`);
  for (const e of errors) console.log(' -', e);
  process.exit(1);
}
console.log('ALL PASS');
