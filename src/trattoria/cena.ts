// O cenário inteiro, feito em código. Unidade: metro.
// A fachada fica em z = 0 olhando para +Z (a rua); o salão vai de z = 0 a z = -10.
import * as THREE from "three";
import * as T from "./texturas";
import { criarVida, type Mesa } from "./vida";

// Mesas do salão: posição, se tem luminária acesa e quais lugares estão ocupados
export const MESAS: Mesa[] = [
  { x: -2.4, z: -2.6, luz: true, ocupada: [true, true] },
  { x: 2.4, z: -2.6, luz: false, ocupada: [true, true] },
  { x: -2.4, z: -6.0, luz: false, ocupada: [false, true] },
  { x: 0, z: -4.3, luz: true, ocupada: [true, false] },
  { x: 2.4, z: -6.2, luz: true, ocupada: [true, true] },
  { x: -1.2, z: -8.4, luz: false, ocupada: [false, false] },
];

type Animavel = (tempo: number) => void;

export type Cenario = {
  grupo: THREE.Group;
  cardapio: THREE.Group; // flutua na frente da câmera no fim
  paginaVirada: { valor: number }; // 0 = frente, 1 = verso (o motor anima)
  animar: Animavel[];
};

const LUZ_QUENTE = 0xffb066;

function malha(geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}

function torno(perfil: [number, number][], seg = 32) {
  return new THREE.LatheGeometry(perfil.map(([r, y]) => new THREE.Vector2(r, y)), seg);
}

// Lâmpada: bulbo que brilha + luz pontual de verdade (opcional)
// Cone de luz atravessando a névoa: some suavemente para baixo e nas bordas
function coneDeLuz(x: number, y: number, z: number, altura: number, raio: number) {
  const geo = new THREE.ConeGeometry(raio, altura, 32, 1, true);
  geo.translate(0, -altura / 2, 0);
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: { cor: { value: new THREE.Color(LUZ_QUENTE) }, altura: { value: altura } },
    vertexShader: "varying float vy; varying vec3 vn; varying vec3 vv; uniform float altura; void main(){ vy = -position.y / altura; vec4 mv = modelViewMatrix * vec4(position,1.0); vn = normalize(normalMatrix * normal); vv = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }",
    fragmentShader: "uniform vec3 cor; varying float vy; varying vec3 vn; varying vec3 vv; void main(){ float borda = pow(clamp(abs(dot(vn, vv)), 0.0, 1.0), 1.6); float queda = pow(clamp(1.0 - vy, 0.0, 1.0), 1.8); gl_FragColor = vec4(cor * 0.16 * borda * queda, 1.0); }",
  });
  const cone = new THREE.Mesh(geo, mat);
  cone.position.set(x, y, z);
  cone.userData.semSombra = true;
  return cone;
}

function lampada(raio: number, intensidade: number, comLuz: boolean, distancia = 7) {
  const g = new THREE.Group();
  const bulbo = new THREE.Mesh(
    new THREE.SphereGeometry(raio, 12, 8),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(LUZ_QUENTE).multiplyScalar(6), toneMapped: true })
  );
  g.add(bulbo);
  if (comLuz) {
    const l = new THREE.PointLight(LUZ_QUENTE, intensidade, distancia, 2);
    g.add(l);
  }
  return g;
}

