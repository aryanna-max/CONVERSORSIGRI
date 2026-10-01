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
// Simula a função /api/ogc (proxy do Vercel): devolve um GML2 fixo como o i3Geo/MapServer responderia
const GML_FIXTURE = `<?xml version="1.0" encoding="UTF-8"?>
<wfs:FeatureCollection xmlns:ms="http://mapserver.gis.umn.edu/mapserver" xmlns:wfs="http://www.opengis.net/wfs" xmlns:gml="http://www.opengis.net/gml">
  <gml:featureMember><ms:certificada_sigef_particular_pe gml:id="certificada_sigef_particular_pe.1">
    <gml:boundedBy><gml:Box srsName="EPSG:4674"><gml:coordinates>-34.8770,-8.0476 -34.8735,-8.0420</gml:coordinates></gml:Box></gml:boundedBy>
    <ms:msGeometry><gml:Polygon srsName="EPSG:4674"><gml:outerBoundaryIs><gml:LinearRing><gml:coordinates>-34.8735,-8.0476 -34.8700,-8.0476 -34.8700,-8.0420 -34.8735,-8.0420 -34.8735,-8.0476</gml:coordinates></gml:LinearRing></gml:outerBoundaryIs></gml:Polygon></ms:msGeometry>
    <ms:parcela_co>PE-TESTE-GML</ms:parcela_co><ms:nome_area>Parcela GML (metade leste)</ms:nome_area><ms:situacao_i>Certificada</ms:situacao_i>
  </ms:certificada_sigef_particular_pe></gml:featureMember>
</wfs:FeatureCollection>`;
let proxyHits = [];
const server = http.createServer((req, res) => {
  if(req.url.startsWith('/api/ogc')){ proxyHits.push(decodeURIComponent(req.url.split('url=')[1] || '')); res.writeHead(200, { 'Content-Type': 'text/xml' }); return res.end(GML_FIXTURE); }
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
  if(u.startsWith('https://acervofundiario.incra.gov.br/i3geo/ogc.php') && /SERVICE=WFS/i.test(u)){ console.log('WFS MOCK hit:', u.slice(0,140)); return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(WFS_FIXTURE) }); }
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

