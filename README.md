# Trattoria 3D · entre pela rua até o cardápio

Site de um restaurante italiano fictício, a **Trattoria Il Tinello** (São Paulo), **desenhado ao vivo no navegador**: nenhum vídeo, nenhum modelo 3D baixado. A rolagem leva a câmera por uma rua de pedra molhada à noite, passa pela porta, atravessa o salão e para diante do cardápio de papel flutuando. Rua, fachada, móveis, luzes e texturas são criados em código com three.js, em metros.

**Stack:** Next.js 16 · React 19 · TypeScript · Tailwind CSS 4 · three.js

## O que tem
- **Câmera que anda por um caminho:** 6 marcações (rua, fachada, porta, salão, cardápio, salão de cima) ligadas por curvas suaves; o mouse desvia levemente o olhar.
- **Luz de verdade:** lâmpadas do varal, arandelas, pendentes de latão e balcão são luzes pontuais quentes; céu noturno e janelas acesas viram o reflexo nas pedras molhadas (mapa de rugosidade com poças).
- **Texturas geradas em canvas:** tijolo, pedra com poças, tábuas de madeira, reboco, toldo listrado, letreiro, quadro-negro e as páginas do cardápio.
- **Cenário em código:** fachada extrudada com os vãos da porta e das vitrines, porta aberta, venezianas, toldo com franja, oliveiras em vasos de terracota, catenárias de lâmpadas, prédios vizinhos, salão com vigas, mesas com toalha, cadeiras, velas tremulando, garrafas e o "Benvenuti" no ar.
- **Cardápio 3D** com curvatura de papel, flutuando, e um botão para **virar a página** (antipasti e primi de um lado, secondi e dolci do outro).
- **Neblina** densa na rua e leve dentro; **bloom** nas lâmpadas, granulação e tom ACES.
- **Leve e estável:** shaders compilados antes de mostrar e qualidade adaptativa; no celular em pé, a câmera recua para o cardápio caber.

## Como rodar
```bash
npm install
npm run dev
```
Abra http://localhost:3000 e role a página.

**Modo foto:** `?p=0` a `?p=5` vai direto para cada marcação; `&virar=1` mostra o verso do cardápio.

## Estrutura
- `src/trattoria/texturas.ts`: texturas em canvas
- `src/trattoria/cena.ts`: rua, fachada, salão, móveis, luzes e cardápio
- `src/trattoria/motor.ts`: caminho da câmera, noite, pós-processamento
- `src/components/Experiencia.tsx`: página, seções e rolagem

Inspirado no exemplo "Rosmarino" do guia "Build 3D Websites That Run Live" (@uijonah, Parallel Studios). Irmão de [Lente 3D](https://github.com/xSuui/lente-3d) e [Relógio 3D](https://github.com/xSuui/relogio-3d).

---
Feito por [Samuel Rogério](https://srcs-portifolio.vercel.app) · [LinkedIn](https://www.linkedin.com/in/samuel-rogerio/)
