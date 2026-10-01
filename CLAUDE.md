# Confrontei — CONVERSORSIGRI

Ferramenta web (single-file HTML) que converte coordenadas UTM em geográficas
(SIRGAS 2000, EPSG:4674) no formato aceito pelo SIGRI/ONR e pelo Provimento
CNJ 195/2025. Produto da **AG Topografia**.

## Arquivos
- `index.html` — landing page
- `conversor.html` — ferramenta principal (fonte)
- `conversor-offline.html` — build single-file com libs de CDN embutidas (artefato derivado; não editar à mão)
- `assets/ag-symbol.png` — símbolo

## Stack / Hospedagem
- HTML/CSS/JS puro no navegador. Libs via CDN: Leaflet, proj4, turf, JSZip.
- **Hospedado no Vercel** (projeto `conversorsigri`, team `aryanna-gonzaga-s-projects`). Deploy automático a partir do branch `main` no GitHub (`aryanna-max/CONVERSORSIGRI`).
- Domínios atuais: `conversorsigri.vercel.app` (+ aliases).

## Decisões técnicas
- **Datum**: só SIRGAS 2000 (inversão exata da projeção sobre GRS80, precisão mm) e WGS 84 (≈ SIRGAS 2000). **SAD69 foi REMOVIDO** — transformação por software cliente (3 parâmetros) tem erro métrico; a rede SAD69 só é corrigida pela grade NTv2 oficial do IBGE (ProGriD/MapGeo). Dados em SAD69 devem ser convertidos antes no ProGriD/MapGeo.
- Deve atender às normas **NBR 13133** e **NBR 17047** (levantamento topográfico) — por isso só SIRGAS 2000.
- **Recife/PE = fuso UTM 25 S** (MC −33°), não 24 S. É o padrão do seletor.

## Marca / Domínio (decidido)
- Confrontei será **produto com marca própria** + ferramentas pagas (freemium/SaaS).
- Domínio escolhido: **`confrontei.com.br`** — registrar no **registro.br** (com CNPJ da AG; Vercel não vende .com.br). `confrontei.*` estava disponível.
- Manter selo **"por AG Topografia"** na página (herda credibilidade/E-E-A-T).
- O site continua no Vercel; o domínio só aponta via DNS (A/CNAME).

## SEO — aproveitar autoridade da AG
- Domínio separado NÃO herda autoridade automaticamente. Transferir via **link forte e permanente do site da AG** (menu/home/rodapé de `agtopografia.com.br`) → `confrontei.com.br`, mesma identidade de negócio, Search Console na mesma conta.
- **Bloqueador crítico de SEO**: a Proteção de Implantação (Vercel Authentication) está LIGADA — anônimo/Googlebot recebe HTTP 403. Precisa ser desligada para Production no painel do Vercel, senão o Google não indexa.

## Site da AG Topografia
- `agtopografia.com.br` = **WordPress no HostGator, antigo**. Ranqueia em **1º lugar** no Google.
- Quer refazer, MAS **não pode perder o ranking**. Regras: manter mesmo domínio; manter MESMAS URLs (ou 301 de toda URL antiga→nova); preservar conteúdo/títulos que ranqueiam; inventariar URLs no Search Console antes; construir em staging com noindex; não mudar tudo de uma vez.

## Escopo — urbano E rural
- **Urbano** (SIG-RI/ONR): fluxo original — UTM → geográfico, memorial NBR 13133/17047, exportação SIGRI.
- **Rural** (decidido em 2026-10-01): ferramenta de apoio em DUAS pontas:
  1. **Registro rural** (SIG-RI/cartório) — mesmo pipeline, com área/perímetro no **SGL** (oficial INCRA) e memorial no modelo SIGEF.
  2. **Certificação SIGEF** (INCRA) — ajudar o profissional credenciado a preparar/validar a submissão.
- Caso de referência: **Gleba A do Engenho Boaçica, mat. 24.878, Ipojuca/PE** — 157 vértices com códigos SIGEF (GLH-V-10491…), 599,6347 ha, 225 km do MC (k ≈ 1,000224). Ver `RELATORIO_CONFERENCIA_MAT-24878` (relatório técnico da Aryanna, 30/09/2026).

