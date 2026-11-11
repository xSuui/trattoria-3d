// Texturas geradas em código (canvas): nada de imagem baixada.
import * as THREE from "three";

function tela(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return { c, g: c.getContext("2d")! };
}

function textura(c: HTMLCanvasElement, cor = true, repetir = true) {
  const t = new THREE.CanvasTexture(c);
  if (cor) t.colorSpace = THREE.SRGBColorSpace;
  if (repetir) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

const aleatorio = (() => {
  let s = 7;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
})();

// Tijolo à vista: 1 textura = 2 m x 2 m
export function tijolo() {
  const { c, g } = tela(1024, 1024);
  g.fillStyle = "#6b5a4c"; // argamassa
  g.fillRect(0, 0, 1024, 1024);
  const altura = 1024 / 28;
  const largura = altura * 3.1;
  for (let linha = 0; linha < 28; linha++) {
    const y = linha * altura;
    const desloc = (linha % 2) * (largura / 2);
    for (let x = -largura; x < 1024 + largura; x += largura) {
      const r = 120 + aleatorio() * 50;
      const gg = 55 + aleatorio() * 25;
      const b = 40 + aleatorio() * 18;
      g.fillStyle = `rgb(${r},${gg},${b})`;
      g.fillRect(x + desloc + 2, y + 2, largura - 4, altura - 4);
      g.fillStyle = `rgba(0,0,0,${aleatorio() * 0.18})`;
      g.fillRect(x + desloc + 2, y + altura * 0.6, largura - 4, altura * 0.4 - 2);
    }
  }
  const t = textura(c);
  t.repeat.set(0.5, 0.5);
  return t;
}

// Reboco antigo (prédios vizinhos e paredes de dentro)
export function reboco(base: string) {
  const { c, g } = tela(512, 512);
  g.fillStyle = base;
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 2500; i++) {
    g.fillStyle = `rgba(${aleatorio() > 0.5 ? "255,255,255" : "0,0,0"},${aleatorio() * 0.06})`;
    const r = 2 + aleatorio() * 18;
    g.beginPath();
    g.arc(aleatorio() * 512, aleatorio() * 512, r, 0, Math.PI * 2);
    g.fill();
  }
  const t = textura(c);
  t.repeat.set(0.4, 0.4);
  return t;
}

// Pedras da rua + mapa de rugosidade (poças lisas = brilham como molhado)
export function pedras() {
  const cor = tela(1024, 1024);
  const rug = tela(1024, 1024);
  cor.g.fillStyle = "#1c1b1a";
  cor.g.fillRect(0, 0, 1024, 1024);
  rug.g.fillStyle = "#9a9a9a";
  rug.g.fillRect(0, 0, 1024, 1024);
  const tam = 64;
  for (let y = 0; y < 1024; y += tam * 0.8) {
    const desloc = (Math.round(y / (tam * 0.8)) % 2) * tam * 0.5;
    for (let x = -tam; x < 1024 + tam; x += tam) {
      const v = 55 + aleatorio() * 35;
      cor.g.fillStyle = `rgb(${v},${v - 4},${v - 8})`;
      const w = tam * (0.82 + aleatorio() * 0.1);
      const h = tam * 0.8 * (0.8 + aleatorio() * 0.1);
      cor.g.beginPath();
      cor.g.roundRect(x + desloc + 3, y + 3, w, h, 14);
      cor.g.fill();
      const rv = 70 + aleatorio() * 60;
      rug.g.fillStyle = `rgb(${rv},${rv},${rv})`;
      rug.g.beginPath();
      rug.g.roundRect(x + desloc + 3, y + 3, w, h, 14);
      rug.g.fill();
    }
  }
  // poças: manchas escuras no mapa de rugosidade = superfície lisa
  for (let i = 0; i < 14; i++) {
    const x = aleatorio() * 1024;
    const y = aleatorio() * 1024;
    const r = 60 + aleatorio() * 140;
    const gr = rug.g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, "rgba(8,8,8,0.95)");
    gr.addColorStop(1, "rgba(8,8,8,0)");
    rug.g.fillStyle = gr;
    rug.g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const map = textura(cor.c);
  const roughnessMap = textura(rug.c, false);
  [map, roughnessMap].forEach((t) => t.repeat.set(0.35, 0.35));
  return { map, roughnessMap };
}

