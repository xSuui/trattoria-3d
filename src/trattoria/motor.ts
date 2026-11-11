// Motor: a rolagem leva a câmera por um caminho (rua → fachada → porta →
// salão → cardápio → visão do salão). Um relógio só move tudo que anima.
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { FilmPass } from "three/examples/jsm/postprocessing/FilmPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { criarCenario, type Cenario } from "./cena";

// Marcações do caminho: onde a câmera está e para onde olha
type Marcacao = { pos: [number, number, number]; alvo: [number, number, number]; fov: number };
export const MARCACOES: Marcacao[] = [
  { pos: [0.6, 1.7, 15], alvo: [0, 2.6, 0], fov: 42 }, // a rua
  { pos: [-2.6, 1.55, 5.2], alvo: [0.6, 2.4, 0], fov: 46 }, // a fachada
  { pos: [0, 1.55, 1.6], alvo: [0, 1.5, -3], fov: 52 }, // a porta
  { pos: [0.2, 1.6, -1.6], alvo: [0.2, 1.9, -6], fov: 55 }, // o salão (Benvenuti)
  { pos: [1.55, 1.3, -6.05], alvo: [1.55, 1.28, -6.95], fov: 45 }, // o cardápio
  { pos: [3.6, 2.6, -1.4], alvo: [-0.6, 0.9, -7], fov: 50 }, // visão do salão (reservas)
];

const suave = (t: number) => {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
};

type Eventos = { aoFicarPronto?: () => void };

export class Motor {
  private renderer: THREE.WebGLRenderer;
  private cena = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(45, 1, 0.05, 200);
  private composer: EffectComposer;
  private bloom: UnrealBloomPass;
  private cenario: Cenario;
  private caminho: THREE.CatmullRomCurve3;
  private alvos: THREE.CatmullRomCurve3;
  private raf = 0;
  private ultimo = performance.now();
  private tempo = 0;
  private progresso = 0;
  private progressoSuave = 0;
  private fixo = false;
  private mouse = new THREE.Vector2();
  private mouseSuave = new THREE.Vector2();
  private virarAlvo = 0;
  private pixelRatio: number;
  private quadros = 0;
  private janelaFps = 0;

  constructor(private canvas: HTMLCanvasElement, private eventos: Eventos = {}) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
    this.pixelRatio = Math.min(window.devicePixelRatio, window.innerWidth < 768 ? 1.5 : 1.75);
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.95;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.cena.background = new THREE.Color(0x070a12);
    this.cena.fog = new THREE.FogExp2(0x0b0f1a, 0.022);
    this.montarNoite();

    this.cenario = criarCenario();
    this.cena.add(this.cenario.grupo);

    this.caminho = new THREE.CatmullRomCurve3(MARCACOES.map((m) => new THREE.Vector3(...m.pos)), false, "centripetal");
    this.alvos = new THREE.CatmullRomCurve3(MARCACOES.map((m) => new THREE.Vector3(...m.alvo)), false, "centripetal");

