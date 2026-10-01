// Como rodar (uma vez):  cd tests && mkdir -p libs && cd libs && npm init -y >/dev/null && \
//   npm i proj4@2.11.0 jszip@3.10.1 leaflet@1.9.4 jspdf@2.5.1 pdfjs-dist@2.16.105 && cd .. && \
//   ln -sfn $(npm root -g)/playwright node_modules/playwright   # se o playwright for global
// Depois:  node tests/e2e_sigef.mjs
// As libs de CDN são servidas localmente (o proxy deste ambiente bloqueia unpkg/jsdelivr); Chromium em /opt/pw-browsers/chromium.
// E2E: abre conversor.html no Chromium (libs de CDN servidas localmente), injeta polígono,
// gera a planilha SIGEF (ODS) e confere o content.xml.
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const LIBS = path.join(HERE, 'libs/node_modules');
const OUT = path.join(HERE, 'e2e_out');
fs.mkdirSync(OUT, { recursive: true });

const MIME = { '.html':'text/html; charset=utf-8', '.js':'text/javascript', '.css':'text/css', '.png':'image/png', '.svg':'image/svg+xml', '.ods':'application/vnd.oasis.opendocument.spreadsheet', '.xml':'text/xml', '.txt':'text/plain' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if(p === '/') p = '/conversor.html';
  const f = path.join(ROOT, p);
  if(!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()){ res.writeHead(404); return res.end('nf'); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

// CDN -> arquivo local (mesmas versões do conversor.html)
const CDN = {
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css': ['leaflet/dist/leaflet.css', 'text/css'],
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js': ['leaflet/dist/leaflet.js', 'text/javascript'],
  'https://unpkg.com/proj4@2.11.0/dist/proj4.js': ['proj4/dist/proj4.js', 'text/javascript'],
  'https://unpkg.com/@turf/turf@6/turf.min.js': ['@turf/turf/turf.min.js', 'text/javascript'],
  'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js': ['jszip/dist/jszip.min.js', 'text/javascript'],
  'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js': ['jspdf/dist/jspdf.umd.min.js', 'text/javascript'],
  'https://cdn.jsdelivr.net/npm/pdfjs-dist@2.16.105/build/pdf.min.js': ['pdfjs-dist/build/pdf.min.js', 'text/javascript'],
  'https://cdn.jsdelivr.net/npm/pdfjs-dist@2.16.105/build/pdf.worker.min.js': ['pdfjs-dist/build/pdf.worker.min.js', 'text/javascript'],
};

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const ctx = await browser.newContext({ acceptDownloads: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('dialog', async d => { console.log('DIALOG:', d.type(), d.message().slice(0,120)); await d.accept(); });
page.on('console', m => { if(m.type() === 'error') errors.push('console: ' + m.text().slice(0,200)); });
await page.route(u => !u.href.startsWith(base), route => {
  const u = route.request().url();
  const hit = CDN[u];
  if(hit){ const f = path.join(LIBS, hit[0]); return route.fulfill({ status: 200, contentType: hit[1], body: fs.readFileSync(f) }); }
  return route.abort('blockedbyclient');
});
await page.goto(base + '/conversor.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForFunction(() => typeof window.proj4 === 'function' && typeof window.JSZip === 'function' && typeof window.L === 'object', null, { timeout: 30000 });
console.log('LIBS OK (locais)');

const pts = [ ['GLH-M-00001', -8.0476, -34.8770], ['GLH-M-00002', -8.0476, -34.8700], ['GLH-P-00003', -8.0420, -34.8700], ['GLH-M-00004', -8.0420, -34.8770] ];
await page.evaluate((pts) => { state.fromKML = true; state.inputClosed = false; loadFromKMLPoints(pts.map(([n, lat, lng]) => ({ name: n, lat, lng }))); }, pts);
await page.waitForFunction(() => state.vertices.length === 4);
const metrics = await page.evaluate(() => ({ area: document.getElementById('m-area').textContent, k: document.getElementById('m-ha').textContent, perim: document.getElementById('m-perim').textContent }));
console.log('MÉTRICAS:', JSON.stringify(metrics));
const geo = await page.evaluate(() => { const v = state.vertices; const s = sglAreaPerim(v); return { names: v.map(x => x.name), sglHa: +s.ha.toFixed(4), sglPerim: +s.perim.toFixed(2), elipsHa: +(ellipsoidAreaAuthalic(v)/1e4).toFixed(4), utmHa: +(polyArea(v)/1e4).toFixed(4), azGeo01: +azimuthGeodetic(v[0], v[1]).toFixed(4), azUTM01: +azimuthUTM(v[0], v[1]).toFixed(4) }; });
console.log('GEO:', JSON.stringify(geo));
console.log('CHECK names kept:', geo.names[0] === 'GLH-M-00001' && geo.names[2] === 'GLH-P-00003' ? 'OK' : 'FAIL');
console.log('CHECK SGL≈exata 47,7892:', Math.abs(geo.sglHa - 47.7892) < 0.0006 ? 'OK' : 'FAIL');
console.log('CHECK elips≈exata 47,7892:', Math.abs(geo.elipsHa - 47.7892) < 0.0006 ? 'OK' : 'FAIL');
console.log('CHECK azGeo − azUTM ≈ γ (≈ +0,26°):', (geo.azGeo01 - geo.azUTM01).toFixed(4), '°');

await page.click('#exp-ods');
await page.waitForSelector('#sigef-modal.open');
await page.fill('#sg-nome', 'Teste Detentor'); await page.fill('#sg-cpf', '123.456.789-00');
await page.fill('#sg-denominacao', 'Gleba Teste'); await page.fill('#sg-municipio', 'Recife-PE'); await page.fill('#sg-matricula', '24.878');
await page.fill('#sg-def-slon', '0,10'); await page.fill('#sg-def-slat', '0,10'); await page.fill('#sg-def-sh', '0,20'); await page.fill('#sg-def-h', '12,30');
await page.click('#sg-aplicar-def');
await page.fill('[data-sg-conf="0"]', 'Faixa de domínio PE-038');
await page.fill('[data-sg-conf="1"]', 'Rio das Canoas');
await page.selectOption('[data-sg-lim="1"]', 'LN1');
// força um erro de precisão proposital na linha 3 (P em LA com σ 0,80 > 0,50) e confere que o validador acusa
await page.fill('[data-sg-slon="2"]', '0,80');
const validText = (await page.textContent('#sg-valid')).replace(/\s+/g,' ');
console.log('VALIDAÇÃO:', validText.slice(0, 500));
// corrige e revalida
await page.fill('[data-sg-slon="2"]', '0,10');
await page.click('#sg-revalidar');
console.log('VALIDAÇÃO (corrigida):', (await page.textContent('#sg-valid')).replace(/\s+/g,' ').slice(0, 220));

const finalValid = (await page.textContent('#sg-valid')).replace(/\s+/g,' ');
console.log('CHECK 0 erros antes do download:', /0 erro\(s\)/.test(finalValid) || /Nenhuma inconsist/.test(finalValid) ? 'OK' : 'FAIL -> ' + finalValid.slice(0,200));
const [download] = await Promise.all([ page.waitForEvent('download', { timeout: 30000 }), page.click('#sg-baixar') ]);
const odsPath = path.join(OUT, download.suggestedFilename());
await download.saveAs(odsPath);
console.log('ODS:', path.basename(odsPath), fs.statSync(odsPath).size, 'bytes');

const py = `
import zipfile, xml.etree.ElementTree as ET, sys
z = zipfile.ZipFile(sys.argv[1]); names=[i.filename for i in z.infolist()]
print('entries:', len(names), '| first:', names[0], '| mimetype compress_type:', z.getinfo('mimetype').compress_type, '| content:', z.read('mimetype').decode())
root=ET.fromstring(z.read('content.xml'))
T='{urn:oasis:names:tc:opendocument:xmlns:table:1.0}'; X='{urn:oasis:names:tc:opendocument:xmlns:text:1.0}'; O='{urn:oasis:names:tc:opendocument:xmlns:office:1.0}'
def txt(c): return ' '.join(t.text or '' for t in c.iter(X+'p')).strip()
tabs={tb.get(T+'name'):tb for tb in root.iter(T+'table')}
print('abas:', list(tabs))
def rows(tb):
  out=[]
  for r in tb.iter(T+'table-row'):
    rep=int(r.get(T+'number-rows-repeated','1')); cells=[]
    for c in r:
      if c.tag.endswith('table-cell') or c.tag.endswith('covered-table-cell'):
        crep=int(c.get(T+'number-columns-repeated','1')); cells+=[(txt(c), c.get(O+'value-type'), c.get(T+'style-name'))]*min(crep,14)
    while cells and cells[-1][0]=='': cells.pop()
    out.append((rep,cells))
  return out
for i,(rep,c) in enumerate(rows(tabs['identificacao'])[:16]):
  if c: print('ID r%-2d'%(i+1), [x[0] for x in c])
i=0
for rep,c in rows(tabs['perimetro_1']):
  if c and 2<=i+1<=17: print('PER r%-2d'%(i+1), [(x[0], x[1] or '-', x[2]) for x in c[:12]] if i+1>=12 else [x[0] for x in c[:7]])
  i+=rep
  if i>=17: break
`;
fs.writeFileSync(path.join(OUT, 'inspect.py'), py);
console.log(execSync(`python3 ${path.join(OUT,'inspect.py')} "${odsPath}"`, { encoding: 'utf8' }));
console.log('PAGE ERRORS:', errors.length ? '\n' + errors.join('\n') : 'none');
await browser.close(); server.close();
