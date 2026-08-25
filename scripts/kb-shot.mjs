/* Screenshot the keyboard pages: core (d-pad cross), and a swipe to page 2
 * to verify full-page snap. */
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = process.env.BASE || 'http://127.0.0.1:4150';
const SHOTS = '/tmp/opencode/shots';
fs.mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 420, height: 900 }, isMobile: true, hasTouch: true });

await page.goto(BASE, { waitUntil: 'networkidle' });
// clean leftover sessions so the first terminal is the visible one
const leftover = await fetch(`${BASE}/api/sessions`).then((r) => r.json());
for (const s of leftover) await fetch(`${BASE}/api/sessions/${s.id}`, { method: 'DELETE' });
await page.reload({ waitUntil: 'networkidle' });
await page.click('header >> text=⊕ 新建');
await page.click('section >> text=终端');
await page.waitForSelector('.xterm-rows', { timeout: 8000 });
await page.waitForTimeout(800);

// core page
await page.screenshot({ path: `${SHOTS}/kb-1-core.png`, clip: { x: 0, y: 560, width: 420, height: 340 } });

// Program-scroll to 1.5 pages: mandatory snap must settle on an exact page.
await page.$eval('.mk-pages', (el) => (el.scrollLeft = el.clientWidth * 1.8));
await page.waitForTimeout(700);
const scroll = await page.$eval('.mk-pages', (el) => el.scrollLeft);
const w = await page.$eval('.mk-pages', (el) => el.clientWidth);
console.log(`after 1.8-page scroll: scrollLeft=${scroll}, pageWidth=${w}, snapped=${scroll % w === 0 ? 'YES' : 'NO'}`);
await page.screenshot({ path: `${SHOTS}/kb-2-edit.png`, clip: { x: 0, y: 560, width: 420, height: 340 } });

await browser.close();
console.log('done');
