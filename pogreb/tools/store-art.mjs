// Рендер иконки и скриншотов для RuStore из самой игры (assets/index.html с настоящими шрифтами).
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const root = process.cwd();
const page_url = 'file://' + path.join(root, 'app/src/main/assets/index.html');
const out = path.join(root, 'store');
fs.mkdirSync(out, { recursive: true });
const res = d => { const p = path.join(root, 'app/src/main/res', d); fs.mkdirSync(p, { recursive: true }); return p; };

const browser = await chromium.launch();

/* ---------- иконка ---------- */
async function icon(size, file, transparent, scale) {
  const pg = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
  await pg.goto(page_url);
  await pg.waitForTimeout(500);
  await pg.evaluate(({ transparent, scale }) => {
    document.querySelectorAll('.overlay').forEach(o => o.hidden = true);
    const d = document.createElement('div');
    d.id = 'icon';
    d.style.cssText = `position:fixed;inset:0;z-index:99;display:grid;place-items:center;${transparent ? 'background:transparent' :
      'background:radial-gradient(circle at 50% 38%,#ffcf73 0%,#c27a2a 30%,#5a2f17 62%,#1c110b 100%)'}`;
    d.innerHTML = `<svg viewBox="0 0 120 120" style="width:${scale * 100}%;height:${scale * 100}%;overflow:visible">
      ${transparent ? '<circle cx="60" cy="60" r="52" fill="url(#ig)"/><defs><radialGradient id="ig"><stop offset="0" stop-color="#ffcf73" stop-opacity=".55"/><stop offset="1" stop-color="#ffcf73" stop-opacity="0"/></radialGradient></defs>' : ''}
      <ellipse cx="60" cy="112" rx="34" ry="5" fill="rgba(0,0,0,.45)"/>
      <use href="#jar0" x="22" y="4" width="76" height="109"/>
    </svg>`;
    document.body.appendChild(d);
    if (transparent) { document.documentElement.style.background = 'transparent'; document.body.style.background = 'transparent';
      document.getElementById('bg').style.display = 'none'; document.getElementById('dust').style.display = 'none';
      document.querySelector('.app').style.display = 'none'; }
  }, { transparent, scale });
  await pg.waitForTimeout(200);
  await pg.screenshot({ path: file, omitBackground: transparent });
  await pg.close();
}
await icon(512, path.join(out, 'icon-512.png'), false, 0.86);
for (const [d, px] of [['mipmap-mdpi', 48], ['mipmap-hdpi', 72], ['mipmap-xhdpi', 96], ['mipmap-xxhdpi', 144], ['mipmap-xxxhdpi', 192]]) {
  await icon(px, path.join(res(d), 'ic_launcher.png'), false, 0.86);
  await icon(Math.round(px * 2.25), path.join(res(d), 'ic_launcher_fg.png'), true, 0.6);
}

/* ---------- скриншоты 1080x1920 ---------- */
const pg = await browser.newPage({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 3 });
await pg.goto(page_url);
await pg.waitForTimeout(800);
const shot = async n => { await pg.waitForTimeout(450); await pg.screenshot({ path: path.join(out, `screen-${n}.png`) }); };

await shot(1); // главное меню

// уровень 7 в процессе: делаем несколько ходов по решению, одна полка собрана
await pg.evaluate(() => {
  document.getElementById('btnPlay').click();
  st.level = 7; newLevel();
  const p = solve(st.shelves, 200000).path;
  let k = 0;
  while (k < p.length && !st.shelves.some(isDone)) { const [a, b] = p[k++]; st.shelves[b].push(st.shelves[a].pop()); st.moves++; }
  st.sel = null; render();
  say('Вот это полка! Закатано.', 'happy');
});
await shot(2);

// выбранная банка приподнята
await pg.evaluate(() => {
  const i = st.shelves.findIndex(s => s.length && !isDone(s));
  st.sel = i; render(); say('Огурцы к огурцам, варенье к варенью.');
});
await shot(3);

// победа
await pg.evaluate(() => {
  st.sel = null;
  const p = solve(st.shelves, 400000).path || [];
  for (const [a, b] of p) { st.shelves[b].push(st.shelves[a].pop()); st.moves++; }
  st.moves = Math.min(st.moves, 30); st.over = true; render(); showWin();
});
await pg.waitForTimeout(1600);
await shot(4);

// большой уровень с подсказкой
await pg.evaluate(() => {
  hide('win'); st.level = 14; newLevel();
  st.hint = solve(st.shelves, 200000).path[0]; render();
  say('Переставь банку с полки, что светится, на вторую светящуюся.', 'happy');
});
await shot(5);

await browser.close();
console.log('store art done:', fs.readdirSync(out).join(', '));
