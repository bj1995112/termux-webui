import { chromium } from 'playwright';

const b = await chromium.launch({ args: ['--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 420, height: 900 } });
await p.goto('http://127.0.0.1:4150', { waitUntil: 'networkidle' });
const left = await fetch('http://127.0.0.1:4150/api/sessions').then(r => r.json());
for (const s of left) await fetch('http://127.0.0.1:4150/api/sessions/' + s.id, { method: 'DELETE' });
await p.reload({ waitUntil: 'networkidle' });
await p.click('header >> text=⊕ 新建');
await p.click('section >> text=终端');
await p.waitForSelector('.xterm-rows');
await p.waitForTimeout(400);
await p.focus('.xterm-helper-textarea');
await p.keyboard.type('for i in $(seq 1 300); do echo HISTORY-LINE-$i; done');
await p.keyboard.press('Enter');
await p.waitForTimeout(1500);

const touch = (x, y, id, type) => p.evaluate(([x, y, id, type]) => {
  const t = document.querySelector('.xterm-screen');
  const up = type === 'touchend';
  t.dispatchEvent(new TouchEvent(type, { bubbles: true, cancelable: true,
    touches: up ? [] : [new Touch({ identifier: id, target: t, clientX: x, clientY: y, pageX: x, pageY: y })],
    changedTouches: [new Touch({ identifier: id, target: t, clientX: x, clientY: y, pageX: x, pageY: y })] }));
}, [x, y, id, type]);

// TEST A: slow vertical scroll start (8 tiny moves over 560ms) must not long-press
await touch(200, 500, 1, 'touchstart');
for (let i = 1; i <= 8; i++) { await p.waitForTimeout(70); await touch(200, 500 - i * 6, 1, 'touchmove'); }
const falseSelect = await p.evaluate(() => document.querySelectorAll('.sel-handle').length);
await touch(200, 452, 1, 'touchend');
await p.waitForTimeout(200);
console.log('A. slow-scroll false selection:', falseSelect === 0 ? 'NONE ✓' : `TRIGGERED ✗ (${falseSelect} handles)`);

// TEST B: fast fling keeps coasting after finger lift (swipe DOWN into history — room to coast)
await p.evaluate(() => { const vp = document.querySelector('.xterm-viewport'); vp.scrollTop = vp.scrollHeight; });
await p.waitForTimeout(300);
const s0 = await p.evaluate(() => Math.round(document.querySelector('.xterm-viewport').scrollTop));
await p.evaluate(() => {
  const t = document.querySelector('.xterm-screen');
  const ev = (type, y) => new TouchEvent(type, { bubbles: true, cancelable: true,
    touches: type === 'touchend' ? [] : [new Touch({ identifier: 2, target: t, clientX: 200, clientY: y, pageX: 200, pageY: y })],
    changedTouches: [new Touch({ identifier: 2, target: t, clientX: 200, clientY: y, pageX: 200, pageY: y })] });
  let y = 500;
  const step = () => {
    y += 40;
    if (y >= 700) { t.dispatchEvent(ev('touchend', y)); return; }
    t.dispatchEvent(ev('touchmove', y));
    setTimeout(step, 16);
  };
  step();
});
await p.waitForTimeout(700);
const s1 = await p.evaluate(() => Math.round(document.querySelector('.xterm-viewport').scrollTop));
console.log(`B. fling inertia: lifted at ${s0}, coasted to ${s1} (${s0 - s1}px) ${s0 - s1 > 100 ? '✓' : '✗'}`);

// TEST C: real long-press still works after tuning
await touch(200, 300, 3, 'touchstart');
await p.waitForTimeout(550); // > 400ms, no movement
const handles = await p.evaluate(() => document.querySelectorAll('.sel-handle').length);
await touch(200, 300, 3, 'touchend');
console.log('C. long-press still fires:', handles >= 2 ? 'YES ✓' : 'NO ✗');

// regression
const out = await import('child_process').then(cp => cp.execSync('node scripts/browser-test.mjs 2>&1 | tail -n 1').toString());
console.log(out.trim());
await b.close();