// ---- URBANO (padrão): quadro em m²/UTM e memorial real Lote 174 Gleba A (AG, REV01) ----
await page.selectOption('#cfg-tipo', 'urbano');
const urbCard = await page.evaluate(() => ({ areaK: document.getElementById('m-area-k').textContent, area: document.getElementById('m-area').textContent, haK: document.getElementById('m-ha-k').textContent, odsDisabled: document.getElementById('exp-ods').disabled }));
console.log('URBANO card:', JSON.stringify(urbCard));
console.log('CHECK urbano mostra m² (UTM):', /m²/.test(urbCard.area) && urbCard.areaK === 'Área (UTM)' && urbCard.haK === 'Hectares' ? 'OK' : 'FAIL');
console.log('CHECK SIGEF desabilitado no urbano:', urbCard.odsDisabled ? 'OK' : 'FAIL');
const MEM174 = `MEMORIAL DESCRITIVO Imóvel: Área de terreno da antiga casa de n.°174, Gleba A, situada na Rua Marechal Bittencourt, bairro do Poço da Panela, Recife. Município: Recife UF: PE Área: 963,89 m² Perímetro: 141,21 m Inicia-se a descrição deste perímetro no vértice V1, definido pelas coordenadas E: 287.831,350 m e N: 9.111.104,430 m com azimute 129° 29' 56,06'' e distância de 19,28 m até o vértice V2, definido pelas coordenadas E: 287.846,228 m e N: 9.111.092,166 m com azimute 220° 01' 20,81'' e distância de 23,14 m até o vértice V3, definido pelas coordenadas E: 287.831,349 m e N: 9.111.074,448 m com azimute 219° 47' 07,05'' e distância de 18,81 m até o vértice V4, definido pelas coordenadas E: 287.819,311 m e N: 9.111.059,992 m com azimute 123° 36' 10,77'' e distância de 0,55 m até o vértice V5, definido pelas coordenadas E: 287.819,767 m e N: 9.111.059,689 m com azimute 219° 01' 37,81'' e distância de 5,33 m até o vértice V6, definido pelas coordenadas E: 287.816,408 m e N: 9.111.055,545 m com azimute 219° 59' 02,99'' e distância de 4,68 m até o vértice V7, definido pelas coordenadas E: 287.813,399 m e N: 9.111.051,957 m com azimute 322° 12' 33,48'' e distância de 21,94 m até o vértice V8, definido pelas coordenadas E: 287.799,954 m e N: 9.111.069,296 m com azimute 44° 05' 02,85'' e distância de 4,16 m até o vértice V9, definido pelas coordenadas E: 287.802,847 m e N: 9.111.072,283 m com azimute 41° 44' 34,48'' e distância de 4,92 m até o vértice V10, definido pelas coordenadas E: 287.806,120 m e N: 9.111.075,951 m com azimute 328° 45' 38,83'' e distância de 0,21 m até o vértice V11, definido pelas coordenadas E: 287.806,009 m e N: 9.111.076,134 m com azimute 51° 36' 10,97'' e distância de 10,42 m até o vértice V12, definido pelas coordenadas E: 287.814,173 m e N: 9.111.082,604 m com azimute 38° 12' 09,52'' e distância de 27,77 m até o vértice V1, encerrando este perímetro. Todas as coordenadas aqui descritas estão georreferenciadas no Sistema Geodésico Brasileiro, e encontram-se representadas no Sistema UTM, referenciadas ao Meridiano Central 33°00'00" WGr/EGr, tendo como o Datum o SIRGAS 2000.`;
const parsed = await page.evaluate((t) => { const r = parseMemorialText(t); return { utm: r.utmVerts.length, geo: r.geoVerts.length, fuso: r.fuso, names: r.utmVerts.map(v => v.name), first: r.utmVerts[0] }; }, MEM174);
console.log('PARSE 174:', JSON.stringify(parsed));
console.log('CHECK parser urbano 12 vértices V1..V12, fuso 25:', parsed.utm === 12 && parsed.geo === 0 && parsed.fuso === 25 && parsed.names.join(',') === 'V1,V2,V3,V4,V5,V6,V7,V8,V9,V10,V11,V12' && Math.abs(parsed.first.e - 287831.350) < 0.001 ? 'OK' : 'FAIL');
await page.evaluate((t) => { const r = parseMemorialText(t); document.getElementById('cfg-zone').value = String(r.fuso); state.inputClosed = false; state.fromKML = false; loadFromUTM(r.utmVerts); }, MEM174);
await page.waitForFunction(() => state.vertices.length === 12);
const m174 = await page.evaluate(() => ({ area: polyArea(state.vertices), perim: polyPerimeter(state.vertices), card: document.getElementById('m-area').textContent, az12: azimuthUTM(state.vertices[0], state.vertices[1]) }));
console.log('LOTE 174:', JSON.stringify({ area: +m174.area.toFixed(2), perim: +m174.perim.toFixed(2), card: m174.card, az12: +m174.az12.toFixed(4) }));
console.log('CHECK área 963,89 m² e perímetro 141,21 m (AG):', Math.abs(m174.area - 963.89) < 0.02 && Math.abs(m174.perim - 141.21) < 0.02 ? 'OK' : 'FAIL');
console.log('CHECK azimute V1→V2 ≈ 129°29′ (AG 129°29′56″):', Math.abs(m174.az12 - (129 + 29/60 + 56.06/3600)) < 0.01 ? 'OK' : 'FAIL ' + m174.az12);

