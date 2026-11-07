#!/usr/bin/env node
/* render.js — captura fotogramas deterministas de la animación y (opcional) los une en MP4.
 *
 *   node scripts/render.js animacion.html --out frames --fps 30 [--mp4 salida.mp4] [--stills 0,4,8,12]
 *
 * Requiere: playwright (npm i playwright && npx playwright install chromium) y, para MP4, ffmpeg.
 */
const fs = require('fs'), path = require('path'), { spawnSync } = require('child_process');
const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--') && /\.html?$/.test(a));
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
if (!file) { console.error('Uso: node scripts/render.js animacion.html [--out frames] [--fps 30] [--mp4 out.mp4] [--stills 0,4,8]'); process.exit(1); }
const out = opt('out', 'frames'), fps = +opt('fps', 30), mp4 = opt('mp4', null), stills = opt('stills', null);
const W = +opt('width', 1920), H = +opt('height', 1080);

(async () => {
  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await page.goto('file://' + path.resolve(file) + '?hud=0');
  await page.waitForFunction(() => window.__cb && window.__cb.E && window.__cb.E.length > 0 && window.__cb.cur.length > 0);
  await page.evaluate(() => document.fonts && document.fonts.ready);
  await page.waitForTimeout(800);                       // deja que measure() se re-ejecute con las fuentes cargadas
  await page.evaluate(() => window.__cb.pause());
  const END = await page.evaluate(() => window.__cb.END);
  fs.mkdirSync(out, { recursive: true });
  const times = stills ? stills.split(',').map(Number) : Array.from({ length: Math.ceil(END * fps) + 1 }, (_, i) => i / fps);
  for (let i = 0; i < times.length; i++) {
    await page.evaluate((t) => window.__cb.seek(t), Math.min(times[i], END));
    const name = stills ? `still_${String(times[i]).replace('.', '_')}s.png` : `frame_${String(i).padStart(5, '0')}.png`;
    await page.screenshot({ path: path.join(out, name) });
  }
  await browser.close();
  console.log(`OK  ${times.length} fotograma(s) en ${out}/  (duración ${END.toFixed(1)} s)`);
  if (mp4 && !stills) {
    const r = spawnSync('ffmpeg', ['-y', '-framerate', String(fps), '-i', path.join(out, 'frame_%05d.png'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', mp4], { stdio: 'inherit' });
    console.log(r.status === 0 ? `OK  ${mp4}` : 'ffmpeg falló o no está instalado');
  }
})().catch((e) => { console.error(e); process.exit(1); });
