// Detalhes que dão realismo à rua: oliveiras de verdade, Vespa, floreiras e
// sujeira na base da fachada. Tudo em código. Unidade: metro.
import * as THREE from "three";

let semente = 23;
const sorte = () => {
  semente = (semente * 16807) % 2147483647;
  return (semente - 1) / 2147483646;
};

// Segmento de galho entre dois pontos (cilindro afinando)
function galho(a: THREE.Vector3, b: THREE.Vector3, r0: number, r1: number, mat: THREE.Material) {
  const dir = b.clone().sub(a);
  const g = new THREE.CylinderGeometry(r1, r0, dir.length(), 8, 1);
  const m = new THREE.Mesh(g, mat);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  return m;
}

function texturaCasca() {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 256;
  const g = c.getContext("2d")!;
  g.fillStyle = "#5b5148";
  g.fillRect(0, 0, 128, 256);
  for (let i = 0; i < 220; i++) {
    const v = 40 + sorte() * 70;
    g.strokeStyle = `rgba(${v},${v - 6},${v - 12},0.7)`;
    g.lineWidth = 1 + sorte() * 3;
    const x = sorte() * 128;
    g.beginPath();
    g.moveTo(x, 0);
    g.bezierCurveTo(x + 10, 80, x - 10, 170, x + 4, 256);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// Oliveira em vaso: tronco retorcido, galhos e folhas lanceoladas (instanciadas)
export function oliveira(animar: ((t: number) => void)[]) {
  const arvore = new THREE.Group();
  const casca = texturaCasca();
  const madeira = new THREE.MeshStandardMaterial({ map: casca, bumpMap: casca, bumpScale: 3, roughness: 0.95 });
  // vaso de terracota com borda e terra
  const terracota = new THREE.MeshStandardMaterial({ color: 0xa65a35, roughness: 0.85 });
  const vaso = new THREE.Mesh(
    new THREE.LatheGeometry([[0, 0], [0.22, 0], [0.25, 0.04], [0.3, 0.46], [0.36, 0.48], [0.37, 0.56], [0.33, 0.57], [0.31, 0.52], [0, 0.52]].map(([r, y]) => new THREE.Vector2(r, y)), 40),
    terracota
  );
  arvore.add(vaso);
  const terra = new THREE.Mesh(new THREE.CircleGeometry(0.31, 32), new THREE.MeshStandardMaterial({ color: 0x2b1d14, roughness: 1 }));
  terra.rotation.x = -Math.PI / 2;
  terra.position.y = 0.52;
  arvore.add(terra);

  const copa = new THREE.Group();
  arvore.add(copa);
  // tronco: alguns segmentos tortos, afinando
  const pts = [new THREE.Vector3(0, 0.5, 0)];
  for (let i = 1; i <= 4; i++) {
    const p = pts[i - 1].clone();
    p.y += 0.26;
    p.x += (sorte() - 0.5) * 0.12;
    p.z += (sorte() - 0.5) * 0.12;
    pts.push(p);
  }
  for (let i = 0; i < pts.length - 1; i++) copa.add(galho(pts[i], pts[i + 1], 0.055 - i * 0.008, 0.047 - i * 0.008, madeira));
  const topo = pts[pts.length - 1];
  // galhos e pontas
  const pontas: THREE.Vector3[] = [];
  for (let i = 0; i < 6; i++) {
    const ang = (i / 6) * Math.PI * 2 + sorte() * 0.5;
    const base = pts[2 + (i % 2)].clone().lerp(topo, sorte() * 0.6);
    const fim = base.clone().add(new THREE.Vector3(Math.cos(ang) * (0.22 + sorte() * 0.12), 0.18 + sorte() * 0.2, Math.sin(ang) * (0.22 + sorte() * 0.12)));
    copa.add(galho(base, fim, 0.022, 0.012, madeira));
    pontas.push(fim);
    for (let k = 0; k < 2; k++) {
      const sub = fim.clone().add(new THREE.Vector3((sorte() - 0.5) * 0.22, 0.08 + sorte() * 0.14, (sorte() - 0.5) * 0.22));
      copa.add(galho(fim, sub, 0.011, 0.006, madeira));
      pontas.push(sub);
    }
  }
  pontas.push(topo.clone().add(new THREE.Vector3(0, 0.15, 0)));
  // folhas: lanceoladas, verde-oliva por cima e prateadas por baixo (variação de cor)
  const forma = new THREE.Shape();
  forma.moveTo(0, 0);
  forma.quadraticCurveTo(0.009, 0.03, 0, 0.065);
  forma.quadraticCurveTo(-0.009, 0.03, 0, 0);
  const folhaGeo = new THREE.ShapeGeometry(forma, 4);
  const porPonta = 160;
  const folhas = new THREE.InstancedMesh(
    folhaGeo,
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.65, side: THREE.DoubleSide }),
    pontas.length * porPonta
  );
  const d = new THREE.Object3D();
  const cor = new THREE.Color();
  let n = 0;
  pontas.forEach((p) => {
    for (let i = 0; i < porPonta; i++) {
      const r = 0.2 * Math.cbrt(sorte());
      const th = sorte() * Math.PI * 2;
      const ph = Math.acos(2 * sorte() - 1);
      d.position.set(p.x + r * Math.sin(ph) * Math.cos(th), p.y + r * Math.cos(ph) * 0.8, p.z + r * Math.sin(ph) * Math.sin(th));
      d.rotation.set(sorte() * Math.PI * 2, sorte() * Math.PI * 2, sorte() * Math.PI * 2);
      d.scale.setScalar(0.8 + sorte() * 0.5);
      d.updateMatrix();
      folhas.setMatrixAt(n, d.matrix);
      folhas.setColorAt(n, cor.set(sorte() > 0.35 ? 0x56633a : 0x9aa48a).multiplyScalar(0.85 + sorte() * 0.3));
      n++;
    }
  });
  copa.add(folhas);
  const f = sorte() * 5;
  animar.push((t) => {
    copa.rotation.z = Math.sin(t * 0.9 + f) * 0.012;
    copa.rotation.x = Math.sin(t * 0.7 + f) * 0.01;
  });
  return arvore;
}