// ---- "Colar lista" aceita o TEXTO do memorial (bug relatado: memorial colado na entrada de vértices era rejeitado) ----
const pasteImport = async (txt) => { await page.evaluate(() => { state.vertices = []; }); await page.fill('#paste-area', txt); await page.click('#btn-paste-import'); await page.waitForTimeout(300); return page.evaluate(() => ({ n: state.vertices.length, names: state.vertices.map(v => v.name).join(','), area: state.vertices.length >= 3 ? polyArea(state.vertices) : 0, ha: state.vertices.length >= 3 ? sglAreaPerim(state.vertices).ha : 0, status: document.getElementById('input-status').textContent })); };
const pp1 = await pasteImport(MEM174);
console.log('PASTE prosa:', JSON.stringify({ n: pp1.n, area: +pp1.area.toFixed(2), status: pp1.status.slice(0, 80) }));
console.log('CHECK memorial em prosa colado → 12 vértices, 963,89 m²:', pp1.n === 12 && Math.abs(pp1.area - 963.89) < 0.02 ? 'OK' : 'FAIL');
const pp2 = await pasteImport(`V1\t287.831,350\t9.111.104,430\nV2\t287.846,228\t9.111.092,166\nV3\t287.831,349\t9.111.074,448\nV4\t287.819,311\t9.111.059,992`);
console.log('CHECK tabela pt-BR (milhar com ponto, decimal vírgula):', pp2.n === 4 && pp2.names === 'V1,V2,V3,V4' ? 'OK' : 'FAIL ' + JSON.stringify(pp2));
const p2e = await page.evaluate(() => Math.abs(state.vertices[0].e - 287831.350) < 0.001 && Math.abs(state.vertices[0].n - 9111104.430) < 0.001);
console.log('CHECK pt-BR E/N exatos (287.831,350 / 9.111.104,430):', p2e ? 'OK' : 'FAIL');
const pp3 = await pasteImport(`V1, 295234.120, 9106518.430\nV2, 295298.560, 9106540.210\nV3, 295312.880, 9106475.660\nV4, 295248.440, 9106453.890`);
console.log('CHECK tabela "V1, E, N" (vírgula+espaço):', pp3.n === 4 && Math.abs(pp3.area - 5000) < 2000 ? 'OK' : 'FAIL ' + JSON.stringify(pp3));
const SIGEF_TABLE = `DESCRIÇÃO DA PARCELA VÉRTICE SEGMENTO VANTE Confrontações Código Longitude Latitude Altitude (m) Código Azimute Dist. (m)
F8F-M-0858 -34°54'20,689" -7°49'13,173" 3,30 F8F-M-0861 154°15' 285,67 Lote 76C, de matrícula n.°26769, pertencente ao Sr. Emiragi Henrique Pereira
F8F-M-0861 -34°54'16,638" -7°49'21,549" -1,56 F8F-M-0862 291°12' 259,97 Rio Tabatinga
F8F-M-0862 -34°54'24,549" -7°49'18,487" -0,22 F8F-M-0859 358°24' 125,16 Lote 74, pertencente ao Município de Igarassu, N.° de Ordem: 94-R
F8F-M-0859 -34°54'24,662" -7°49'14,414" -0,85 F8F-M-0858 72°36' 127,55 Lote 75A, da Granja Alvorada`;
const pp4 = await pasteImport(SIGEF_TABLE);
console.log('PASTE tabela SIGEF:', JSON.stringify({ n: pp4.n, names: pp4.names, ha: +pp4.ha.toFixed(4), status: pp4.status.slice(0, 90) }));
console.log('CHECK tabela SIGEF em GMS colada → 4 vértices, códigos, 3,3022 ha:', pp4.n === 4 && pp4.names === 'F8F-M-0858,F8F-M-0861,F8F-M-0862,F8F-M-0859' && Math.abs(pp4.ha - 3.3022) <= 0.0005 ? 'OK' : 'FAIL');
const pp5 = await pasteImport(`P1 7°49'13,173" S 34°54'20,689" W\nP2 7°49'21,549" S 34°54'16,638" W\nP3 7°49'18,487" S 34°54'24,549" W\nP4 7°49'14,414" S 34°54'24,662" W`);
console.log('CHECK GMS com letras S/W (lat antes de long):', pp5.n === 4 && Math.abs(pp5.ha - 3.3022) <= 0.0005 ? 'OK' : 'FAIL ' + JSON.stringify(pp5));
// Caso real (PDF Catuama REV00, Goiana/PE, 11/05/2026): texto do pdf.js com espaços dentro de palavras e de números.
// Antes: 6 vértices (V1 e V3 perdidos, V7 com N = 9,152) e perímetro de 15 000 km. Esperado: 8 vértices, 2.219,24 m², 241,20 m.
const MEM_CATUAMA = `Área : 2 . 219,24 m² Perímetro : 241,20 m Inicia - se a descrição deste perímetro no vértice V1 , definido pelas coord enadas E: 298.436,556 m e N: 9.152.924,331 m com azimu te 109° 13' 59,73'' e distâ ncia de 80,56 m até o vértice V2 , definido pelas coordenadas E: 298.512,618 m e N: 9.152.897,794 m com azimute 108° 46' 03,75'' e distância de 12,00 m até o vértice V3 , defi nido pel as coordenadas E: 298.523,980 m e N: 9.152.893,933 m com azimute 199° 26' 37,22'' e distância de 29,45 m até o vértice V4 , definido pelas coordenadas E: 298.514,178 m e N: 9.152.866,166 m com azimute 292° 39' 51,50'' e distância de 12,00 m até o vértice V5 , definido pelas coordenadas E: 298.503,105 m e N: 9.152.870,790 m com azimute 292° 39' 52,65'' e distância de 48,94 m até o vértice V6 , definido pelas coordenadas E: 298.457,945 m e N: 9.152.889,648 m com azimute 16° 15' 27,11'' e distância de 9,43 m até o vértice V7 , definido pelas coordenadas E: 298.460,585 m e N: 9.152. 898,701 m com azimute 285° 31' 18,85'' e distância de 30 ,55 m até o vértice V8 , definido pelas coordenadas E: 298.431,147 m e N: 9.152.906,877 m com azimute 17° 13' 05,61'' e distância de 18,27 m até o vértice V1 , encerrando este perímetro. . Todas as coordenadas aqu i descritas e stão georreferenciadas no Sistema Geodésico Brasileiro, e encontram - se representadas no Sistema UTM, referenciadas ao Meridiano Central 33°00’00”WGr/ EGr , tendo como o Datum o SIRGAS 2000 . Frente : limita - se com a PE - 001 , do vértice V 8 ao V 1 com 18 , 27 m; Fundo : li mita - se com a Praia , do vértice V 3 ao V 4 com 2 9 , 45 m;`;
const cat = await pasteImport(MEM_CATUAMA);
const catM = await page.evaluate(() => ({ perim: polyPerimeter(state.vertices), zone: document.getElementById('cfg-zone').value, cls: document.getElementById('input-status').className }));
console.log('CATUAMA:', JSON.stringify({ n: cat.n, names: cat.names, area: +cat.area.toFixed(2), perim: +catM.perim.toFixed(2), zone: catM.zone, status: cat.status.slice(0, 120) }));
console.log('CHECK Catuama (PDF com espaços espúrios) → 8 vértices V1..V8, 2.219,24 m², 241,20 m, fuso 25:', cat.n === 8 && cat.names === 'V1,V2,V3,V4,V5,V6,V7,V8' && Math.abs(cat.area - 2219.24) < 0.05 && Math.abs(catM.perim - 241.20) < 0.05 && catM.zone === '25' ? 'OK' : 'FAIL');
console.log('CHECK Catuama sem aviso (nenhum vértice descartado/lacuna):', !/⚠/.test(cat.status) && /show ok/.test(catM.cls) ? 'OK' : 'FAIL ' + cat.status);
// Diagnóstico quando a leitura falha: V7 com N absurdo e V3 ausente → descartado + lacuna + aviso
const bad = await pasteImport(`V1, definido pelas coordenadas E: 298.436,556 m e N: 9.152.924,331 m V2, definido pelas coordenadas E: 298.512,618 m e N: 9.152.897,794 m V4, definido pelas coordenadas E: 298.514,178 m e N: 9.152.866,166 m V7, definido pelas coordenadas E: 298.460,585 m e N: 9,152 m V8, definido pelas coordenadas E: 298.431,147 m e N: 9.152.906,877 m`);
console.log('CHECK diagnóstico: descarta V7 (N fora da faixa) e avisa V3, V5, V6 ausentes:', bad.n === 4 && /descartado.*V7/.test(bad.status) && /não encontrei V3, V5, V6/.test(bad.status) ? 'OK' : 'FAIL ' + bad.status);
// volta ao Lote 174 para os checks seguintes
await page.evaluate((t) => { const r = parseMemorialText(t); document.getElementById('cfg-zone').value = String(r.fuso); state.inputClosed = false; state.fromKML = false; loadFromUTM(r.utmVerts); }, MEM174);
await page.waitForFunction(() => state.vertices.length === 12);
// memorial urbano abre em modo urbano (sem memória escondida) e traz Frente/Fundo
await page.click('#exp-mem'); await page.waitForSelector('#memorial-modal.open');
const memMode = await page.evaluate(() => ({ tipo: memorialTipo(), hasSides: !!document.querySelector('[data-edge-side]'), preview: document.getElementById('mem-preview').textContent.slice(0, 400) }));
console.log('MEMORIAL urbano:', memMode.tipo, '| lados?', memMode.hasSides, '|', memMode.preview.replace(/\s+/g,' ').slice(0, 160));
console.log('CHECK memorial segue global (urbano) com lados:', memMode.tipo === 'urbano' && memMode.hasSides && /E: 287\.831,350 m e N: 9\.111\.104,430 m/.test(memMode.preview) ? 'OK' : 'FAIL');
await page.click('#close-memorial');
// restaura a caixa de 4 vértices para o restante da suíte
await page.evaluate((pts) => { state.fromKML = true; state.inputClosed = false; loadFromKMLPoints(pts.map(([n, lat, lng]) => ({ name: n, lat, lng }))); }, pts);
await page.waitForFunction(() => state.vertices.length === 4);

