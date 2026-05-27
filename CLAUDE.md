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

## Pendências
- **Memorial Descritivo em PDF** — prometido no README (⏳) e na landing; ainda não implementado. Entregável citado pela NBR 13133. Próxima grande entrega.
- **SEO on-page do Confrontei** (meta description na landing, canonical, Open Graph/Twitter, JSON-LD SoftwareApplication, robots.txt, sitemap.xml) — planejado, ainda não implementado. Aguardando definição final do domínio.
- Menores: função `isClosed()` não usada; `name` de vértice via innerHTML; links `href="#"` placeholder na nav da landing.

## Git
- Branch de desenvolvimento: `claude/continue-project-BanKs`. PR #1 já foi mesclado no `main`.
- Push: `git push -u origin <branch>`; criar PR como draft após push.