// Vespa clássica (anos 60), verde-menta, de frente para +X
export function vespa() {
  const v = new THREE.Group();
  const pintura = new THREE.MeshPhysicalMaterial({ color: 0x9fcfbf, metalness: 0.15, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.06 });
  const cromo = new THREE.MeshStandardMaterial({ color: 0xe6e8ec, metalness: 1, roughness: 0.12 });
  const borracha = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.9 });
  const couro = new THREE.MeshStandardMaterial({ color: 0x5a3320, roughness: 0.55 });
  const escuro = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.6, metalness: 0.4 });

  // rodas (pneu, aro cromado, cubo)
  const roda = (x: number) => {
    const r = new THREE.Group();
    r.position.set(x, 0.2, 0);
    const pneu = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.055, 14, 40), borracha);
    r.add(pneu);
    const aro = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.115, 0.07, 32), cromo);
    aro.rotation.x = Math.PI / 2;
    r.add(aro);
    const cubo = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.1, 20), escuro);
    cubo.rotation.x = Math.PI / 2;
    r.add(cubo);
    v.add(r);
  };
  roda(0.62);
  roda(-0.58);

  // carenagem traseira abaulada (o "bumbum" da Vespa)
  const carenagem = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 24), pintura);
  carenagem.scale.set(0.44, 0.26, 0.25);
  carenagem.position.set(-0.43, 0.44, 0);
  v.add(carenagem);
  const saia = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), pintura);
  saia.scale.set(0.4, 0.17, 0.23);
  saia.position.set(-0.47, 0.33, 0);
  v.add(saia);
  // assoalho com frisos de borracha
  const assoalho = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.05, 0.32), pintura);
  assoalho.position.set(0.08, 0.27, 0);
  v.add(assoalho);
  for (let i = 0; i < 6; i++) {
    const friso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.012, 0.012), borracha);
    friso.position.set(0.08, 0.3, -0.12 + i * 0.048);
    v.add(friso);
  }
  // escudo frontal curvo
  const escudo = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.26, 0.66, 32, 1, true, -0.85, 1.7), pintura);
  (escudo.material as THREE.MeshPhysicalMaterial).side = THREE.DoubleSide;
  // o arco do cilindro nasce virado para +Z; gira para ficar de frente (+X) e inclina para trás
  escudo.rotation.order = "ZYX";
  escudo.rotation.y = Math.PI / 2;
  escudo.rotation.z = -0.28;
  escudo.position.set(0.2, 0.6, 0);
  v.add(escudo);
  // para-lama dianteiro
  const paralama = new THREE.Mesh(new THREE.SphereGeometry(0.21, 28, 16, 0, Math.PI * 2, 0, Math.PI * 0.45), pintura);
  paralama.scale.set(1.15, 0.9, 0.62);
  paralama.position.set(0.62, 0.28, 0);
  v.add(paralama);
  // coluna de direção, guidão, farol, manoplas e espelho
  const coluna = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.5, 16), pintura);
  coluna.position.set(0.5, 0.72, 0);
  coluna.rotation.z = -0.28;
  v.add(coluna);
  const guidao = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.46, 6, 16), pintura);
  guidao.rotation.x = Math.PI / 2;
  guidao.position.set(0.56, 0.98, 0);
  v.add(guidao);
  const farol = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.075, 0.06, 28), cromo);
  farol.rotation.z = Math.PI / 2;
  farol.position.set(0.62, 0.98, 0);
  v.add(farol);
  const lente = new THREE.Mesh(new THREE.CircleGeometry(0.06, 28), new THREE.MeshStandardMaterial({ color: 0xfff6e0, roughness: 0.05, metalness: 0.2, emissive: 0x3a3020 }));
  lente.rotation.y = Math.PI / 2;
  lente.position.set(0.655, 0.98, 0);
  v.add(lente);
  [-1, 1].forEach((lado) => {
    const manopla = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.11, 12), borracha);
    manopla.rotation.x = Math.PI / 2;
    manopla.position.set(0.56, 0.98, lado * 0.33);
    v.add(manopla);
    const alavanca = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.012, 0.02), cromo);
    alavanca.position.set(0.6, 0.97, lado * 0.27);
    v.add(alavanca);
  });
  const haste = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.22), cromo);
  haste.position.set(0.54, 1.09, -0.2);
  v.add(haste);
  const espelho = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.012, 20), cromo);
  espelho.rotation.z = Math.PI / 2;
  espelho.position.set(0.54, 1.2, -0.2);
  v.add(espelho);
  // grade da buzina no escudo
  const buzina = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.06, 0.09), cromo);
  buzina.position.set(0.34, 0.8, 0);
  v.add(buzina);
  // banco de couro, lanterna traseira, escapamento
  const banco = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.42, 8, 16), couro);
  banco.rotation.z = Math.PI / 2;
  banco.scale.set(1, 1, 1.1);
  banco.position.set(-0.32, 0.73, 0);
  v.add(banco);
  const lanterna = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.05, 0.08), new THREE.MeshStandardMaterial({ color: 0x8a0d0d, roughness: 0.2, emissive: 0x200000 }));
  lanterna.position.set(-0.86, 0.56, 0);
  v.add(lanterna);
  const escape = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.3, 6, 12), cromo);
  escape.rotation.z = Math.PI / 2;
  escape.position.set(-0.45, 0.2, 0.2);
  v.add(escape);
  // descansando no pezinho: leve inclinação
  v.rotation.x = 0.07;
  return v;
}