await page.selectOption('#cfg-tipo', 'rural');
await page.waitForFunction(() => !document.getElementById('exp-ods').disabled);
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

// ---- Camadas INCRA/CAR por UF (geoservicos.incra.gov.br desativado → Acervo Fundiário i3Geo) ----
const lyr = await page.evaluate(() => {
  const r = { uf: layerUF(), sigef: overlayEndpoint(overlayDefs.sigef), car: overlayEndpoint(overlayDefs.car), quil: overlayEndpoint(overlayDefs.quilombo) };
  document.getElementById('layer-uf').value = 'BA';
  r.sigefBA = overlayEndpoint(overlayDefs.sigef); overlayDefs.sigef.temaIdx = 1; r.sigefAlt = overlayEndpoint(overlayDefs.sigef); overlayDefs.sigef.temaIdx = 0;
  document.getElementById('layer-uf').value = 'PE';
  r.dead = JSON.stringify(overlayDefs).includes('geoservicos.incra');
  return r;
});
console.log('LAYERS:', JSON.stringify(lyr));
console.log('CHECK SIGEF por UF (PE) no Acervo Fundiário:', lyr.sigef.wmsUrl === 'https://acervofundiario.incra.gov.br/i3geo/ogc.php?tema=certificada_sigef_particular_pe' && lyr.sigef.wmsLayer === 'certificada_sigef_particular_pe' ? 'OK' : 'FAIL');
console.log('CHECK UF → BA e tema alternativo:', lyr.sigefBA.wmsLayer === 'certificada_sigef_particular_ba' && lyr.sigefAlt.wmsLayer === 'imoveiscertificados_privado_ba' ? 'OK' : 'FAIL');
console.log('CHECK CAR por UF e nenhum host morto:', lyr.car.wmsLayer === 'sicar:sicar_imoveis_pe' && !lyr.dead ? 'OK' : 'FAIL');