## Tipo de imóvel — escolha GLOBAL (decisão da usuária, 2026-10-01)
- **"Urbano / Rural" é a PRIMEIRA escolha**, no painel 01 (`#cfg-tipo`, antes do fuso), **padrão Urbano**, visível e persistida em `confrontei_tipo_imovel`. Nunca esconder modo em memória do modal (bug real: o modal lembrava "Rural · Tabela SIGEF" e abriu um lote urbano no formato do INCRA).
- Urbano: quadro de áreas ORIGINAL (Área m² UTM · Perímetro UTM · Hectares; k/γ só como sublinha se |k−1|>1e-4), memorial NBR com lados, planilha SIGEF desabilitada (tooltip explica). Rural: SGL/UTM/elipsoide + k/γ, memorial Tabela SIGEF/Prosa, planilha SIGEF e sobreposição liberadas. `isRural()` é a fonte única; o rádio do modal espelha o global a cada abertura.
- **Foco é URBANO; rural é um MÓDULO** (usuária, 2026-10-01): na landing o CTA principal é "Abrir conversor →" (`conversor.html?tipo=urbano`) e o rural aparece como caixa secundária "Módulo rural" (`?tipo=rural`) + card "Módulo rural · INCRA/SIGEF". Nunca apresentar como escolha 50/50.
- **Tipo de imóvel NÃO persiste entre visitas** (2026-10-01, após captura da usuária mostrando produção aberta em rural sem escolha): `?tipo=` da landing vence; a troca no painel 01 vale só para a aba/sessão (`sessionStorage`); sem nada, abre SEMPRE em Urbano.
- Legenda WMS: tenta GetLegendGraphic estilizado → forma mínima (SERVICE/VERSION/FORMAT/WIDTH/HEIGHT/LAYER) → link "abrir no servidor". GetFeatureInfo do INCRA/CAR é bloqueado por CORS no navegador (fallback: link em nova aba).
- **INCRA: `geoservicos.incra.gov.br` foi DESATIVADO** (captura da usuária em 01/10/2026: `ERR_NAME_NOT_RESOLVED`; era a causa real da legenda "indisponível" — **não é senha**, os serviços do INCRA são públicos). Fonte atual = **Acervo Fundiário** (`https://acervofundiario.incra.gov.br/i3geo/ogc.php?tema=<tema>`, i3Geo/MapServer, WMS e WFS no mesmo endpoint, camada = tema, **temas publicados POR UF**). Dois nomes documentados por terceiros para a mesma camada (`certificada_sigef_particular_pe` em br_incra/2025 e `imoveiscertificados_privado_pe` em clickgeo): `overlayDefs.<id>.temas` lista os candidatos e `attachOverlay` troca para o próximo no 1º `tileerror`; o WFS de sobreposição (`sgFetchSigefWFS`) tenta os mesmos candidatos. SNCI (`certificada_snci_particular_xx`/`imoveis_snci_privado_xx`/`sncimoveis_xx`) e Quilombolas (`quilombolas_xx`) são chutes documentados, **não verificados** — acervofundiario é bloqueado neste sandbox (egress). CAR = `https://geoserver.car.gov.br/geoserver/sicar/wms`, camada `sicar:sicar_imoveis_<uf>`. UF única para INCRA+CAR no seletor `#layer-uf` (padrão PE); trocar UF recria as camadas ativas. **Testar em produção**: marcar SIGEF privados em PE e ver se vira "ativa"; se ficar "indisponível" nos dois temas, abrir `…/i3geo/ogc.php?tema=certificada_sigef_particular_pe&SERVICE=WMS&REQUEST=GetCapabilities` no navegador e ler o nome real.
- **Preview do PR #7 (captura da usuária, 01/10/2026)**: legendas SIGEF privados/públicos e CAR carregaram → Acervo Fundiário responde e o 1º tema (`certificada_sigef_particular_pe`) existe; **SNCI ficou "legenda não carregou"** (nome do tema ainda desconhecido — pedir à usuária o nome em `acervofundiario.incra.gov.br/i3geo/ogc/index.php`). GetFeatureInfo do INCRA bloqueado por CORS; o do CAR funcionou direto.
- **Proxy OGC no Vercel — `api/ogc.js`** (PR #8): função serverless, só GET, allowlist de hosts (INCRA Acervo, CAR, IBGE, INDE, FUNAI, SPU) e de REQUEST (GetFeatureInfo/GetFeature/GetCapabilities/GetLegendGraphic/DescribeFeatureType), 8 MB, 25 s, CORS `*`. Cliente: `ogcFetchText(url)` tenta direto e cai em `/api/ogc?url=…`; `parseFeatureCollection(text)` aceita GeoJSON **ou GML2/3** (i3Geo/MapServer responde GML; `gmlToFeatures` tira geometria dos atributos, `gmlRingCoords` inverte eixos se vier lat,lon). GetFeatureInfo do INCRA pede `application/vnd.ogc.gml`; WFS de sobreposição tenta `OUTPUTFORMAT=geojson` e depois GML. No E2E o servidor local simula `/api/ogc` com um GML fixo.
- **UX do mapa (pedidos da usuária, 01/10/2026)**: consulta no clique só com o botão **"ⓘ Info"** ligado (padrão desligado — "todo clique abre essa lista"); popup com classe `.gfi` (texto claro sobre fundo escuro — antes ficava ilegível); painel de camadas com `max-height` + `overflow-y:auto` ("não consigo rolar"); rótulo "Pré-visualização" deslocado para não ficar sob o zoom.
- O conversor lê `?tipo=urbano|rural` (escolha explícita vence a preferência salva), mostra selo `#tipo-badge` no cabeçalho (URBANO · SIG-RI / RURAL · SIGEF) e os rótulos do quadro seguem o modo até no estado vazio.
- Regressão urbana no E2E com o memorial real do Lote 174 Gleba A (AG): 12 vértices, fuso 25, 963,90 m² / 141,22 m (AG 963,89 / 141,21), azimute V1→V2 129°29′56″.

## Princípio de produto (inegociável)
- **Quem usa o Confrontei não pode ser induzido a erro.** Todo número exibido tem rótulo sem ambiguidade, metodologia visível (bloco "ⓘ Metodologia") e, quando é valor de conferência, diz isso no próprio card ("não substitui SIGEF / matrícula").
- Geometria própria sobre o GRS80 (proj4js só funciona para UTM; ortho/cea/laea devolvem NaN): **SGL = ENU** (geodésica→ECEF→ENU no centroide); **área elipsoidal = esfera autálica + excesso esférico exato** (contraprova independente da SGL — devem coincidir em 4 casas de ha); **azimute geodésico = Vincenty**. `turf.area` foi ABANDONADO: é esférico (R=6 371 008,8) e deu +0,65 % num teste controlado (48,0987 vs 47,7892 ha exatos).
- Teste E2E real (Playwright/Chromium, libs de CDN servidas localmente porque o proxy bloqueia unpkg/jsdelivr): `tests/e2e_sigef.mjs` (instruções no cabeçalho do arquivo) gera o ODS e inspeciona o content.xml. Rodar antes de mexer em geometria/SIGEF.

## Rural — o que já existe (PR #4, 2026-10-01)
- Área e perímetro em 3 sistemas: SGL (destaque, oficial), UTM, elipsoidal.
- Fator de escala UTM (k) e convergência meridiana (γ) no centroide; ⚠ quando |k−1| > 1e-4.
- Import de memorial PDF aceita códigos SIGEF (GLH-V-xxxxx, BWF-P-Axxx) e o padrão geográfico "NOME, de coordenadas lat; long".
- **Item 1 — Memorial rural modelo SIGEF**: toggle Urbano/Rural no modal; azimute geodésico (turf/Karney), SGL, confrontantes por trecho, DMS com hemisfério por letra.
- **Item 2 — Planilha SIGEF (ODS)**: botão "F · Planilha SIGEF". O gerador **abre o modelo oficial** `assets/sigef_planilha_modelo_1.4_rc5.ods` (cópia do repo GeoINCRA/OpenGeoOne; original em sigef.incra.gov.br/static/, bloqueado neste ambiente — **conferir hash/versão quando possível**) e preenche células via DOM: `identificacao` B2,B5,B6,B7,B10–B16; `perimetro_1` B3/B4/B5, B9="Geográfica", F9="Sul", dados da linha 12 nas colunas Vértice · E/Long · σlong · N/Lat · σlat · h · σh · Método · Tipo Limite · CNS · Matrícula · Descritivo. Coordenadas em GMS "34 55 10,123 W" (segundos 3 casas), sigmas 2 casas. Validador ao vivo com a **matriz oficial** (85 combinações da aba `parametros_vertice_validacao`: LA→0,50; LN→3,00 p/ M,P; PS1–4/PB1 em LN+V→7,50; PA3/PB2→0 = não admitido; exceções PS1–4 em LA1/V) + limites geográficos do Brasil da aba `parametros_vertice`. σ/h/método são dados de campo do usuário — a ferramenta não inventa precisão.
- **Item 3 — Sobreposição com parcelas certificadas**: seção no modal SIGEF. Consulta WFS **1.0.0** no Acervo Fundiário (`ogc.php?tema=<tema da UF>&TYPENAME=<tema>&OUTPUTFORMAT=geojson`, `SRSNAME=EPSG:4674`, bbox lon,lat sem sufixo de CRS — evita a ambiguidade de eixos do 1.1/2.0; antes era `Sigef:Imoveis_Certificados` no GeoServer desativado) por caixa envolvente do imóvel (+165 m). Interseção **exata (Martinez, `polygon-clipping` 0.15.7 UMD, global `polygonClipping`)** em lon/lat; área da interseção medida no plano SGL (ENU) do imóvel. Lista m²/ha/% por parcela; > 0,5 m² = SOBREPOSIÇÃO (vermelho no mapa, `overlapLayer`); 0 m² = vizinha (só confronta — útil para confrontantes). Fallback **"Carregar GeoJSON de parcelas"** quando o INCRA bloquear CORS. **geoservicos.incra.gov.br é bloqueado neste sandbox** (403 CONNECT) → no E2E o WFS é simulado por `page.route` com fixture de geometria conhecida (metade leste = 50 %). CORS real do INCRA ainda **não verificado** — testar no preview.
- `tests/libs/node_modules` e `tests/node_modules/playwright` são symlinks locais (gitignored); instruções de instalação no cabeçalho de `tests/e2e_sigef.mjs`.
- **Prova com parcela certificada real** (Granja Alvorada – Lote 75B, Igarassu/PE, cert. SIGEF `0e3b4b7c-e44e-4344-a152-adb31362708b`, memorial gerado pelo SIGEF em 18/08/26; arquivos da Aryanna, 2026-10-01): SGL **3,3026 ha vs INCRA 3,3022** (Δ 4 m², dentro do arredondamento de 0,001″ das coordenadas publicadas), perímetro 798,38 vs 798,34 m, cada distância dentro de 1,4 cm; azimutes Vincenty batem com os 4 do INCRA **se os minutos forem TRUNCADOS** (291°12,74′ → 291°12′; 358°24,91′ → 358°24′ — com arredondamento dariam 13′/25′). Bloco "PROVA REAL" no E2E.
- **Formato real do memorial gerado pelo SIGEF** (não é prosa): cabeçalho MAPA/INCRA · Denominação · Natureza da Área · Proprietário(a) · CPF · Matrícula do imóvel · Código INCRA/SNCR · Município/UF · Cartório (CNS) · Responsável Técnico(a) · Formação · Código de credenciamento · Conselho Profissional · Documento de RT · Sistema Geodésico de referência: SIRGAS 2000 · Área (Sistema Geodésico Local) · "Coordenadas: Latitude, longitude e altitude geodésicas" · Perímetro (m) · "Azimutes: Azimutes geodésicos" → **DESCRIÇÃO DA PARCELA** em tabela **VÉRTICE (Código, Longitude, Latitude, Altitude (m)) | SEGMENTO VANTE (Código, Azimute, Dist. (m)) | Confrontações**. Formatos: `-34°54'20,689"` (sinal, sem letra, 3 casas), `154°15'` (minutos truncados), `285,67`, altitude 1–2 casas, confrontação em texto livre por segmento. Rodapé: certificação UUID + § 5º art. 176 Lei 6.015/73. **Planta e memorial são gerados pelo SIGEF após a certificação** — o Confrontei alimenta o ODS e confere; não precisa desenhar a planta. Códigos de vértice no padrão do credenciado (`F8F-M-0857`, `F8F-P-5570`).
- Memorial rural agora tem dois formatos: **Tabela (padrão SIGEF, default)** e **Prosa (cartório)**; toggle de hemisfério **sinal (SIGEF) / letra (certidões)**. Campos rurais adicionados ao modal: CNS, SNCR, Formação, Código de credenciamento, Documento de RT.
- **Item 4 — Camadas rurais (2026-10-01)**: (a) **APP e faixas não edificáveis** (local, exato): no modal SIGEF, buffer "estádio" das arestas marcadas no plano SGL (`segmentBufferPolygon`, arcos convexos — um bug de arcos côncavos foi pego pelo E2E: 17 170 vs 18 578 m²), união + interseção exatas (Martinez), área/ha/% dentro do imóvel, desenho em ciano (`faixaLayer`); presets APP Lei 12.651/12 art. 4º I (30/50/100/200/500 m por largura do curso) e não edificável Lei 6.766/79 art. 4º III (15 m); botões "Arestas LN1/LA3" marcam pelo tipo de limite. Rotulado como estimativa. (b) **Cotas SRTM** por vértice via OpenTopoData `srtm30m` (CORS ok no navegador; bloqueado no sandbox → mock no E2E), ortométrica EGM96 ±~10 m, nunca confundir com h elipsoidal. (c) Overlays WMS novos com nome de camada **não verificado deste ambiente** (fallback "indisponível"): `dnit` = `https://geoservicos.inde.gov.br/geoserver/DNIT/ows` camada `DNIT:snv_202507a` (**versionada** por release do SNV — se "indisponível", consultar GetCapabilities e atualizar); `hidro` = IBGE `CCAR:BC250_Trecho_Drenagem_L` (mesmo servidor dos municípios). **Pendente**: hidrografia ANA/BHO (catálogo metadados.snirh.gov.br; GeoServer bloqueado daqui), faixa de domínio como polígono (DNIT publica só o eixo), DER-PE (sem WMS público conhecido), MDE como camada (TOPODATA só download).
- Descrições dos códigos: PG1–9, PT1–5, PA1–2, PB1–2, PS1–4, LA1–7, LN1–6 confirmadas (Manual Técnico de Posicionamento / de Limites e Confrontações, 1ª ed. 2013); **PT6–PT8 e PA3 sem descrição** (código-só, "ver Manual").

## Rural — roadmap (ordem sugerida)
1. **Memorial no modelo SIGEF**: azimute geodésico (não UTM), distâncias/área/perímetro SGL, confrontantes por trecho com nome livre (engenho, rio, faixa de rodovia), declaração explícita do sistema. Toggle Urbano/Rural no modal do memorial.
2. **Planilha de posicionamento SIGEF (ODS)**: gerar e validar — código do vértice, tipo (V/M/P), lat/long/alt, sigmas, método, confrontante. Checar precisão pela Norma Técnica de Georreferenciamento 3ª ed (σ ≤ 0,50 m artificial / 3 m natural / 7,5 m inacessível).
3. **Sobreposição com SIGEF**: consulta WFS da camada de parcelas certificadas e alerta de overlap antes da submissão (motivo nº 1 de rejeição no INCRA).
4. **Camadas rurais extras**: faixa de domínio DNIT/DER-PE, APP de curso d'água, MDE (SRTM/TOPODATA) para cotas.
5. **Modo Conferência**: carregar 2–3 versões do mesmo polígono (certidão × memorial × DWG) e relatar divergências vértice a vértice — automatizar o que o relatório Boaçica fez à mão.

## Pendências
- **Memorial Descritivo em PDF** — prometido no README (⏳) e na landing; ainda não implementado. Entregável citado pela NBR 13133. Próxima grande entrega.
- **SEO on-page do Confrontei** (meta description na landing, canonical, Open Graph/Twitter, JSON-LD SoftwareApplication, robots.txt, sitemap.xml) — planejado, ainda não implementado. Aguardando definição final do domínio.
- Menores: função `isClosed()` não usada; `name` de vértice via innerHTML; links `href="#"` placeholder na nav da landing.

## Git
- Branch de desenvolvimento: `claude/continue-project-BanKs`. PR #1 já foi mesclado no `main`.
- Push: `git push -u origin <branch>`; criar PR como draft após push.
