# AGLab · Confrontei

> Toolkit técnico para conversão de coordenadas UTM em geográficas SIRGAS 2000, no formato aceito pelo SIGRI da ONR.

**Status:** Beta v0.1 · uso educacional
**Por:** [Aryanna Gonzaga](https://agtopografia.com.br) — AG Topografia e Construções

---

## O que é

Toolkit web que converte coordenadas UTM (em SIRGAS 2000, SAD69 ou WGS 84) em coordenadas geográficas decimais no datum SIRGAS 2000 (EPSG:4674), no formato exato exigido pelo SIGRI da ONR e pelo Provimento CNJ 195/2025.

Inclui:

- ✅ Conversão UTM → geográficas via proj4
- ✅ Cálculo de área (Gauss) e perímetro em projeção UTM
- ✅ Validação de fechamento do polígono
- ✅ Importação multiformato: planilha colada, DXF (LWPOLYLINE/POLYLINE), KML, KMZ
- ✅ Visualização em mapa (OSM + Esri Satélite)
- ✅ Camadas oficiais sobrepostas: INCRA (SIGEF/SNCI), FUNAI (Terras Indígenas), Áreas Quilombolas, IBGE (Limites Municipais)
- ✅ Exportação: Texto SIGRI, Shapefile ZIP, KML com vértices nomeados, CSV
- ⏳ Memorial descritivo automático em PDF (em desenvolvimento)

---

## Como usar

Abra `index.html` no navegador. É 100% client-side — nenhum dado sai do seu computador.

Versão online: [confrontei.agtopografia.com.br](https://confrontei.agtopografia.com.br) *(em breve)*

---

## Estrutura

```
.
├── index.html              ← Landing
├── conversor.html          ← Ferramenta principal
├── assets/
│   └── ag-symbol.png       ← Símbolo AGLab
├── LICENSE.txt             ← Termos de uso
└── README.md
```

---

## Tecnologia

100% HTML + CSS + JavaScript inline. Sem build. Sem backend. Sem cookies.

Bibliotecas via CDN:

- [Leaflet 1.9.4](https://leafletjs.com) — mapa
- [proj4js 2.11](https://github.com/proj4js/proj4js) — projeção cartográfica
- [JSZip 3.10](https://stuk.github.io/jszip/) — empacotamento de Shapefile e KMZ
- [@turf/turf 6](https://turfjs.org) — geometria GIS auxiliar
- [Google Fonts · Asap](https://fonts.google.com/specimen/Asap)

Shapefile binário (SHP+SHX+DBF+PRJ+CPG) gerado por implementação própria inline, sem dependência externa.

---

## Licença

Uso educacional e profissional pessoal autorizado.
Uso comercial, redistribuição ou serviço SaaS exigem autorização prévia.

Ver `LICENSE.txt` para detalhes completos.

Para solicitar autorização ou tirar dúvidas, use o canal "Enviar feedback" dentro da ferramenta, ou:

    Aryanna Gonzaga
    AG Topografia e Construções
    Recife / PE — Brasil
    https://agtopografia.com.br

---

## Aviso técnico

⚠ **Esta ferramenta não é a plataforma oficial de registro.**
O lançamento e a validação do registro são feitos exclusivamente pelo
[SIGRI da ONR](https://mapa.onr.org.br/sigri/).

A conferência das coordenadas convertidas, dos cálculos de área e
perímetro e da compatibilidade dos arquivos exportados com o SIGRI é
de **responsabilidade exclusiva do profissional responsável técnico**
pelo levantamento.

---

## Referências oficiais

- [SIGRI · ONR](https://mapa.onr.org.br/sigri/)
- [Manual do Profissional Técnico](https://mapa.onr.org.br/sigri/manual/manual-profissionais-tecnicos)
- [Provimento CNJ 195/2025](https://atos.cnj.jus.br/atos/detalhar/6151)
- [Resolução IBGE PR 01/2015](https://www.ibge.gov.br) — datum oficial brasileiro SIRGAS 2000
- [NBR 13133:2021](https://www.abnt.org.br) — Execução de levantamento topográfico

---

*Construído por quem faz.*