// Tábuas do piso do salão
export function madeira(base = "#5a3a22") {
  const { c, g } = tela(1024, 1024);
  g.fillStyle = base;
  g.fillRect(0, 0, 1024, 1024);
  const larg = 1024 / 8;
  for (let i = 0; i < 8; i++) {
    const x = i * larg;
    g.fillStyle = `rgba(${aleatorio() > 0.5 ? "255,220,180" : "0,0,0"},${0.04 + aleatorio() * 0.08})`;
    g.fillRect(x, 0, larg, 1024);
    for (let k = 0; k < 40; k++) {
      g.strokeStyle = `rgba(0,0,0,${aleatorio() * 0.12})`;
      g.lineWidth = 1 + aleatorio() * 2;
      const xx = x + aleatorio() * larg;
      g.beginPath();
      g.moveTo(xx, 0);
      g.bezierCurveTo(xx + 8, 300, xx - 8, 700, xx + 4, 1024);
      g.stroke();
    }
    g.fillStyle = "rgba(0,0,0,0.5)";
    g.fillRect(x, 0, 3, 1024);
    const corte = aleatorio() * 1024;
    g.fillRect(x, corte, larg, 3);
  }
  const t = textura(c);
  t.repeat.set(0.4, 0.4);
  return t;
}

// Toldo listrado vermelho e creme
export function listras() {
  const { c, g } = tela(512, 64);
  for (let i = 0; i < 8; i++) {
    g.fillStyle = i % 2 ? "#efe4cf" : "#9e1b1f";
    g.fillRect(i * 64, 0, 64, 64);
  }
  const t = textura(c);
  t.repeat.set(3, 1);
  return t;
}

// Placa com texto (letreiro, quadro-negro, "Benvenuti")
export function placa(opcoes: {
  w: number;
  h: number;
  fundo?: string;
  linhas: { texto: string; fonte: string; cor: string; y: number }[];
  borda?: string;
}) {
  const { c, g } = tela(opcoes.w, opcoes.h);
  if (opcoes.fundo) {
    g.fillStyle = opcoes.fundo;
    g.fillRect(0, 0, opcoes.w, opcoes.h);
  }
  if (opcoes.borda) {
    g.strokeStyle = opcoes.borda;
    g.lineWidth = opcoes.h * 0.03;
    g.strokeRect(opcoes.h * 0.05, opcoes.h * 0.05, opcoes.w - opcoes.h * 0.1, opcoes.h - opcoes.h * 0.1);
  }
  g.textAlign = "center";
  g.textBaseline = "middle";
  opcoes.linhas.forEach((l) => {
    g.font = l.fonte;
    g.fillStyle = l.cor;
    g.fillText(l.texto, opcoes.w / 2, l.y * opcoes.h);
  });
  return textura(c, true, false);
}

// Páginas do cardápio (frente e verso)
export type Prato = [string, string, string]; // nome, descrição, preço
export function paginaCardapio(titulo: string, secoes: { nome: string; pratos: Prato[] }[]) {
  const { c, g } = tela(1024, 1440);
  g.fillStyle = "#f4ecdc";
  g.fillRect(0, 0, 1024, 1440);
  // fibras do papel
  for (let i = 0; i < 1800; i++) {
    g.fillStyle = `rgba(120,90,50,${aleatorio() * 0.05})`;
    g.fillRect(aleatorio() * 1024, aleatorio() * 1440, 1 + aleatorio() * 3, 1);
  }
  g.strokeStyle = "#8a2a1e";
  g.lineWidth = 3;
  g.strokeRect(40, 40, 944, 1360);
  g.textAlign = "center";
  g.fillStyle = "#3b2416";
  g.font = "italic 600 64px Georgia, serif";
  g.fillText("Trattoria Il Tinello", 512, 140);
  g.font = "500 26px Georgia, serif";
  g.fillStyle = "#8a2a1e";
  g.fillText(titulo.toUpperCase().split("").join(" "), 512, 195);
  let y = 290;
  secoes.forEach((s) => {
    g.fillStyle = "#8a2a1e";
    g.font = "600 34px Georgia, serif";
    g.fillText(s.nome, 512, y);
    y += 26;
    g.strokeStyle = "rgba(138,42,30,0.5)";
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(420, y);
    g.lineTo(604, y);
    g.stroke();
    y += 52;
    s.pratos.forEach(([nome, desc, preco]) => {
      g.textAlign = "left";
      g.fillStyle = "#2a1a10";
      g.font = "600 32px Georgia, serif";
      g.fillText(nome, 110, y);
      g.textAlign = "right";
      g.fillText(preco, 914, y);
      g.textAlign = "left";
      g.fillStyle = "#6b5444";
      g.font = "italic 24px Georgia, serif";
      g.fillText(desc, 110, y + 34);
      y += 92;
    });
    g.textAlign = "center";
    y += 30;
  });
  g.fillStyle = "#8a2a1e";
  g.font = "italic 26px Georgia, serif";
  g.fillText("Buon appetito!", 512, 1350);
  return textura(c, true, false);
}
