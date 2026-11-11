// Vida no salão: clientes conversando, garçom andando, comida com vapor,
// fiaschi pendurados e o som do salão (tudo em código, sem arquivos).
import * as THREE from "three";

export type Mesa = { x: number; z: number; luz: boolean; ocupada: [boolean, boolean] };

type Animavel = (tempo: number) => void;

const ALT_PISO = 0.15;

function capsula(r: number, comp: number, mat: THREE.Material) {
  return new THREE.Mesh(new THREE.CapsuleGeometry(r, comp, 6, 12), mat);
}

const ROUPAS = [0x6e2430, 0x2b3a55, 0xa5823a, 0x4f5b3a, 0xd9cdb8, 0x3c3c3c, 0x7a4b6a];
const PELES = [0xf0c8a8, 0xd9a47e, 0xb07a52, 0x8a5a3a, 0x5e3b25];
const CABELOS = [0x1d1612, 0x3b2a1e, 0x6b4a2b, 0x9c9c9c, 0x2a1c14];

let semente = 11;
const sorte = () => {
  semente = (semente * 16807) % 2147483647;
  return (semente - 1) / 2147483646;
};
const escolher = <T,>(lista: T[]) => lista[Math.floor(sorte() * lista.length)];

// Pessoa sentada, olhando para +Z (o motor gira para encarar a mesa)
function pessoaSentada(animar: Animavel[]) {
  const roupa = new THREE.MeshStandardMaterial({ color: escolher(ROUPAS), roughness: 0.85 });
  const calca = new THREE.MeshStandardMaterial({ color: escolher([0x23262e, 0x3a2f28, 0x2e3440]), roughness: 0.85 });
  const pele = new THREE.MeshStandardMaterial({ color: escolher(PELES), roughness: 0.6 });
  const cabelo = new THREE.MeshStandardMaterial({ color: escolher(CABELOS), roughness: 0.75 });
  const p = new THREE.Group();
  const corpo = new THREE.Group();
  corpo.position.y = 0.47;
  corpo.rotation.x = 0.12;
  p.add(corpo);
  const tronco = capsula(0.16, 0.3, roupa);
  tronco.position.y = 0.3;
  tronco.scale.set(1.15, 1, 0.8);
  corpo.add(tronco);
  const pescoco = capsula(0.045, 0.06, pele);
  pescoco.position.y = 0.58;
  corpo.add(pescoco);
  const cabeca = new THREE.Group();
  cabeca.position.y = 0.72;
  const rosto = new THREE.Mesh(new THREE.SphereGeometry(0.105, 20, 16), pele);
  rosto.scale.set(0.9, 1.08, 0.95);
  cabeca.add(rosto);
  const cab = new THREE.Mesh(new THREE.SphereGeometry(0.112, 20, 16, 0, Math.PI * 2, 0, Math.PI * (0.45 + sorte() * 0.2)), cabelo);
  cab.rotation.x = -0.35;
  cab.position.z = -0.01;
  cabeca.add(cab);
  corpo.add(cabeca);
  // braços: ombro → antebraço apoiado na mesa
  const bracos: THREE.Group[] = [];
  [-1, 1].forEach((lado) => {
    const ombro = new THREE.Group();
    ombro.position.set(lado * 0.2, 0.48, 0);
    const braco = capsula(0.045, 0.22, roupa);
    braco.position.y = -0.14;
    ombro.add(braco);
    const cotovelo = new THREE.Group();
    cotovelo.position.y = -0.27;
    const ante = capsula(0.04, 0.2, roupa);
    ante.position.y = -0.12;
    cotovelo.add(ante);
    const mao = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), pele);
    mao.position.y = -0.25;
    cotovelo.add(mao);
    cotovelo.rotation.x = -1.3;
    ombro.add(cotovelo);
    ombro.rotation.x = -0.35;
    ombro.rotation.z = lado * 0.12;
    corpo.add(ombro);
    bracos.push(ombro);
  });
  // pernas (coxas para a frente, canelas para baixo)
  [-1, 1].forEach((lado) => {
    const coxa = capsula(0.065, 0.3, calca);
    coxa.rotation.x = Math.PI / 2;
    coxa.position.set(lado * 0.1, 0.47, 0.2);
    const canela = capsula(0.055, 0.34, calca);
    canela.position.set(lado * 0.1, 0.23, 0.38);
    p.add(coxa, canela);
  });
  // animação: conversa (cabeça vira e acena), um braço gesticula de vez em quando
  const fase = sorte() * 10;
  const vel = 0.6 + sorte() * 0.5;
  animar.push((t) => {
    const tt = t * vel + fase;
    cabeca.rotation.y = Math.sin(tt * 0.7) * 0.35;
    cabeca.rotation.x = Math.sin(tt * 2.3) * 0.06 + 0.05;
    corpo.rotation.x = 0.12 + Math.sin(tt * 0.4) * 0.05;
    const gesto = Math.max(0, Math.sin(tt * 0.9)) ** 3;
    bracos[1].rotation.x = -0.35 - gesto * 0.9;
    bracos[1].rotation.z = 0.12 + gesto * 0.25;
    bracos[0].rotation.x = -0.35 - Math.max(0, Math.sin(tt * 0.6 + 2)) ** 4 * 0.5;
  });
  return p;
}

