// Proxy mínimo para serviços OGC públicos dos órgãos (INCRA, SFB/CAR, IBGE, INDE, FUNAI, SPU).
// Motivo: os servidores não enviam cabeçalhos CORS, então o navegador não consegue ler GetFeatureInfo
// (clique no mapa) nem GetFeature (sobreposição com parcelas certificadas). O proxy roda no Vercel,
// só aceita GET, só os hosts e os tipos de requisição listados, e devolve a resposta com CORS liberado.
// Não há credencial envolvida: os serviços são públicos; o proxy não é um "open proxy".
const ALLOW_HOSTS = new Set([
  'acervofundiario.incra.gov.br',
  'geoserver.car.gov.br',
  'geoservicos.ibge.gov.br',
  'geoservicos.inde.gov.br',
  'geoserver.funai.gov.br',
  'sigespa.economia.gov.br',
]);
const ALLOW_REQUESTS = new Set(['getfeatureinfo', 'getfeature', 'getcapabilities', 'getlegendgraphic', 'describefeaturetype']);
const MAX_BYTES = 8 * 1024 * 1024;
const TIMEOUT_MS = 25000;

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'somente GET' });

  let target;
  try { target = new URL(String((req.query && req.query.url) || '')); }
  catch (_) { return res.status(400).json({ error: 'parâmetro url inválido' }); }
  if (target.protocol !== 'https:' || !ALLOW_HOSTS.has(target.hostname)) {
    return res.status(403).json({ error: 'host não permitido', host: target.hostname });
  }
  let reqType = '';
  target.searchParams.forEach((v, k) => { if (k.toLowerCase() === 'request') reqType = String(v).toLowerCase(); });
  // Exceção única: a lista pública de temas do i3Geo do INCRA (HTML), para descobrir nomes de camada.
  const isIncraCatalog = target.hostname === 'acervofundiario.incra.gov.br'
    && (target.pathname === '/i3geo/ogc/index.php' || (target.pathname === '/i3geo/ogc.php' && !target.search));
  if (!ALLOW_REQUESTS.has(reqType) && !isIncraCatalog) return res.status(403).json({ error: 'REQUEST não permitido', request: reqType });

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const up = await fetch(target, {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'Confrontei/1.0 (+https://conversorsigri.vercel.app)', Accept: '*/*' },
    });
    const declared = Number(up.headers.get('content-length') || 0);
    if (declared > MAX_BYTES) return res.status(413).json({ error: 'resposta grande demais' });
    const buf = Buffer.from(await up.arrayBuffer());
    if (buf.length > MAX_BYTES) return res.status(413).json({ error: 'resposta grande demais' });
    res.setHeader('Content-Type', up.headers.get('content-type') || 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, s-maxage=300, max-age=60');
    res.setHeader('X-Confrontei-Upstream', target.hostname);
    return res.status(up.status).send(buf);
  } catch (err) {
    const aborted = err && err.name === 'AbortError';
    const cause = err && err.cause;
    const detail = [err && err.message, cause && (cause.code || cause.message)].filter(Boolean).join(' · ');
    return res.status(aborted ? 504 : 502).json({ error: aborted ? 'servidor do órgão demorou demais' : 'servidor do órgão não respondeu', detail, host: target.hostname });
  } finally {
    clearTimeout(timer);
  }
};
