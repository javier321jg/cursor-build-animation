#!/usr/bin/env node
/* render.js — captura fotogramas deterministas de la animación y (opcional) los une en MP4.
 *
 *   node scripts/render.js animacion.html --out frames --fps 30 [--mp4 salida.mp4] [--stills 0,4,8,12] [--channel chrome]
 *
 * Requiere: playwright (npm i playwright && npx playwright install chromium) y, para MP4, ffmpeg.
 * Con --channel chrome o --channel msedge usa el navegador ya instalado y no hace falta descargar Chromium.
 * Antes de capturar ejecuta la autoprueba de alineación; si falla, termina con código 1.
 * Este script no instala nada ni hace llamadas de red: abre el HTML local en Chromium sin interfaz,
 * guarda PNG en --out y, solo con --mp4, ejecuta ffmpeg con argumentos fijos (spawnSync, sin shell).
 */
const fs = require('fs'), path = require('path'), { pathToFileURL } = require('url'), { spawnSync } = require('child_process');
const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--') && /\.html?$/.test(a));
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
if (!file) { console.error('Uso: node scripts/render.js animacion.html [--out frames] [--fps 30] [--mp4 out.mp4] [--stills 0,4,8] [--channel chrome|msedge]'); process.exit(1); }
const out = opt('out', 'frames'), fps = +opt('fps', 30), mp4 = opt('mp4', null), stills = opt('stills', null), channel = opt('channel', undefined);
const W = +opt('width', 1920), H = +opt('height', 1080);

(async () => {
  const { chromium } = require('playwright');
  const browser = await chromium.launch(channel ? { channel } : {});
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(path.resolve(file)).href + '?hud=0');   // URL file:/// válida también en Windows
  await page.waitForFunction(() => window.__cb && window.__cb.E && window.__cb.E.length > 0 && window.__cb.cur.length > 0);
  await page.evaluate(() => document.fonts && document.fonts.ready);
  await page.waitForTimeout(800);                       // deja que measure() se re-ejecute con las fuentes cargadas
  await page.evaluate(() => window.__cb.pause());
  // Autoprueba: las cajas, manijas y cursores del canvas deben caer sobre los elementos reales (desfase ≤ 2 px).
  const chk = await page.evaluate(() => (window.__cb.selfTest ? window.__cb.selfTest() : null));
  if (chk) {
    console.log(`${chk.ok ? 'OK ' : 'ERROR'} check: desfase máx ${chk.maxOffsetPx} px en ${chk.checked} cajas, ${chk.pieces} piezas`);
    chk.issues.concat(chk.warnings).forEach((m) => console.log('     ' + m));
    if (!chk.ok) process.exitCode = 1;
  }
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