// Garçom em pé, de colete e avental, com bandeja
function garcom(animar: Animavel[], caminho: THREE.CatmullRomCurve3) {
  const branco = new THREE.MeshStandardMaterial({ color: 0xf2efe8, roughness: 0.8 });
  const preto = new THREE.MeshStandardMaterial({ color: 0x15161a, roughness: 0.7 });
  const pele = new THREE.MeshStandardMaterial({ color: 0xc8936b, roughness: 0.6 });
  const cabelo = new THREE.MeshStandardMaterial({ color: 0x1d1612, roughness: 0.7 });
  const g = new THREE.Group();
  const pernas: THREE.Group[] = [];
  [-1, 1].forEach((lado) => {
    const quadril = new THREE.Group();
    quadril.position.set(lado * 0.09, 0.92, 0);
    const perna = capsula(0.065, 0.72, preto);
    perna.position.y = -0.44;
    quadril.add(perna);
    const sapato = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.24), preto);
    sapato.position.set(0, -0.86, 0.05);
    quadril.add(sapato);
    g.add(quadril);
    pernas.push(quadril);
  });
  const tronco = capsula(0.17, 0.42, branco);
  tronco.position.y = 1.22;
  tronco.scale.set(1.1, 1, 0.75);
  g.add(tronco);
  const colete = capsula(0.175, 0.3, preto);
  colete.position.set(0, 1.2, 0.005);
  colete.scale.set(1.12, 1, 0.78);
  g.add(colete);
  const avental = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 0.62, 16, 1, true, -Math.PI / 2, Math.PI), branco);
  avental.position.set(0, 0.68, 0.02);
  avental.rotation.y = Math.PI;
  (avental.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
  g.add(avental);
  const cabeca = new THREE.Mesh(new THREE.SphereGeometry(0.105, 20, 16), pele);
  cabeca.scale.set(0.9, 1.08, 0.95);
  cabeca.position.y = 1.62;
  g.add(cabeca);
  const cab = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.45), cabelo);
  cab.position.y = 1.635;
  cab.rotation.x = -0.3;
  g.add(cab);
  // braço com a bandeja (dobrado, mão na altura do ombro)
  const ombroB = new THREE.Group();
  ombroB.position.set(0.22, 1.42, 0);
  const brB = capsula(0.045, 0.22, branco);
  brB.position.y = -0.14;
  ombroB.add(brB);
  const cotB = new THREE.Group();
  cotB.position.y = -0.28;
  cotB.rotation.x = -1.9;
  const anteB = capsula(0.04, 0.2, branco);
  anteB.position.y = -0.12;
  cotB.add(anteB);
  const bandeja = new THREE.Group();
  bandeja.position.set(0, -0.27, 0);
  bandeja.rotation.x = 1.9 - 0.15;
  bandeja.add(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.015, 28), new THREE.MeshStandardMaterial({ color: 0xc0c3c8, metalness: 1, roughness: 0.25 })));
  [-0.07, 0.07].forEach((x) => bandeja.add(taca(x, 0.008, 0.03)));
  cotB.add(bandeja);
  ombroB.add(cotB);
  ombroB.rotation.x = 0.3;
  g.add(ombroB);
  const ombroL = new THREE.Group();
  ombroL.position.set(-0.22, 1.42, 0);
  const brL = capsula(0.045, 0.5, branco);
  brL.position.y = -0.28;
  ombroL.add(brL);
  g.add(ombroL);

  const comprimento = caminho.getLength();
  const tangente = new THREE.Vector3();
  animar.push((t) => {
    const u = ((t * 0.55) / comprimento) % 1;
    const p = caminho.getPointAt(u);
    caminho.getTangentAt(u, tangente);
    g.position.set(p.x, ALT_PISO, p.z);
    g.rotation.y = Math.atan2(tangente.x, tangente.z);
    const passo = Math.sin(t * 5.2);
    pernas[0].rotation.x = passo * 0.42;
    pernas[1].rotation.x = -passo * 0.42;
    ombroL.rotation.x = -passo * 0.3;
    g.position.y = ALT_PISO + Math.abs(Math.cos(t * 5.2)) * 0.02;
  });
  return g;
}