// Floreira com gerânios vermelhos no parapeito
export function floreira(largura: number) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.BoxGeometry(largura, 0.17, 0.22), new THREE.MeshStandardMaterial({ color: 0x8e4a2c, roughness: 0.85 })));
  const n = Math.round(largura * 40);
  const folhas = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.035, 0), new THREE.MeshStandardMaterial({ color: 0x3d6b2e, roughness: 0.7, flatShading: true }), n);
  const flores = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.022, 1), new THREE.MeshStandardMaterial({ color: 0xc8202a, roughness: 0.5 }), Math.round(n * 0.6));
  const d = new THREE.Object3D();
  for (let i = 0; i < n; i++) {
    d.position.set((sorte() - 0.5) * largura * 0.95, 0.1 + sorte() * 0.12, (sorte() - 0.5) * 0.2);
    d.rotation.set(sorte() * 3, sorte() * 3, 0);
    d.scale.setScalar(0.8 + sorte() * 0.8);
    d.updateMatrix();
    folhas.setMatrixAt(i, d.matrix);
  }
  for (let i = 0; i < flores.count; i++) {
    d.position.set((sorte() - 0.5) * largura * 0.9, 0.2 + sorte() * 0.12, (sorte() - 0.5) * 0.18);
    d.scale.setScalar(0.8 + sorte() * 0.6);
    d.updateMatrix();
    flores.setMatrixAt(i, d.matrix);
  }
  g.add(folhas, flores);
  return g;
}