    const alvoRender = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(this.renderer, alvoRender);
    this.composer.addPass(new RenderPass(this.cena, this.camera));
    // aqui o bloom é bem-vindo: as lâmpadas devem brilhar
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.45, 0.35, 1.6);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new FilmPass(0.25, false));
    this.composer.addPass(new OutputPass());

    this.redimensionar();
    window.addEventListener("resize", this.redimensionar);
    window.addEventListener("pointermove", this.aoMover);
    this.renderer.compileAsync(this.cena, this.camera).then(() => this.eventos.aoFicarPronto?.());
    this.raf = requestAnimationFrame(this.quadro);
  }

  // Céu noturno + janelas quentes viram o ambiente refletido nas pedras molhadas
  private montarNoite() {
    const ceu = new THREE.Scene();
    const cupula = new THREE.Mesh(
      new THREE.SphereGeometry(20, 32, 16),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        uniforms: {},
        vertexShader: "varying vec3 p; void main(){ p = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
        fragmentShader:
          "varying vec3 p; void main(){ float h = normalize(p).y; vec3 c = mix(vec3(0.05,0.035,0.03), vec3(0.03,0.05,0.12), smoothstep(-0.2,0.6,h)); gl_FragColor = vec4(c,1.0); }",
      })
    );
    ceu.add(cupula);
    const quente = (w: number, h: number, i: number, x: number, y: number, z: number) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffa25a).multiplyScalar(i), side: THREE.DoubleSide }));
      m.position.set(x, y, z);
      m.lookAt(0, 0, 0);
      ceu.add(m);
    };
    quente(8, 2, 3, 0, 2, -12);
    quente(3, 1.2, 2, -10, 3, 4);
    quente(3, 1.2, 2, 10, 3, 6);
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.cena.environment = pmrem.fromScene(ceu, 0.04).texture;
    this.cena.environmentIntensity = 0.5;
    pmrem.dispose();
    this.cena.add(new THREE.HemisphereLight(0x22304f, 0x120c08, 0.35));
    const lua = new THREE.DirectionalLight(0x8fa6d6, 0.35);
    lua.position.set(-6, 12, 10);
    this.cena.add(lua);
  }

  // ---- API da página ----
  setProgresso(p: number) {
    this.progresso = Math.min(1, Math.max(0, p));
  }
  foto(p: number) {
    this.setProgresso(p);
    this.progressoSuave = this.progresso;
    this.fixo = true;
  }
  virarPagina() {
    this.virarAlvo = this.virarAlvo ? 0 : 1;
  }
  destruir() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener("resize", this.redimensionar);
    window.removeEventListener("pointermove", this.aoMover);
    this.composer.dispose();
    this.renderer.dispose();
  }

  private aoMover = (e: PointerEvent) => {
    this.mouse.set((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
  };

  private redimensionar = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.composer.setPixelRatio(this.pixelRatio);
    this.composer.setSize(w, h);
  };

  private quadro = (agora: number) => {
    this.raf = requestAnimationFrame(this.quadro);
    const dt = Math.min(0.05, (agora - this.ultimo) / 1000);
    this.ultimo = agora;
    this.tempo += dt;

    const k = this.fixo ? 1 : 1 - Math.exp(-dt * 3);
    this.progressoSuave += (this.progresso - this.progressoSuave) * k;
    this.mouseSuave.lerp(this.mouse, 1 - Math.exp(-dt * 2.5));

    // posição no caminho
    const t = this.progressoSuave;
    const pos = this.caminho.getPoint(t);
    const alvo = this.alvos.getPoint(t);
    // olhar do visitante: o mouse desvia um pouco a cabeça
    alvo.x += this.mouseSuave.x * 0.35;
    alvo.y -= this.mouseSuave.y * 0.2;
    // no celular em pé, recua um pouco no cardápio para caber a folha inteira
    const iCard = 4 / (MARCACOES.length - 1);
    const pertoCardapio = 1 - Math.min(1, Math.abs(t - iCard) / (1 / (MARCACOES.length - 1)));
    if (this.camera.aspect < 0.9) {
      const recuo = (0.9 / this.camera.aspect - 1) * 0.75 * suave(pertoCardapio);
      pos.add(pos.clone().sub(alvo).normalize().multiplyScalar(recuo));
    }
    this.camera.position.copy(pos);
    this.camera.lookAt(alvo);
    // fov interpolado entre as marcações
    const seg = t * (MARCACOES.length - 1);
    const i = Math.min(MARCACOES.length - 2, Math.floor(seg));
    const f = suave(seg - i);
    this.camera.fov = MARCACOES[i].fov + (MARCACOES[i + 1].fov - MARCACOES[i].fov) * f;
    this.camera.updateProjectionMatrix();

    // neblina mais densa na rua, quase nenhuma dentro
    const dentro = suave((-pos.z + 0.5) / 2);
    (this.cena.fog as THREE.FogExp2).density = 0.022 * (1 - dentro) + 0.006 * dentro;

    // página do cardápio (vira suave)
    const pv = this.cenario.paginaVirada;
    pv.valor += (this.virarAlvo - pv.valor) * (1 - Math.exp(-dt * 5));
    this.cenario.animar.forEach((fn) => fn(this.tempo));

    this.composer.render(dt);
    this.medirFps(dt);
  };

  private medirFps(dt: number) {
    this.quadros++;
    this.janelaFps += dt;
    if (this.janelaFps >= 2) {
      const fps = this.quadros / this.janelaFps;
      if (fps < 40 && this.pixelRatio > 1) {
        this.pixelRatio = Math.max(1, this.pixelRatio - 0.25);
        this.renderer.setPixelRatio(this.pixelRatio);
        this.redimensionar();
      } else if (fps < 40 && this.bloom.enabled) {
        this.bloom.enabled = false;
      }
      this.quadros = 0;
      this.janelaFps = 0;
    }
  }
}
