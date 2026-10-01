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
  'https://cdn.jsdelivr.net/npm/polygon-clipping@0.15.7/dist/polygon-clipping.umd.min.js': ['polygon-clipping/dist/polygon-clipping.umd.min.js', 'text/javascript'],
};

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const ctx = await browser.newContext({ acceptDownloads: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('dialog', async d => { console.log('DIALOG:', d.type(), d.message().slice(0,120)); await d.accept(); });
page.on('console', m => { if(m.type() === 'error') errors.push('console: ' + m.text().slice(0,200)); });
const WFS_FIXTURE = { type: 'FeatureCollection', features: [
  { type: 'Feature', properties: { codigo_imo: 'PE-TESTE-A', nome_area: 'Parcela A (sobrepõe)', status: 'Certificada' }, geometry: { type: 'Polygon', coordinates: [[[-34.8735,-8.0500],[-34.8600,-8.0500],[-34.8600,-8.0400],[-34.8735,-8.0400],[-34.8735,-8.0500]]] } },
  { type: 'Feature', properties: { codigo_imo: 'PE-TESTE-B', nome_area: 'Parcela B (vizinha)', status: 'Certificada' }, geometry: { type: 'Polygon', coordinates: [[[-34.8840,-8.0476],[-34.8770,-8.0476],[-34.8770,-8.0420],[-34.8840,-8.0420],[-34.8840,-8.0476]]] } }
] };
await page.route(u => !u.href.startsWith(base), route => {
  const u = route.request().url();
  if(u.startsWith('https://api.opentopodata.org/v1/srtm30m')){ const locs = decodeURIComponent(u.split('locations=')[1]).split('|'); return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'OK', results: locs.map((l, i) => { const [lat, lng] = l.split(',').map(Number); return { elevation: 10 + i * 1.5, location: { lat, lng } }; }) }) }); }
  if(u.startsWith('https://geoservicos.incra.gov.br/geoserver/Sigef/wfs')){ console.log('WFS MOCK hit:', u.slice(0,140)); return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(WFS_FIXTURE) }); }
  const hit = CDN[u];
  if(hit){ const f = path.join(LIBS, hit[0]); return route.fulfill({ status: 200, contentType: hit[1], body: fs.readFileSync(f) }); }
  return route.abort('blockedbyclient');
});
await page.goto(base + '/conversor.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForFunction(() => typeof window.proj4 === 'function' && typeof window.JSZip === 'function' && typeof window.polygonClipping === 'object' && typeof window.L === 'object', null, { timeout: 30000 });
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

// ---- Sobreposição SIGEF (WFS simulado) ----
await page.click('#sg-ov-btn');
await page.waitForSelector('#sg-ov-body tr', { timeout: 15000 });
const ov = await page.evaluate(() => Array.from(document.querySelectorAll('#sg-ov-body tr')).map(tr => Array.from(tr.children).map(td => td.textContent.trim())));
console.log('OVERLAP rows:', JSON.stringify(ov));
console.log('OVERLAP status:', await page.textContent('#sg-ov-status'));
const rowA = ov.find(r => r[0] === 'PE-TESTE-A'), rowB = ov.find(r => r[0] === 'PE-TESTE-B');
const pctA = rowA ? parseFloat(rowA[5].replace('.','').replace(',','.')) : NaN;
const haA = rowA ? parseFloat(rowA[4].replace('.','').replace(',','.')) : NaN;
console.log('CHECK A ≈ 50 % (metade leste):', Math.abs(pctA - 50) < 0.3 ? 'OK' : 'FAIL ' + pctA, '| ha', haA, '(esperado ≈ 23,8946)');
console.log('CHECK B = vizinha 0 m²:', rowB && /vizinha/.test(rowB[6]) && parseFloat(rowB[3].replace('.','').replace(',','.')) < 0.5 ? 'OK' : 'FAIL ' + JSON.stringify(rowB));
const nOverlapPolys = await page.evaluate(() => { let n = 0; overlapLayer.eachLayer(l => { if(l.options && l.options.fillColor === '#ff3b3b') n++; }); return n; });
console.log('CHECK mapa: polígonos de sobreposição desenhados =', nOverlapPolys, nOverlapPolys === 1 ? 'OK' : 'FAIL');

// ---- APP / faixa: aresta 1 (V2→V3, lado leste, ≈619,28 m) com 30 m → ≈ 18.578 m² = 1,8578 ha = 3,887 % ----
await page.selectOption('[data-sg-lim="1"]', 'LN1');
await page.click('#sg-fx-sel-ln1');
await page.selectOption('#sg-fx-preset', '30');
await page.click('#sg-fx-calc');
const fxStatus = await page.textContent('#sg-fx-status');
console.log('FAIXA status:', fxStatus);
const fx = await page.evaluate(() => { const r = sgComputeFaixa(); return { area: r.area, pct: r.pct, polys: r.latlngs.length }; });
console.log('FAIXA:', JSON.stringify({ area: +fx.area.toFixed(2), ha: +(fx.area/1e4).toFixed(4), pct: +fx.pct.toFixed(3), polys: fx.polys }));
console.log('CHECK faixa 30 m na aresta leste ≈ 1,8578 ha:', Math.abs(fx.area/1e4 - 1.8578) < 0.01 ? 'OK' : 'FAIL');
console.log('CHECK faixa % ≈ 3,887:', Math.abs(fx.pct - 3.887) < 0.03 ? 'OK' : 'FAIL');
const nFx = await page.evaluate(() => { let n = 0; faixaLayer.eachLayer(() => n++); return n; });
console.log('CHECK faixa desenhada no mapa:', nFx >= 1 ? 'OK' : 'FAIL');
// ---- Cotas SRTM (mock) ----
await page.click('#sg-srtm-btn');
await page.waitForFunction(() => /Cotas SRTM/.test(document.getElementById('sg-srtm-status').textContent), null, { timeout: 10000 });
const srtm = await page.evaluate(() => Array.from(document.querySelectorAll('[data-sg-srtm]')).map(td => td.textContent));
console.log('SRTM células:', JSON.stringify(srtm), '|', await page.textContent('#sg-srtm-status'));
console.log('CHECK SRTM preenchido:', srtm.length === 4 && srtm.every(t => t !== '—') ? 'OK' : 'FAIL');

// ---- PROVA REAL: Granja Alvorada – Lote 75B (certificação SIGEF 0e3b4b7c…, Igarassu/PE) ----
// Valores publicados pelo INCRA no memorial gerado pelo SIGEF (18/08/26).
const dms = s => { const m = s.match(/^(-?)(\d+)°(\d+)'([\d,\.]+)"$/); const v = (+m[2]) + (+m[3])/60 + parseFloat(m[4].replace(',','.'))/3600; return m[1] === '-' ? -v : v; };
const REAL = [
  { name: 'F8F-M-0858', lng: dms(`-34°54'20,689"`), lat: dms(`-7°49'13,173"`), h: 3.3,   az: [154,15], dist: 285.67, conf: 'Lote 76C, de matrícula n.°26769, pertencente ao Sr. Emiragi Henrique Pereira' },
  { name: 'F8F-M-0861', lng: dms(`-34°54'16,638"`), lat: dms(`-7°49'21,549"`), h: -1.56, az: [291,12], dist: 259.97, conf: 'Rio Tabatinga' },
  { name: 'F8F-M-0862', lng: dms(`-34°54'24,549"`), lat: dms(`-7°49'18,487"`), h: -0.22, az: [358,24], dist: 125.16, conf: 'Lote 74, pertencente ao Município de Igarassu, N.° de Ordem: 94-R' },
  { name: 'F8F-M-0859', lng: dms(`-34°54'24,662"`), lat: dms(`-7°49'14,414"`), h: -0.85, az: [72,36],  dist: 127.55, conf: 'Lote 75A, da Granja Alvorada' },
];
const EXP = { areaHa: 3.3022, perim: 798.34 };
await page.evaluate((pts) => { state.fromKML = true; state.inputClosed = false; loadFromKMLPoints(pts.map(p => ({ name: p.name, lat: p.lat, lng: p.lng }))); }, REAL);
await page.waitForFunction(() => state.vertices.length === 4 && state.vertices[0].name === 'F8F-M-0858');
const real = await page.evaluate(() => {
  const v = state.vertices; const s = sglAreaPerim(v); const { xy } = s;
  const edges = v.map((p, i) => { const q = v[(i+1)%v.length]; const [x1,y1] = xy[i], [x2,y2] = xy[(i+1)%v.length]; return { az: azimuthGeodetic(p, q), dist: Math.hypot(x2-x1, y2-y1) }; });
  return { areaHa: s.ha, perim: s.perim, elipsHa: ellipsoidAreaAuthalic(v)/1e4, edges };
});
const fmtAz = d => { const deg = Math.floor(d); const min = (d - deg) * 60; return `${deg}°${min.toFixed(2)}'`; };
console.log(`REAL 75B · área SGL ${real.areaHa.toFixed(4)} ha (INCRA ${EXP.areaHa}) · elips. ${real.elipsHa.toFixed(4)} · perímetro ${real.perim.toFixed(2)} m (INCRA ${EXP.perim})`);
console.log('CHECK área SGL = INCRA ±0,0005 ha:', Math.abs(real.areaHa - EXP.areaHa) <= 0.0005 ? 'OK' : 'FAIL Δ=' + (real.areaHa - EXP.areaHa).toFixed(5));
console.log('CHECK perímetro = INCRA ±0,05 m:', Math.abs(real.perim - EXP.perim) <= 0.05 ? 'OK' : 'FAIL Δ=' + (real.perim - EXP.perim).toFixed(3));

// ---- Memorial rural · formato TABELA (réplica do SIGEF) com os vértices reais ----
await page.click('#close-sigef');
await page.click('#exp-mem');
await page.waitForSelector('#memorial-modal.open');
await page.check('input[name="mem-tipo"][value="rural"]');
await page.selectOption('#mem-rural-fmt', 'tabela');
await page.selectOption('#mem-coord-sign', 'sinal');
await page.fill('#mem-imovel', 'Granja Alvorada - Lote 75B');
await page.fill('#mem-prop', 'ISLAN HONORATO DOS SANTOS JUNIOR / CPF: 101.528.084-69');
await page.fill('#mem-municipio', 'Igarassu'); await page.fill('#mem-uf', 'PE');
await page.fill('#mem-matricula', '3571 (2 de 2)'); await page.fill('#mem-cns', '(13.058-3) Igarassu - PE'); await page.fill('#mem-sncr', '2300900007010');
await page.fill('#mem-rt-nome', 'ARAMIS LEITE DE LIMA'); await page.fill('#mem-rt-reg', '30760-D/PE'); await page.fill('#mem-rt-formacao', 'Engenheiro(a) Cartógrafo(a)'); await page.fill('#mem-rt-cred', 'F8F'); await page.fill('#mem-rt-doc', 'PE20261534001 - PE');
for(let i = 0; i < 4; i++) await page.fill(`[data-edge-conf="${i}"]`, REAL[i].conf);
const memTxt = await page.textContent('#mem-preview');
console.log('MEMORIAL TABELA (trecho):\n' + memTxt.split('\n').slice(0, 28).join('\n'));
// Distâncias NÃO são comparadas por string exata: o INCRA calculou com as coordenadas completas do ODS;
// o memorial publica DMS a 0,001″ (≈3 cm), o que explica ±1 cm. A comparação numérica (±0,05 m) está acima.
const must = ['DESCRIÇÃO DA PARCELA', 'Código de credenciamento: F8F', 'Documento de RT: PE20261534001 - PE', "-34°54'20,689\"", "-7°49'13,173\"", "154°15'", "291°12'", "358°24'", "72°36'", '127,55', 'Área (Sistema Geodésico Local): 3,3026 ha', 'Rio Tabatinga', 'arredondamento das coordenadas publicadas'];
const missing = must.filter(m => !memTxt.includes(m));
console.log('CHECK memorial tabela = strings do INCRA:', missing.length ? 'FAIL faltam ' + JSON.stringify(missing) : 'OK (' + must.length + ' strings)');
await page.selectOption('#mem-coord-sign', 'letra');
const memTxt2 = await page.textContent('#mem-preview');
console.log('CHECK hemisfério por letra:', memTxt2.includes("34°54'20,689\" W") && memTxt2.includes("7°49'13,173\" S") ? 'OK' : 'FAIL');
await page.selectOption('#mem-rural-fmt', 'prosa');
const memTxt3 = await page.textContent('#mem-preview');
console.log('CHECK prosa ainda funciona:', /Inicia-se a descrição deste perímetro no vértice F8F-M-0858/.test(memTxt3) ? 'OK' : 'FAIL');
REAL.forEach((p, i) => {
  const e = real.edges[i]; const azMin = e.az * 60; const expMin = p.az[0]*60 + p.az[1];
  const dAz = azMin - expMin; const dD = e.dist - p.dist;
  // O SIGEF publica D°MM' com minutos TRUNCADOS (verificado: 291°12,74' → 291°12'; 358°24,91' → 358°24').
  const truncMin = Math.floor(e.az * 60) ; const truncOk = truncMin === expMin;
  console.log(`  ${p.name}→${REAL[(i+1)%4].name}: az ${fmtAz(e.az)} → trunc ${Math.floor(e.az)}°${String(truncMin - Math.floor(e.az)*60).padStart(2,'0')}' (INCRA ${p.az[0]}°${String(p.az[1]).padStart(2,'0')}') ${truncOk ? 'OK' : 'FAIL'} (Δ bruto ${dAz.toFixed(2)}′) · dist ${e.dist.toFixed(2)} (INCRA ${p.dist.toFixed(2)}) Δ=${dD.toFixed(3)} m ${Math.abs(dD) <= 0.05 ? 'OK' : 'FAIL'}`);
});
console.log('PAGE ERRORS:', errors.length ? '\n' + errors.join('\n') : 'none');
await browser.close(); server.close();