// Taça de vinho com vinho dentro
function taca(x: number, y: number, z: number) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const vidro = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.18, roughness: 0.05, metalness: 0.1, depthWrite: false });
  const perfil = [[0, 0], [0.032, 0], [0.032, 0.004], [0.004, 0.008], [0.004, 0.07], [0.03, 0.09], [0.038, 0.13], [0.034, 0.17]] as [number, number][];
  g.add(new THREE.Mesh(new THREE.LatheGeometry(perfil.map(([r, h]) => new THREE.Vector2(r, h)), 20), vidro));
  const vinho = new THREE.Mesh(
    new THREE.LatheGeometry([[0, 0.078], [0.026, 0.09], [0.034, 0.115], [0, 0.115]].map(([r, h]) => new THREE.Vector2(r, h)), 20),
    new THREE.MeshStandardMaterial({ color: 0x4a0710, roughness: 0.1, transparent: true, opacity: 0.88 })
  );
  g.add(vinho);
  return g;
}

// Prato de espaguete ao sugo: um fio longo enrolado + molho + manjericão
function espaguete() {
  const g = new THREE.Group();
  const pts: THREE.Vector3[] = [];
  let a = 0;
  for (let i = 0; i < 260; i++) {
    a += 0.35 + sorte() * 0.25;
    const r = 0.025 + sorte() * 0.055;
    pts.push(new THREE.Vector3(Math.cos(a) * r, 0.012 + sorte() * 0.03 * (1 - r / 0.08), Math.sin(a) * r));
  }
  const fio = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 1400, 0.0028, 4, false),
    new THREE.MeshStandardMaterial({ color: 0xe9c77c, roughness: 0.55 })
  );
  g.add(fio);
  const molho = new THREE.Mesh(new THREE.SphereGeometry(0.035, 14, 10), new THREE.MeshStandardMaterial({ color: 0x8e1d10, roughness: 0.35 }));
  molho.scale.set(1, 0.4, 1);
  molho.position.y = 0.04;
  g.add(molho);
  const folha = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), new THREE.MeshStandardMaterial({ color: 0x2f6b2a, roughness: 0.6 }));
  folha.scale.set(1.6, 0.3, 0.9);
  folha.position.set(0.008, 0.055, 0.005);
  g.add(folha);
  return g;
}

function cestaDePao() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.06, 0.05, 16, 1, true), new THREE.MeshStandardMaterial({ color: 0x8a6136, roughness: 0.9, side: THREE.DoubleSide })));
  const pao = new THREE.MeshStandardMaterial({ color: 0xc89350, roughness: 0.85 });
  for (let i = 0; i < 4; i++) {
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), pao);
    p.scale.set(1.3, 0.75, 1);
    p.position.set((sorte() - 0.5) * 0.06, 0.03, (sorte() - 0.5) * 0.06);
    p.rotation.y = sorte() * 3;
    g.add(p);
  }
  return g;
}

