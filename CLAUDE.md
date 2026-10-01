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
