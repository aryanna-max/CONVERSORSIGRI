# Logos — Confrontei e AG Lab

Todos os SVG têm o texto **convertido em curvas** (Poppins 500/800), então
renderizam iguais em qualquer lugar, sem depender de fonte instalada.
Os PNG são exportações transparentes dos SVG (1200 px de largura nos
horizontais, 512 px nos símbolos).

| Arquivo | Uso |
|---|---|
| `confrontei-horizontal[-escuro]` | Logo principal do Confrontei, com "por AG Topografia" |
| `confrontei-wordmark[-escuro]` | Confrontei sem a frase de baixo — para tamanhos pequenos (cabeçalho do site; o PNG claro vai no rodapé do PDF do memorial) |
| `confrontei-simbolo[-escuro]` | Só o polígono (avatar, favicon grande) |
| `confrontei-favicon` | **Ícone oficial** (favicon, aba, área de trabalho). Ver abaixo |
| `confrontei-icone` | Mesmo pentágono com fundo navy: **só** onde o fundo é obrigatório (atalho no celular) |
| `aglab-horizontal[-escuro]` | Logo do AG Lab, com "por AG Topografia" |
| `aglab-wordmark[-escuro]` | AG Lab sem a frase de baixo — para tamanhos pequenos (cabeçalho do site) |
| `aglab-simbolo` | Símbolo da AG vetorizado a partir de `assets/ag-symbol.png` |
| `confrontei-aglab[-escuro]` | Assinatura combinada: Confrontei · uma ferramenta AG Lab |
| `previa.png` | Folha de conferência (fundo claro × escuro, tamanho pequeno) |

## Ícone oficial — não alterar

O ícone oficial do Confrontei é o **pentágono solto, sem fundo**: traço
`#195d83` de 6 e cinco vértices verdes `#90b728` de raio 7, numa caixa de
90 × 90 (`confrontei-favicon.svg`). É o desenho que já era o favicon do
site, e a usuária decidiu (07/10/2026) que ele fica como está.

- Aba do navegador, área de trabalho e Google: `confrontei-favicon.svg`,
  `favicon.ico` (16/32/48, na raiz) e `confrontei-favicon-192/512.png`.
- Celular (iOS e Android pedem fundo opaco): `apple-touch-icon.png` (raiz) e
  `confrontei-icone-maskable-192/512.png`, que são o `confrontei-icone` sobre
  navy cheio. Só aqui o pentágono ganha fundo.
- `confrontei-simbolo` (traço 4, preenchimento teal) é a versão do logotipo,
  não o ícone.

`-escuro` = versão para fundo escuro (navy `#0a1f3d`).

Cores: navy `#0a1f3d`, azul `#195d83` / `#4a8fb8` (escuro), teal `#009083`,
verde `#90b728` / `#a8d640` (escuro). Símbolo AG: verde `#8abc42`,
teal `#179587`, azul `#1b6285`.

Tamanho mínimo recomendado dos horizontais: 28 px de altura (abaixo disso
o "por AG Topografia" fica ilegível — use só o símbolo).