// Vapor subindo do prato (partículas suaves)
function vapor(animar: Animavel[]) {
  const n = 26;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 3);
  const fase = new Float32Array(n);
  for (let i = 0; i < n; i++) fase[i] = sorte();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const gg = c.getContext("2d")!;
  const gr = gg.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, "rgba(255,255,255,0.8)");
  gr.addColorStop(1, "rgba(255,255,255,0)");
  gg.fillStyle = gr;
  gg.fillRect(0, 0, 64, 64);
  const mat = new THREE.PointsMaterial({ size: 0.06, map: new THREE.CanvasTexture(c), transparent: true, opacity: 0.22, depthWrite: false, color: 0xfff4e6 });
  const pts = new THREE.Points(geo, mat);
  pts.userData.semSombra = true;
  animar.push((t) => {
    for (let i = 0; i < n; i++) {
      const v = (t * 0.25 + fase[i]) % 1;
      pos[i * 3] = Math.sin(t * 1.3 + i) * 0.02 * (1 + v * 2);
      pos[i * 3 + 1] = 0.05 + v * 0.35;
      pos[i * 3 + 2] = Math.cos(t * 1.1 + i * 1.7) * 0.02 * (1 + v * 2);
    }
    geo.attributes.position.needsUpdate = true;
  });
  return pts;
}

// Fiasco (garrafa de Chianti com palha) pendurado na viga
function fiasco(animar: Animavel[]) {
  const g = new THREE.Group();
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 128;
  const gg = c.getContext("2d")!;
  gg.fillStyle = "#c9a663";
  gg.fillRect(0, 0, 128, 128);
  for (let y = 0; y < 128; y += 8) {
    for (let x = 0; x < 128; x += 8) {
      gg.fillStyle = (x + y) % 16 ? "#a8834a" : "#dcbc7c";
      gg.fillRect(x, y, 8, 4);
    }
  }
  const palha = new THREE.CanvasTexture(c);
  palha.colorSpace = THREE.SRGBColorSpace;
  palha.wrapS = palha.wrapT = THREE.RepeatWrapping;
  palha.repeat.set(4, 2);
  const bojo = new THREE.Mesh(new THREE.SphereGeometry(0.085, 20, 14, 0, Math.PI * 2, Math.PI * 0.35, Math.PI * 0.65), new THREE.MeshStandardMaterial({ map: palha, roughness: 0.95 }));
  bojo.position.y = -0.62;
  g.add(bojo);
  const gargalo = new THREE.Mesh(
    new THREE.LatheGeometry([[0, 0], [0.06, 0], [0.02, 0.09], [0.014, 0.2], [0.016, 0.21], [0, 0.21]].map(([r, h]) => new THREE.Vector2(r, h)), 16),
    new THREE.MeshStandardMaterial({ color: 0x2c4a22, roughness: 0.1, metalness: 0.3 })
  );
  gargalo.position.y = -0.58;
  g.add(gargalo);
  const cordao = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.38), new THREE.MeshStandardMaterial({ color: 0x6b5a3a }));
  cordao.position.y = -0.19;
  g.add(cordao);
  const f = sorte() * 6;
  animar.push((t) => {
    g.rotation.z = Math.sin(t * 0.9 + f) * 0.04;
    g.rotation.x = Math.sin(t * 0.7 + f * 1.3) * 0.03;
  });
  return g;
}