// Sujeira e umidade na base da fachada (faixas escuras que somem para cima),
// só nos trechos de parede (sem cobrir porta e vitrines)
export function sujeiraFachada() {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 256;
  const g = c.getContext("2d")!;
  const gr = g.createLinearGradient(0, 256, 0, 0);
  gr.addColorStop(0, "rgba(255,255,255,1)");
  gr.addColorStop(0.35, "rgba(255,255,255,0.45)");
  gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 256);
  for (let i = 0; i < 60; i++) {
    g.fillStyle = `rgba(255,255,255,${sorte() * 0.25})`;
    g.fillRect(sorte() * 64, 120 + sorte() * 136, 1 + sorte() * 2, 20 + sorte() * 60);
  }
  const alpha = new THREE.CanvasTexture(c);
  const mat = new THREE.MeshBasicMaterial({ color: 0x0c0806, alphaMap: alpha, transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  const grupo = new THREE.Group();
  const faixa = (x0: number, x1: number, y0: number, y1: number) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, y1 - y0), mat);
    m.position.set((x0 + x1) / 2, (y0 + y1) / 2, 0.004);
    m.userData.semSombra = true;
    grupo.add(m);
  };
  faixa(-4.6, -3.9, 0, 1.3);
  faixa(-1.3, -0.65, 0, 1.3);
  faixa(0.65, 1.3, 0, 1.3);
  faixa(3.9, 4.6, 0, 1.3);
  faixa(-3.9, -1.3, 0, 0.7);
  faixa(1.3, 3.9, 0, 0.7);
  return grupo;
}

// Toalha com dobras: cilindro aberto com ondas que crescem para baixo
export function toalhaComDobras(raio: number, altura: number, mat: THREE.Material) {
  const geo = new THREE.CylinderGeometry(raio, raio + 0.04, altura, 120, 8, true);
  const pos = geo.attributes.position;
  const fase = sorte() * 6;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const ang = Math.atan2(z, x);
    const desce = Math.min(1, Math.max(0, (altura / 2 - y) / altura)); // 0 no topo, 1 embaixo (clamp evita NaN)
    const onda = Math.sin(ang * 13 + fase) * 0.6 + Math.sin(ang * 7 + fase * 2) * 0.4;
    const r = Math.hypot(x, z) + onda * 0.028 * desce ** 1.3;
    pos.setX(i, Math.cos(ang) * r);
    pos.setZ(i, Math.sin(ang) * r);
  }
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, mat);
}