export function criarCenario(): Cenario {
  const grupo = new THREE.Group();
  const animar: Animavel[] = [];

  // ---------- materiais ----------
  const texTijolo = T.tijolo();
  const tijolo = new THREE.MeshStandardMaterial({ map: texTijolo.map, bumpMap: texTijolo.bump, bumpScale: 4, roughness: 0.9 });
  const ped = T.pedras();
  // 1 textura = 3 m (antes a pedra saía com metros de largura)
  [ped.map, ped.roughnessMap, ped.bump].forEach((t) => t.repeat.set(13, 13));
  const rua = new THREE.MeshStandardMaterial({ map: ped.map, roughnessMap: ped.roughnessMap, bumpMap: ped.bump, bumpScale: 6, roughness: 1, metalness: 0.1, envMapIntensity: 1.6 });
  const texPiso = T.madeira();
  texPiso.repeat.set(3, 3);
  const piso = new THREE.MeshStandardMaterial({ map: texPiso, bumpMap: texPiso, bumpScale: 1.2, roughness: 0.42 });
  const madeiraEscura = new THREE.MeshStandardMaterial({ map: T.madeira("#2e1c10"), roughness: 0.6 });
  const texReboco = T.reboco("#b88a5e");
  const rebocoQuente = new THREE.MeshStandardMaterial({ map: texReboco, bumpMap: texReboco, bumpScale: 2.5, roughness: 0.95 });
  const texToalha = T.xadrez();
  texToalha.repeat.set(6, 1);
  const toalha = new THREE.MeshStandardMaterial({ map: texToalha, roughness: 0.92 });
  const texTampo = T.xadrez();
  texTampo.repeat.set(2.5, 2.5);
  const toalhaTampo = new THREE.MeshStandardMaterial({ map: texTampo, roughness: 0.92 });
  const verdeVeneziana = new THREE.MeshStandardMaterial({ color: 0x2f4a36, roughness: 0.7 });
  const ferro = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.5, metalness: 0.8 });
  const latao = new THREE.MeshStandardMaterial({ color: 0xc8963e, roughness: 0.3, metalness: 1 });
  const terracota = new THREE.MeshStandardMaterial({ color: 0xa4552f, roughness: 0.85 });
  const folhas = new THREE.MeshStandardMaterial({ color: 0x7f8f5c, roughness: 0.75, flatShading: true });
  const vidroQuente = new THREE.MeshStandardMaterial({ color: 0xffc58a, transparent: true, opacity: 0.12, roughness: 0.05, metalness: 0.2, depthWrite: false });
  const garrafaVerde = new THREE.MeshStandardMaterial({ color: 0x1d3b1f, roughness: 0.15, metalness: 0.3 });
  const porcelana = new THREE.MeshStandardMaterial({ color: 0xf7f3ea, roughness: 0.35 });

  // ---------- rua ----------
  const chao = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), rua);
  chao.rotation.x = -Math.PI / 2;
  chao.position.set(0, 0, 14);
  grupo.add(chao);
  const calcada = malha(new THREE.BoxGeometry(30, 0.15, 1.6), new THREE.MeshStandardMaterial({ color: 0x4a4744, roughness: 0.6 }), 0, 0.075, 0.8);
  grupo.add(calcada);

  // ---------- fachada com vãos (porta, vitrines, janelas de cima) ----------
  const forma = new THREE.Shape();
  forma.moveTo(-4.6, 0);
  forma.lineTo(4.6, 0);
  forma.lineTo(4.6, 7.4);
  forma.lineTo(-4.6, 7.4);
  forma.closePath();
  const vao = (x0: number, y0: number, x1: number, y1: number) => {
    const p = new THREE.Path();
    p.moveTo(x0, y0);
    p.lineTo(x0, y1);
    p.lineTo(x1, y1);
    p.lineTo(x1, y0);
    p.closePath();
    forma.holes.push(p);
  };
  vao(-0.65, 0.15, 0.65, 2.5); // porta
  vao(-3.9, 0.7, -1.3, 2.6); // vitrine esquerda
  vao(1.3, 0.7, 3.9, 2.6); // vitrine direita
  vao(-3.1, 4.1, -1.9, 5.8); // janela de cima
  vao(1.9, 4.1, 3.1, 5.8);
  const fachada = new THREE.Mesh(new THREE.ExtrudeGeometry(forma, { depth: 0.35, bevelEnabled: false }), tijolo);
  fachada.position.z = -0.35;
  grupo.add(fachada);

  // molduras das vitrines e vidros quentes
  [-2.6, 2.6].forEach((x) => {
    const moldura = malha(new THREE.BoxGeometry(2.7, 0.08, 0.12), madeiraEscura, x, 0.7, 0.02);
    const topo = moldura.clone();
    topo.position.y = 2.6;
    const vidro = malha(new THREE.PlaneGeometry(2.6, 1.9), vidroQuente, x, 1.65, -0.18);
    const travessa = malha(new THREE.BoxGeometry(0.06, 1.9, 0.06), madeiraEscura, x, 1.65, -0.16);
    grupo.add(moldura, topo, vidro, travessa);
  });

  // porta aberta para dentro (a câmera passa por ela)
  const folha = new THREE.Group();
  folha.position.set(-0.62, 0.15, -0.3);
  const madeiraPorta = malha(new THREE.BoxGeometry(1.24, 2.35, 0.05), madeiraEscura, 0.62, 1.175, 0);
  const vidroPorta = malha(new THREE.PlaneGeometry(0.8, 1.2), vidroQuente, 0.62, 1.55, 0.03);
  folha.add(madeiraPorta, vidroPorta);
  folha.rotation.y = -1.9;
  grupo.add(folha);

  // janelas de cima: venezianas verdes abertas, uma acesa
  [-2.5, 2.5].forEach((x, i) => {
    [-1, 1].forEach((lado) => {
      const v = malha(new THREE.BoxGeometry(0.62, 1.7, 0.05), verdeVeneziana, x + lado * 0.95, 4.95, 0.05);
      v.rotation.y = lado * 0.35;
      grupo.add(v);
    });
    const luz = malha(
      new THREE.PlaneGeometry(1.2, 1.7),
      new THREE.MeshBasicMaterial({ color: i === 0 ? new THREE.Color(0xffa860).multiplyScalar(1.6) : 0x0b0d12 }),
      x, 4.95, -0.3
    );
    grupo.add(luz);
    grupo.add(malha(new THREE.BoxGeometry(1.5, 0.08, 0.35), rebocoQuente, x, 4.05, 0.12));
  });

  // toldo listrado inclinado, com franja
  const texToldo = T.listras();
  const toldo = new THREE.Mesh(new THREE.PlaneGeometry(8.4, 1.6, 1, 1), new THREE.MeshStandardMaterial({ map: texToldo, side: THREE.DoubleSide, roughness: 0.8 }));
  toldo.position.set(0, 2.95, 0.7);
  toldo.rotation.x = -1.1;
  grupo.add(toldo);
  const texFranja = texToldo.clone();
  texFranja.repeat.set(3, 1);
  const franja = malha(new THREE.PlaneGeometry(8.4, 0.28), new THREE.MeshStandardMaterial({ map: texFranja, side: THREE.DoubleSide, roughness: 0.8 }), 0, 2.48, 1.42);
  grupo.add(franja);

  // letreiro acima do toldo
  const texLetreiro = T.placa({
        w: 1600, h: 286,
        linhas: [{ texto: "Trattoria Il Tinello", fonte: "italic 600 150px Georgia, serif", cor: "#f2e3c2", y: 0.55 }],
      });
  const letreiro = malha(
    new THREE.PlaneGeometry(4.2, 0.75),
    new THREE.MeshStandardMaterial({
      emissiveMap: texLetreiro,
      map: T.placa({
        w: 1600, h: 286, fundo: "#16301f", borda: "#c8963e",
        linhas: [{ texto: "Trattoria Il Tinello", fonte: "italic 600 150px Georgia, serif", cor: "#f2e3c2", y: 0.55 }],
      }),
      emissive: 0xffffff, emissiveIntensity: 0.45, roughness: 0.6,
    }),
    0, 3.55, 0.06
  );
  grupo.add(letreiro);
  [-1.5, 0, 1.5].forEach((x) => {
    const arandela = lampada(0.05, 1.2, x === 0, 4);
    arandela.position.set(x, 4.05, 0.35);
    grupo.add(arandela);
    grupo.add(malha(new THREE.CylinderGeometry(0.015, 0.015, 0.35), ferro, x, 4.05, 0.18).rotateX(Math.PI / 2));
  });

  // vasos com oliveiras ao lado da porta
  [-1.05, 1.05].forEach((x, i) => {
    const vaso = malha(torno([[0, 0], [0.26, 0], [0.32, 0.5], [0.35, 0.55], [0.3, 0.55], [0, 0.5]]), terracota, x, 0.15, 0.55);
    const tronco = malha(new THREE.CylinderGeometry(0.03, 0.05, 1.1, 8), madeiraEscura, x, 1.15, 0.55);
    grupo.add(vaso, tronco);
    for (let k = 0; k < 26; k++) {
      const copa = malha(new THREE.IcosahedronGeometry(0.11 + Math.random() * 0.09, 1), folhas,
        x + (Math.random() - 0.5) * 0.55, 1.75 + Math.random() * 0.45, 0.55 + (Math.random() - 0.5) * 0.45);
      grupo.add(copa);
    }
    animar.push((t) => {
      tronco.rotation.z = Math.sin(t * 0.8 + i) * 0.015;
    });
  });

  // quadro-negro na calçada
  const quadro = new THREE.Group();
  quadro.position.set(2.4, 0.15, 2.1);
  quadro.rotation.y = -0.35;
  const texQuadro = T.placa({
    w: 600, h: 840, fundo: "#1d211f", borda: "#6b4a2b",
    linhas: [
      { texto: "Entre.", fonte: "italic 86px Georgia, serif", cor: "#efe9dc", y: 0.24 },
      { texto: "Fique mais", fonte: "italic 70px Georgia, serif", cor: "#efe9dc", y: 0.4 },
      { texto: "um pouco.", fonte: "italic 70px Georgia, serif", cor: "#efe9dc", y: 0.5 },
      { texto: "Massa fresca", fonte: "40px Georgia, serif", cor: "#e7b9a1", y: 0.68 },
      { texto: "todo dia", fonte: "40px Georgia, serif", cor: "#e7b9a1", y: 0.75 },
    ],
  });
  [-1, 1].forEach((lado) => {
    const p = malha(new THREE.PlaneGeometry(0.6, 0.84), new THREE.MeshStandardMaterial({ map: texQuadro, roughness: 0.9, side: THREE.DoubleSide }), 0, 0.48, lado * 0.12);
    p.rotation.x = lado * -0.25;
    if (lado < 0) p.rotation.y = Math.PI;
    quadro.add(p);
  });
  grupo.add(quadro);

  // varal de lâmpadas atravessando a rua (catenária)
  const postes = [
    [-5, 9],
    [5, 9],
  ];
  postes.forEach(([x, z]) => {
    grupo.add(malha(new THREE.CylinderGeometry(0.05, 0.07, 4.2, 10), ferro, x, 2.1, z));
    // lampião no alto + cone de luz visível na névoa + luz que faz sombra
    const lampiao = malha(new THREE.CylinderGeometry(0.12, 0.2, 0.32, 6), ferro, x, 4.4, z);
    grupo.add(lampiao);
    const chamaLampiao = lampada(0.07, 0, false);
    chamaLampiao.position.set(x, 4.3, z);
    grupo.add(chamaLampiao);
    grupo.add(coneDeLuz(x, 4.25, z, 4.1, 1.9));
    const spot = new THREE.SpotLight(LUZ_QUENTE, 30, 12, 0.75, 0.6, 2);
    spot.position.set(x, 4.25, z);
    spot.target.position.set(x, 0, z);
    spot.castShadow = true;
    spot.userData.sombra = true;
    grupo.add(spot, spot.target);
  });
  const fios: [THREE.Vector3, THREE.Vector3][] = [
    [new THREE.Vector3(-4.4, 4.3, 0.1), new THREE.Vector3(5, 4.1, 9)],
    [new THREE.Vector3(4.4, 4.3, 0.1), new THREE.Vector3(-5, 4.1, 9)],
    [new THREE.Vector3(-5, 4.1, 9), new THREE.Vector3(5, 4.1, 9)],
  ];
  const bulbos = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.06, 10, 8),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(LUZ_QUENTE).multiplyScalar(8) }),
    fios.length * 12
  );
  let n = 0;
  const d = new THREE.Object3D();
  fios.forEach(([a, b], fi) => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 24; i++) {
      const t = i / 24;
      const p = a.clone().lerp(b, t);
      p.y -= Math.sin(t * Math.PI) * 0.9; // barriga do fio
      pts.push(p);
    }
    const curva = new THREE.CatmullRomCurve3(pts);
    grupo.add(new THREE.Mesh(new THREE.TubeGeometry(curva, 48, 0.008, 4), ferro));
    for (let i = 1; i <= 12; i++) {
      const p = curva.getPoint(i / 13);
      d.position.copy(p).y -= 0.07;
      d.updateMatrix();
      bulbos.setMatrixAt(n++, d.matrix);
      if (i % 6 === 3) {
        const l = new THREE.PointLight(LUZ_QUENTE, 3.5, 9, 2);
        l.position.copy(p);
        grupo.add(l);
      }
    }
    animar.push((t) => {
      bulbos.material.color.setScalar(1).multiply(new THREE.Color(LUZ_QUENTE)).multiplyScalar(7.5 + Math.sin(t * 2.1 + fi) * 0.4);
    });
  });
  grupo.add(bulbos);

  // prédios vizinhos (reboco ocre e rosado), com algumas janelas acesas
  const vizinho = (x: number, largura: number, altura: number, cor: string) => {
    const m = new THREE.MeshStandardMaterial({ map: T.reboco(cor), roughness: 0.95 });
    grupo.add(malha(new THREE.BoxGeometry(largura, altura, 0.5), m, x, altura / 2, -0.25));
    for (let i = 0; i < 4; i++) {
      const acesa = Math.random() > 0.6;
      const j = malha(
        new THREE.PlaneGeometry(0.9, 1.3),
        new THREE.MeshBasicMaterial({ color: acesa ? new THREE.Color(0xd9803c).multiplyScalar(0.28) : 0x07080b }),
        x + (i % 2 ? 1 : -1) * largura * 0.22, 2 + Math.floor(i / 2) * 2.6, 0.01
      );
      grupo.add(j);
    }
  };
  vizinho(-8.6, 7.4, 9, "#9a7a4a");
  vizinho(8.4, 7, 8.2, "#94675c");

  // ---------- salão ----------
  const salaPiso = new THREE.Mesh(new THREE.PlaneGeometry(9, 10), piso);
  salaPiso.rotation.x = -Math.PI / 2;
  salaPiso.position.set(0, 0.15, -5.35);
  grupo.add(salaPiso);
  grupo.add(malha(new THREE.BoxGeometry(9, 3.6, 0.2), rebocoQuente, 0, 1.95, -10.4)); // fundo
  [-4.5, 4.5].forEach((x) => grupo.add(malha(new THREE.BoxGeometry(0.2, 3.6, 10.2), rebocoQuente, x, 1.95, -5.3)));
  const teto = new THREE.Mesh(new THREE.PlaneGeometry(9, 10.2), new THREE.MeshStandardMaterial({ color: 0x3a2618, roughness: 0.9 }));
  teto.rotation.x = Math.PI / 2;
  teto.position.set(0, 3.75, -5.3);
  grupo.add(teto);
  for (let z = -1; z > -10; z -= 1.4) grupo.add(malha(new THREE.BoxGeometry(9, 0.18, 0.16), madeiraEscura, 0, 3.62, z));
  // rodapé de tijolo dentro
  [-4.38, 4.38].forEach((x) => grupo.add(malha(new THREE.BoxGeometry(0.05, 1.0, 10), tijolo, x, 0.65, -5.3)));

  // mesas, cadeiras, velas e luminárias
  const mesa = (x: number, z: number, comLuz: boolean) => {
    const g = new THREE.Group();
    g.position.set(x, 0.15, z);
    g.add(malha(new THREE.CylinderGeometry(0.56, 0.6, 0.32, 40, 1, true), toalha, 0, 0.6, 0));
    g.add(malha(new THREE.CylinderGeometry(0.56, 0.56, 0.02, 40), toalhaTampo, 0, 0.76, 0));
    [0, Math.PI].forEach((a) => {
      const c = new THREE.Group();
      c.position.set(Math.sin(a) * 0.85, 0, Math.cos(a) * 0.85);
      c.rotation.y = a + Math.PI;
      c.add(malha(new THREE.BoxGeometry(0.42, 0.04, 0.42), madeiraEscura, 0, 0.45, 0));
      [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]].forEach(([px, pz]) =>
        c.add(malha(new THREE.CylinderGeometry(0.015, 0.015, 0.45), madeiraEscura, px, 0.225, pz))
      );
      const encosto = malha(new THREE.TorusGeometry(0.2, 0.016, 6, 20, Math.PI), madeiraEscura, 0, 0.72, -0.2);
      c.add(encosto);
      g.add(c);
    });
    // pratos, garrafa e vela
    [-0.25, 0.25].forEach((pz) => g.add(malha(torno([[0, 0], [0.12, 0], [0.13, 0.015], [0.11, 0.012], [0, 0.012]], 24), porcelana, 0, 0.775, pz)));
    g.add(malha(torno([[0, 0], [0.04, 0], [0.04, 0.2], [0.012, 0.26], [0.012, 0.31], [0, 0.31]], 16), garrafaVerde, 0.18, 0.775, 0));
    g.add(malha(new THREE.CylinderGeometry(0.02, 0.02, 0.1, 10), porcelana, -0.15, 0.82, 0));
    const chama = lampada(0.012, 0, false);
    chama.position.set(-0.15, 0.885, 0);
    g.add(chama);
    animar.push((t) => chama.scale.setScalar(1 + Math.sin(t * 13 + x * 3) * 0.15));
    // luminária pendente de latão
    const pend = new THREE.Group();
    pend.position.set(0, 3.75, 0);
    pend.add(malha(new THREE.CylinderGeometry(0.006, 0.006, 1.3), ferro, 0, -0.65, 0));
    const cupula = malha(torno([[0.05, 0], [0.24, -0.22], [0.25, -0.24]], 32), latao, 0, -1.3, 0);
    (cupula.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
    pend.add(cupula);
    const bulbo = lampada(0.05, comLuz ? 3 : 0, comLuz, 6);
    bulbo.position.y = -1.48;
    pend.add(bulbo);
    if (comLuz) {
      const spot = new THREE.SpotLight(LUZ_QUENTE, 9, 6, 1.0, 0.7, 2);
      spot.position.set(0, -1.45, 0);
      spot.target.position.set(0, -3.75, 0);
      spot.castShadow = true;
      spot.userData.sombra = true;
      pend.add(spot, spot.target);
    }
    g.add(pend);
    grupo.add(g);
  };
  MESAS.forEach((m) => mesa(m.x, m.z, m.luz));
  const vida = criarVida(grupo, MESAS);
  animar.push(...vida.animar);

  // quadros antigos nas paredes (molduras escuras com "fotos" sépia)
  const sepia = (seed: number) =>
    T.placa({
      w: 256, h: 320, fundo: ["#6e5536", "#5c4a33", "#7a6142"][seed % 3],
      linhas: [{ texto: ["Roma 1958", "La famiglia", "Napoli"][seed % 3], fonte: "italic 26px Georgia, serif", cor: "rgba(240,225,200,0.7)", y: 0.88 }],
    });
  [[-4.38, 1.9, -3.2], [-4.38, 2.1, -7.4], [4.38, 2.0, -4.6]].forEach(([x, y, z], i) => {
    const q = new THREE.Group();
    q.position.set(x, y, z);
    q.rotation.y = x < 0 ? Math.PI / 2 : -Math.PI / 2;
    q.add(malha(new THREE.BoxGeometry(0.7, 0.86, 0.04), madeiraEscura));
    q.add(malha(new THREE.PlaneGeometry(0.56, 0.7), new THREE.MeshStandardMaterial({ map: sepia(i), roughness: 0.6 }), 0, 0, 0.025));
    grupo.add(q);
  });

  // balcão com garrafas no fundo
  grupo.add(malha(new THREE.BoxGeometry(3.4, 1.05, 0.6), madeiraEscura, 2.2, 0.68, -9.6));
  grupo.add(malha(new THREE.BoxGeometry(3.4, 0.05, 0.3), madeiraEscura, 2.2, 2.0, -10.15));
  const garrafas = new THREE.InstancedMesh(torno([[0, 0], [0.04, 0], [0.04, 0.2], [0.012, 0.26], [0.012, 0.31], [0, 0.31]], 12), garrafaVerde, 12);
  for (let i = 0; i < 12; i++) {
    d.position.set(0.7 + i * 0.27, 2.03, -10.15);
    d.rotation.set(0, 0, 0);
    d.updateMatrix();
    garrafas.setMatrixAt(i, d.matrix);
  }
  grupo.add(garrafas);
  const luzBalcao = new THREE.PointLight(LUZ_QUENTE, 4, 5, 2);
  luzBalcao.position.set(2.2, 2.6, -9.2);
  grupo.add(luzBalcao);

  // "Benvenuti" escrito no ar
  const benvenuti = malha(
    new THREE.PlaneGeometry(2.6, 0.75),
    new THREE.MeshBasicMaterial({
      map: T.placa({ w: 1400, h: 400, linhas: [{ texto: "Benvenuti", fonte: "italic 230px Georgia, serif", cor: "#ffe9c9", y: 0.55 }] }),
      transparent: true, depthWrite: false, toneMapped: false, opacity: 0.9,
    }),
    0, 2.35, -4.0
  );
  grupo.add(benvenuti);
  animar.push((t) => {
    benvenuti.position.y = 2.35 + Math.sin(t * 0.9) * 0.04;
  });

  // ---------- cardápio de papel, frente e verso ----------
  const cardapio = new THREE.Group();
  cardapio.position.set(1.55, 1.28, -6.95);
  const folhaCardapio = new THREE.Group();
  const geo = new THREE.PlaneGeometry(0.5, 0.7, 24, 1);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    pos.setZ(i, Math.cos((x / 0.25) * Math.PI * 0.5) * 0.018); // leve curvatura do papel
  }
  geo.computeVertexNormals();
  const frente = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    map: T.paginaCardapio("Il menù", [
      { nome: "Antipasti", pratos: [["Bruschetta al pomodoro", "pão na brasa, tomate, manjericão", "R$ 32"], ["Burrata pugliese", "burrata, tomates assados, azeite", "R$ 58"]] },
      { nome: "Primi", pratos: [["Spaghetti alla carbonara", "guanciale, gema, pecorino", "R$ 74"], ["Cacio e pepe", "tonnarelli, pecorino, pimenta-do-reino", "R$ 68"], ["Lasagna della nonna", "ragù de 6 horas, bechamel", "R$ 79"]] },
    ]),
    roughness: 0.85, side: THREE.FrontSide,
  }));
  const verso = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    map: T.paginaCardapio("Il menù", [
      { nome: "Secondi", pratos: [["Ossobuco alla milanese", "com risoto de açafrão", "R$ 96"], ["Saltimbocca alla romana", "vitela, presunto, sálvia", "R$ 88"]] },
      { nome: "Dolci", pratos: [["Tiramisù", "receita da casa", "R$ 34"], ["Panna cotta", "calda de frutas vermelhas", "R$ 30"], ["Cannoli siciliani", "ricota e pistache", "R$ 32"]] },
    ]),
    roughness: 0.85, side: THREE.FrontSide,
  }));
  verso.rotation.y = Math.PI;
  folhaCardapio.add(frente, verso);
  cardapio.add(folhaCardapio);
  const luzCardapio = new THREE.PointLight(0xfff0dc, 0.5, 3, 2);
  luzCardapio.position.set(-0.4, 0.6, 1.0);
  cardapio.add(luzCardapio);
  grupo.add(cardapio);
  const paginaVirada = { valor: 0 };
  animar.push((t) => {
    folhaCardapio.rotation.y = paginaVirada.valor * Math.PI + Math.sin(t * 0.7) * 0.06;
    folhaCardapio.position.y = Math.sin(t * 1.1) * 0.015;
    folhaCardapio.rotation.z = Math.sin(t * 0.5) * 0.02;
  });

  // neblina leve de rua
  return { grupo, cardapio, paginaVirada, animar };
}