// ---- GML (i3Geo/MapServer) → GeoJSON; proxy /api/ogc; "ⓘ Info" no clique; popup legível; painel rolável ----
const gmlRes = await page.evaluate((gml) => { const fc = parseFeatureCollection(gml); const f = fc.features[0]; return { n: fc.features.length, props: f.properties, geom: f.geometry.type, ring: f.geometry.coordinates[0].length, first: f.geometry.coordinates[0][0], ha: sgOverlapCheck(fc).out.map(o => +(o.area / 1e4).toFixed(4)) }; }, GML_FIXTURE);
console.log('GML:', JSON.stringify(gmlRes));
console.log('CHECK GML2 → Polygon lon,lat + atributos sem geometria:', gmlRes.n === 1 && gmlRes.geom === 'Polygon' && gmlRes.ring === 5 && gmlRes.first[0] === -34.8735 && gmlRes.first[1] === -8.0476 && gmlRes.props.parcela_co === 'PE-TESTE-GML' && !('msGeometry' in gmlRes.props) && !('boundedBy' in gmlRes.props) ? 'OK' : 'FAIL');
console.log('CHECK sobreposição calculada a partir do GML ≈ 23,8946 ha:', Math.abs(gmlRes.ha[0] - 23.8946) < 0.001 ? 'OK' : 'FAIL ' + gmlRes.ha);
const swapped = await page.evaluate(() => gmlRingCoords(new DOMParser().parseFromString('<r xmlns:gml="http://www.opengis.net/gml"><gml:posList>-8.04 -34.87 -8.05 -34.88</gml:posList></r>', 'text/xml').documentElement));
console.log('CHECK posList em lat,lon é invertido para lon,lat:', swapped[0][0] === -34.87 && swapped[0][1] === -8.04 ? 'OK' : 'FAIL ' + JSON.stringify(swapped));
await page.click('#close-sigef');
// clique SEM "Info" ligado não abre popup
await page.evaluate(() => map.fire('click', { latlng: L.latLng(-8.044, -34.872) }));
await page.waitForTimeout(300);
const noPopup = await page.evaluate(() => !document.querySelector('.leaflet-popup'));
console.log('CHECK clique sem "ⓘ Info" não abre consulta:', noPopup ? 'OK' : 'FAIL');
// liga Info + camada SIGEF (tiles abortados → cai no proxy no clique) e consulta
await page.click('#btn-map-info');
await page.evaluate(() => document.querySelector('input[data-overlay="sigef"]').click());
await page.evaluate(() => map.fire('click', { latlng: L.latLng(-8.044, -34.872) }));
await page.waitForFunction(() => { const p = document.querySelector('.leaflet-popup-content'); return p && /PE-TESTE-GML/.test(p.textContent); }, null, { timeout: 15000 });
const pop = await page.evaluate(() => { const p = document.querySelector('.leaflet-popup-content'); const td = p.querySelector('.gfi td:not(.k)'); const cs = getComputedStyle(td); const wrap = getComputedStyle(p.closest('.leaflet-popup-content-wrapper')); return { text: p.textContent.replace(/\s+/g, ' ').slice(0, 200), color: cs.color, bg: wrap.backgroundColor, via: /via proxy/.test(p.textContent) }; });
console.log('POPUP:', JSON.stringify(pop), '| proxy hits:', proxyHits.length, proxyHits[0] && proxyHits[0].slice(0, 110));
const lum = c => { const m = c.match(/\d+/g).map(Number); return (0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]) / 255; };
console.log('CHECK popup legível (texto claro sobre fundo escuro):', lum(pop.color) > 0.8 && lum(pop.bg) < 0.2 ? 'OK' : 'FAIL ' + pop.color + ' / ' + pop.bg);
console.log('CHECK GetFeatureInfo do INCRA passou pelo proxy com GML:', pop.via && proxyHits.some(u => /acervofundiario\.incra\.gov\.br.*GetFeatureInfo.*vnd\.ogc\.gml/i.test(u)) ? 'OK' : 'FAIL');
await page.click('#btn-map-info'); await page.evaluate(() => document.querySelector('input[data-overlay="sigef"]').click());
const panelScroll = await page.evaluate(() => { const p = document.getElementById('layer-panel'); p.classList.add('open'); const cs = getComputedStyle(p); const r = { overflowY: cs.overflowY, maxH: cs.maxHeight, scrollable: p.scrollHeight > p.clientHeight, h: p.clientHeight, sh: p.scrollHeight }; p.classList.remove('open'); return r; });
console.log('PAINEL camadas:', JSON.stringify(panelScroll));
console.log('CHECK painel de camadas rola:', panelScroll.overflowY === 'auto' && panelScroll.maxH !== 'none' ? 'OK' : 'FAIL');
await page.click('#exp-ods'); await page.waitForSelector('#sigef-modal.open');

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

