// Motor: a rolagem leva a câmera por um caminho (rua → fachada → porta →
// salão → cardápio → visão do salão). Um relógio só move tudo que anima.
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { FilmPass } from "three/examples/jsm/postprocessing/FilmPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { GTAOPass } from "three/examples/jsm/postprocessing/GTAOPass.js";
import { BokehPass } from "three/examples/jsm/postprocessing/BokehPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { VignetteShader } from "three/examples/jsm/shaders/VignetteShader.js";
import { Reflector } from "three/examples/jsm/objects/Reflector.js";
import { criarCenario, type Cenario } from "./cena";
import { SomDoSalao } from "./vida";
import { mascaraPocas, pedras } from "./texturas";

// Espelho só onde há poça: a máscara diz onde tem água e o relevo das pedras
// ondula um pouco o reflexo
const ShaderPoca = {
  name: "ShaderPoca",
  uniforms: {
    color: { value: null },
    tDiffuse: { value: null },
    textureMatrix: { value: null },
    mascara: { value: null },
    relevo: { value: null },
  },
  vertexShader: `
    uniform mat4 textureMatrix;
    varying vec4 vUv;
    varying vec2 vMundo;
    void main() {
      vUv = textureMatrix * vec4(position, 1.0);
      vMundo = (modelMatrix * vec4(position, 1.0)).xz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: `
    uniform vec3 color;
    uniform sampler2D tDiffuse;
    uniform sampler2D mascara;
    uniform sampler2D relevo;
    varying vec4 vUv;
    varying vec2 vMundo;
    void main() {
      float agua = texture2D(mascara, vMundo / 22.0).r;
      float pedra = texture2D(relevo, vMundo / 3.0).r;
      // fora da poça, só um brilho fraco de pedra molhada; dentro, espelho
      float forca = mix(0.12 * (1.0 - pedra), 0.85, smoothstep(0.15, 0.7, agua));
      vec4 uv = vUv;
      uv.xy += (pedra - 0.5) * 0.035 * (1.0 - agua * 0.8) * uv.w;
      vec3 refl = texture2DProj(tDiffuse, uv).rgb;
      gl_FragColor = vec4(refl * color, forca);
    }`,
};

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
  private ao: GTAOPass | null = null;
  private dof: BokehPass;
  private espelho: Reflector;
  private som = new SomDoSalao();
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
    // sombras suaves das lâmpadas
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.cena.background = new THREE.Color(0x070a12);
    this.cena.fog = new THREE.FogExp2(0x0b0f1a, 0.022);
    this.montarNoite();

    this.cenario = criarCenario();
    this.cena.add(this.cenario.grupo);
    const celular = window.innerWidth < 768;
    this.cenario.grupo.traverse((o) => {
      if (o instanceof THREE.Mesh && !o.userData.semSombra) {
        const m = o.material as THREE.Material;
        const brilha = m instanceof THREE.MeshBasicMaterial || m instanceof THREE.ShaderMaterial || m.transparent;
        o.castShadow = !brilha;
        o.receiveShadow = !brilha;
      }
      if (o instanceof THREE.SpotLight && o.userData.sombra) {
        o.shadow.mapSize.set(celular ? 512 : 1024, celular ? 512 : 1024);
        o.shadow.bias = -0.0008;
        o.shadow.radius = 4;
      }
    });

    // reflexo espelhado nas poças (renderiza a cena espelhada em meia resolução)
    const meia = Math.min(window.devicePixelRatio, 1.5) * 0.5;
    this.espelho = new Reflector(new THREE.PlaneGeometry(40, 40), {
      textureWidth: Math.round(window.innerWidth * meia),
      textureHeight: Math.round(window.innerHeight * meia),
      color: 0xb8b0a6,
      clipBias: 0.003,
      shader: ShaderPoca,
      multisample: 0,
    });
    const matEspelho = this.espelho.material as THREE.ShaderMaterial;
    matEspelho.transparent = true;
    matEspelho.depthWrite = false;
    const texMascara = mascaraPocas();
    const texRelevo = pedras().bump;
    texRelevo.repeat.set(1, 1);
    matEspelho.uniforms.mascara.value = texMascara;
    matEspelho.uniforms.relevo.value = texRelevo;
    this.espelho.rotation.x = -Math.PI / 2;
    this.espelho.position.set(0, 0.004, 14.35);
    this.espelho.userData.semSombra = true;
    this.cena.add(this.espelho);

    this.caminho = new THREE.CatmullRomCurve3(MARCACOES.map((m) => new THREE.Vector3(...m.pos)), false, "centripetal");
    this.alvos = new THREE.CatmullRomCurve3(MARCACOES.map((m) => new THREE.Vector3(...m.alvo)), false, "centripetal");

    const alvoRender = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(this.renderer, alvoRender);
    this.composer.addPass(new RenderPass(this.cena, this.camera));
    // oclusão de ambiente: cantos, pés de mesa e frestas escurecem (só no computador)
    if (!celular) {
      this.ao = new GTAOPass(this.cena, this.camera, 512, 512);
      this.ao.updateGtaoMaterial({ radius: 0.35, distanceExponent: 1.2, thickness: 1, scale: 1.2 });
      this.ao.blendIntensity = 0.85;
      this.composer.addPass(this.ao);
    }
    // desfoque de lente no cardápio (o fundo fica fora de foco, como foto)
    this.dof = new BokehPass(this.cena, this.camera, { focus: 1, aperture: 0, maxblur: 0.008 });
    this.dof.enabled = false;
    this.composer.addPass(this.dof);
    // aqui o bloom é bem-vindo: as lâmpadas devem brilhar
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.45, 0.35, 1.6);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new FilmPass(0.25, false));
    const vinheta = new ShaderPass(VignetteShader);
    vinheta.uniforms.offset.value = 1.0;
    vinheta.uniforms.darkness.value = 1.0; // mistura com preto (acima de 1 vira cor negativa)
    this.composer.addPass(vinheta);
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
  alternarSom() {
    return this.som.alternar();
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
    // foco no cardápio quando a câmera chega perto dele
    const focoCardapio = suave((pertoCardapio - 0.35) / 0.65);
    this.dof.enabled = focoCardapio > 0.02;
    if (this.dof.enabled) {
      const u = this.dof.uniforms as Record<string, { value: number }>;
      u.focus.value = pos.distanceTo(this.cenario.cardapio.position);
      u.aperture.value = 0.0045 * focoCardapio;
    }
    // fov interpolado entre as marcações
    const seg = t * (MARCACOES.length - 1);
    const i = Math.min(MARCACOES.length - 2, Math.floor(seg));
    const f = suave(seg - i);
    this.camera.fov = MARCACOES[i].fov + (MARCACOES[i + 1].fov - MARCACOES[i].fov) * f;
    this.camera.updateProjectionMatrix();

    // neblina mais densa na rua, quase nenhuma dentro
    const dentro = suave((-pos.z + 0.5) / 2);
    (this.cena.fog as THREE.FogExp2).density = 0.022 * (1 - dentro) + 0.006 * dentro;
    // dentro do salão o espelho da rua não aparece: desliga e economiza um render
    this.espelho.visible = pos.z > -1.5;
    this.som.atualizar(dentro);

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
      } else if (fps < 40 && this.ao && this.ao.enabled) {
        this.ao.enabled = false; // o mais pesado sai primeiro
      } else if (fps < 40 && this.bloom.enabled) {
        this.bloom.enabled = false;
      }
      this.quadros = 0;
      this.janelaFps = 0;
    }
  }
}