export function criarVida(grupo: THREE.Group, mesas: Mesa[]) {
  const animar: Animavel[] = [];
  const pratosQuentes: number[] = [];

  mesas.forEach((m, mi) => {
    m.ocupada.forEach((ocupado, lado) => {
      if (!ocupado) return;
      const a = lado === 0 ? 0 : Math.PI;
      const p = pessoaSentada(animar);
      p.position.set(m.x + Math.sin(a) * 0.85, ALT_PISO, m.z + Math.cos(a) * 0.85);
      p.rotation.y = a + Math.PI;
      grupo.add(p);
      // comida no prato desse lugar
      const pz = lado === 0 ? 0.25 : -0.25;
      const prato = espaguete();
      prato.position.set(m.x, ALT_PISO + 0.79, m.z + pz);
      grupo.add(prato);
      grupo.add(taca(m.x + 0.17, ALT_PISO + 0.775, m.z + pz * 0.7));
      if (pratosQuentes.length < 4 && (mi + lado) % 2 === 0) {
        const v = vapor(animar);
        v.position.copy(prato.position);
        grupo.add(v);
        pratosQuentes.push(mi);
      }
    });
    if (m.ocupada[0] || m.ocupada[1]) {
      const cesta = cestaDePao();
      cesta.position.set(m.x - 0.22, ALT_PISO + 0.79, m.z);
      grupo.add(cesta);
    }
  });

  // garçom dando a volta pelo salão (corredores entre as mesas)
  const caminho = new THREE.CatmullRomCurve3(
    [[-1.2, -1.2], [-1.2, -5.0], [-0.8, -7.2], [0.4, -9.2], [-2.2, -9.75], [-3.7, -8.6], [-3.7, -4.3], [-3.6, -1.3]].map(([x, z]) => new THREE.Vector3(x, 0, z)),
    true,
    "centripetal"
  );
  grupo.add(garcom(animar, caminho));

  // fiaschi pendurados nas vigas
  [[-3.1, -1.0], [-2.3, -1.0], [3.0, -2.4], [2.2, -2.4], [-3.0, -5.2], [3.1, -6.6], [-0.5, -9.4]].forEach(([x, z]) => {
    const f = fiasco(animar);
    f.position.set(x, 3.53, z);
    grupo.add(f);
  });

  return { animar };
}

// Som do salão: burburinho (ruído filtrado com volume oscilando) + tilintar de taças
export class SomDoSalao {
  private ctx: AudioContext | null = null;
  private geral: GainNode | null = null;
  private proximo = 0;
  ligado = false;

  alternar() {
    if (!this.ctx) this.criar();
    this.ligado = !this.ligado;
    if (this.ctx!.state === "suspended") this.ctx!.resume();
    return this.ligado;
  }

  private criar() {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    this.ctx = ctx;
    this.geral = ctx.createGain();
    this.geral.gain.value = 0;
    this.geral.connect(ctx.destination);
    // ruído rosa aproximado
    const dur = 4;
    const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < d.length; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.997 * b0 + w * 0.029591;
      b1 = 0.985 * b1 + w * 0.032534;
      b2 = 0.95 * b2 + w * 0.048056;
      d[i] = (b0 + b1 + b2 + w * 0.05) * 0.6;
    }
    // três "vozes" de burburinho, cada uma com filtro e volume oscilando
    [420, 680, 1050].forEach((freq, i) => {
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      src.playbackRate.value = 0.9 + i * 0.07;
      const f = ctx.createBiquadFilter();
      f.type = "bandpass";
      f.frequency.value = freq;
      f.Q.value = 1.2;
      const g = ctx.createGain();
      g.gain.value = 0.25;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.3 + i * 0.17;
      const lfoG = ctx.createGain();
      lfoG.gain.value = 0.12;
      lfo.connect(lfoG).connect(g.gain);
      src.connect(f).connect(g).connect(this.geral!);
      src.start(ctx.currentTime + i * 0.37);
      lfo.start();
    });
  }

  // chamado a cada quadro; "dentro" (0..1) deixa o som mais alto dentro do salão
  atualizar(dentro: number) {
    if (!this.ctx || !this.geral) return;
    const alvo = this.ligado ? 0.06 + dentro * 0.22 : 0;
    this.geral.gain.setTargetAtTime(alvo, this.ctx.currentTime, 0.4);
    if (this.ligado && this.ctx.currentTime > this.proximo) {
      this.proximo = this.ctx.currentTime + 1.5 + Math.random() * 3.5;
      this.tilintar(0.05 + dentro * 0.1);
    }
  }

  private tilintar(volume: number) {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    [1, 2.76].forEach((mult, i) => {
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = (2400 + Math.random() * 900) * mult;
      const g = ctx.createGain();
      g.gain.setValueAtTime(volume / (i + 1), t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
      o.connect(g).connect(this.geral!);
      o.start(t);
      o.stop(t + 1);
    });
  }
}