// ---- Resposta REAL do WFS do Acervo Fundiário (via proxy gru1, 01/10/2026): GML2 com Lote 75B e 75A ----
const WFS_REAL = `<?xml version='1.0' encoding="UTF-8" ?>
<wfs:FeatureCollection xmlns:ms="http://www.omsug.ca/osgis2004" xmlns:wfs="http://www.opengis.net/wfs" xmlns:gml="http://www.opengis.net/gml" xmlns:ogc="http://www.opengis.net/ogc">
  <gml:boundedBy><gml:Box srsName="EPSG:4326"><gml:coordinates>-34.906880,-7.822652 -34.904622,-7.819395</gml:coordinates></gml:Box></gml:boundedBy>
  <gml:featureMember><ms:certificada_sigef_particular_pe>
    <gml:boundedBy><gml:Box srsName="EPSG:4326"><gml:coordinates>-34.906851,-7.822652 -34.904622,-7.820326</gml:coordinates></gml:Box></gml:boundedBy>
    <ms:msGeometry><gml:Polygon srsName="EPSG:4326"><gml:outerBoundaryIs><gml:LinearRing><gml:coordinates>-34.905747,-7.820326 -34.904622,-7.822652 -34.906819,-7.821802 -34.906851,-7.820671 -34.905747,-7.820326 </gml:coordinates></gml:LinearRing></gml:outerBoundaryIs></gml:Polygon></ms:msGeometry>
    <ms:id>129117309</ms:id><ms:parcela_codigo>0e3b4b7c-e44e-4344-a152-adb31362708b</ms:parcela_codigo><ms:rt>F8F</ms:rt><ms:art>PE20261534001-PE</ms:art><ms:situacao_informada>REGISTRADA</ms:situacao_informada><ms:codigo_imovel>2300900007010</ms:codigo_imovel><ms:data_submissao>2026-05-08</ms:data_submissao><ms:data_aprovacao>2026-05-08</ms:data_aprovacao><ms:status>CERTIFICADA</ms:status><ms:nome_area>Granja Alvorada - Lote 75B</ms:nome_area><ms:registro_matricula>3571</ms:registro_matricula><ms:registro_data></ms:registro_data><ms:codigo_municipio>2606804</ms:codigo_municipio>
  </ms:certificada_sigef_particular_pe></gml:featureMember>
  <gml:featureMember><ms:certificada_sigef_particular_pe>
    <ms:msGeometry><gml:Polygon srsName="EPSG:4326"><gml:outerBoundaryIs><gml:LinearRing><gml:coordinates>-34.906197,-7.819395 -34.905747,-7.820326 -34.906851,-7.820671 -34.906880,-7.819633 -34.906874,-7.819631 -34.906831,-7.819619 -34.906715,-7.819588 -34.906512,-7.819536 -34.906197,-7.819395 </gml:coordinates></gml:LinearRing></gml:outerBoundaryIs></gml:Polygon></ms:msGeometry>
    <ms:id>129117308</ms:id><ms:parcela_codigo>49cf3807-eed5-4731-a310-4264021ea24b</ms:parcela_codigo><ms:status>CERTIFICADA</ms:status><ms:nome_area>Granja Alvorada - Lote 75A</ms:nome_area><ms:registro_matricula>3571</ms:registro_matricula>
  </ms:certificada_sigef_particular_pe></gml:featureMember>
</wfs:FeatureCollection>`;
const wfsReal = await page.evaluate((gml) => { const fc = parseFeatureCollection(gml); const res = sgOverlapCheck(fc); sgRenderOverlaps(res); return { n: fc.features.length, rows: res.out.map(o => ({ cod: o.f.properties.parcela_codigo, nome: o.f.properties.nome_area, ha: +(o.area/1e4).toFixed(4), pct: +o.pct.toFixed(2) })), table: Array.from(document.querySelectorAll('#sg-ov-body tr')).map(tr => Array.from(tr.children).map(td => td.textContent.trim())) }; }, WFS_REAL);
console.log('WFS REAL:', JSON.stringify(wfsReal));
const r75b = wfsReal.rows.find(r => r.cod === '0e3b4b7c-e44e-4344-a152-adb31362708b'), r75a = wfsReal.rows.find(r => /75A/.test(r.nome));
// 75A compartilha 127 m de limite com 75B: as coordenadas publicadas (6 casas ≈ 0,1 m) geram uma lasca de ~3 m² com
// largura média de ~2 cm — NÃO é sobreposição, é limite comum. 75B ≈ 100 % = a própria parcela.
console.log('CHECK WFS real: 75B = a própria parcela (≈100 %, ≈3,302 ha); 75A = lasca < 0,001 ha:', r75b && Math.abs(r75b.pct - 100) < 0.5 && Math.abs(r75b.ha - 3.302) < 0.003 && r75a && r75a.ha < 0.001 ? 'OK' : 'FAIL');
const t75a = wfsReal.table.find(r => /75A/.test(r[1])), t75b = wfsReal.table.find(r => r[0] === '0e3b4b7c-e44e-4344-a152-adb31362708b');
console.log('CHECK leitura: 75A = "limite comum" (não SOBREPOSIÇÃO) e 75B = "própria parcela":', t75a && /limite comum/.test(t75a[6]) && !/SOBREPOSIÇÃO/.test(t75a[6]) && t75b && /própria parcela/.test(t75b[6]) ? 'OK' : 'FAIL ' + JSON.stringify([t75a && t75a[6], t75b && t75b[6]]));
console.log('CHECK tabela mostra código SIGEF, nome · matrícula · SNCR e status reais:', t75b && /Granja Alvorada - Lote 75B · mat\. 3571 · SNCR 2300900007010/.test(t75b[1]) && /CERTIFICADA · REGISTRADA/.test(t75b[2]) ? 'OK' : 'FAIL ' + JSON.stringify(wfsReal.table));
// GetFeatureInfo do MapServer (msGMLOutput) — formato que o INCRA devolve no clique
const MSGML = `<?xml version="1.0" encoding="UTF-8"?>
<msGMLOutput xmlns:gml="http://www.opengis.net/gml" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <certificada_sigef_particular_pe_layer>
    <gml:name>certificada_sigef_particular_pe</gml:name>
    <certificada_sigef_particular_pe_feature>
      <gml:boundedBy><gml:Box srsName="EPSG:4326"><gml:coordinates>-34.906851,-7.822652 -34.904622,-7.820326</gml:coordinates></gml:Box></gml:boundedBy>
      <id>129117309</id><parcela_codigo>0e3b4b7c-e44e-4344-a152-adb31362708b</parcela_codigo><status>CERTIFICADA</status><nome_area>Granja Alvorada - Lote 75B</nome_area>
    </certificada_sigef_particular_pe_feature>
  </certificada_sigef_particular_pe_layer>
</msGMLOutput>`;
const msg = await page.evaluate((x) => { const fc = parseFeatureCollection(x); return { n: fc.features.length, props: fc.features[0] && fc.features[0].properties }; }, MSGML);
console.log('CHECK msGMLOutput (GetFeatureInfo MapServer) → 1 feição com atributos:', msg.n === 1 && msg.props.parcela_codigo === '0e3b4b7c-e44e-4344-a152-adb31362708b' && msg.props.nome_area && !('boundedBy' in msg.props) && !('name' in msg.props) ? 'OK' : 'FAIL ' + JSON.stringify(msg));

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
// ---- Escolha vinda da landing: ?tipo=rural abre em rural; sem parâmetro respeita a preferência; badge no cabeçalho ----
const p2 = await ctx.newPage();
await p2.route(u => !u.href.startsWith(base), route => { const u = route.request().url(); const hit = CDN[u]; if(hit){ const f = path.join(LIBS, hit[0]); return route.fulfill({ status: 200, contentType: hit[1], body: fs.readFileSync(f) }); } return route.abort('blockedbyclient'); });
await p2.goto(base + '/conversor.html?tipo=rural', { waitUntil: 'domcontentloaded' });
await p2.waitForFunction(() => typeof window.proj4 === 'function' && document.getElementById('cfg-tipo'));
const tr = await p2.evaluate(() => ({ tipo: document.getElementById('cfg-tipo').value, badge: document.getElementById('tipo-badge').textContent, areaK: document.getElementById('m-area-k').textContent }));
console.log('URL ?tipo=rural →', JSON.stringify(tr));
console.log('CHECK ?tipo=rural abre em rural com selo:', tr.tipo === 'rural' && /RURAL/.test(tr.badge) ? 'OK' : 'FAIL');
await p2.goto(base + '/conversor.html?tipo=urbano', { waitUntil: 'domcontentloaded' });
await p2.waitForFunction(() => typeof window.proj4 === 'function' && document.getElementById('cfg-tipo'));
const tu = await p2.evaluate(() => ({ tipo: document.getElementById('cfg-tipo').value, badge: document.getElementById('tipo-badge').textContent }));
console.log('CHECK ?tipo=urbano abre em urbano com selo:', tu.tipo === 'urbano' && /URBANO/.test(tu.badge) ? 'OK' : 'FAIL');
// sem parâmetro, em aba nova (sessionStorage próprio) → SEMPRE urbano, mesmo após ter aberto ?tipo=rural antes
const p3 = await ctx.newPage();
await p3.route(u => !u.href.startsWith(base), route => { const u = route.request().url(); const hit = CDN[u]; if(hit){ const f = path.join(LIBS, hit[0]); return route.fulfill({ status: 200, contentType: hit[1], body: fs.readFileSync(f) }); } return route.abort('blockedbyclient'); });
await p3.goto(base + '/conversor.html', { waitUntil: 'domcontentloaded' });
await p3.waitForFunction(() => typeof window.proj4 === 'function' && document.getElementById('cfg-tipo'));
const t3 = await p3.evaluate(() => ({ tipo: document.getElementById('cfg-tipo').value, badge: document.getElementById('tipo-badge').textContent }));
console.log('CHECK sem ?tipo= em aba nova abre em urbano:', t3.tipo === 'urbano' && /URBANO/.test(t3.badge) ? 'OK' : 'FAIL ' + JSON.stringify(t3));
await p3.close();
await p2.close();
console.log('PAGE ERRORS:', errors.length ? '\n' + errors.join('\n') : 'none');
await browser.close(); server.close();
