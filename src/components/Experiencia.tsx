"use client";

// A página: canvas fixo atrás, a história em 6 seções na frente. A rolagem
// leva a câmera pela rua até o salão; os textos aparecem pela posição da rolagem.
import { useEffect, useRef, useState } from "react";
import { Motor, MARCACOES } from "@/trattoria/motor";

// Tenta a versão completa; se o aparelho não aguentar, a leve; se nem assim, avisa.
function criarMotor(canvas: HTMLCanvasElement, aoFicarPronto: () => void): Motor | null {
  for (const qualidade of ["completa", "leve"] as const) {
    try {
      return new Motor(canvas, { aoFicarPronto }, qualidade);
    } catch (e) {
      console.warn(`Não abriu na qualidade ${qualidade}:`, e);
    }
  }
  return null;
}

const SECOES = [
  { id: "rua", kicker: "São Paulo · desde 1958", titulo: "Trattoria Il Tinello", texto: "Massa fresca, molho de domingo e mesa comprida. Role para entrar." },
  { id: "fachada", kicker: "01 · A esquina", titulo: "Entre. Fique mais um pouco.", texto: "Toldo listrado, oliveiras na porta e o cheiro de manjericão chegando na calçada." },
  { id: "porta", kicker: "02 · A porta", titulo: "A casa é sua.", texto: "Aqui ninguém tem pressa. A massa é aberta à mão toda manhã." },
  { id: "salao", kicker: "03 · O salão", titulo: "Benvenuti.", texto: "Toalha xadrez, luz baixa, vinho da casa e conversa alta. Do jeito que a nonna fazia." },
  { id: "cardapio", kicker: "04 · O cardápio", titulo: "Il menù.", texto: "Clássicos romanos e do norte, com ingredientes de pequenos produtores." },
  { id: "reserva", kicker: "05 · Reservas", titulo: "Aperto.", texto: "" },
];

export default function Experiencia() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const motorRef = useRef<Motor | null>(null);
  const secoesRef = useRef<(HTMLElement | null)[]>([]);
  const [pronto, setPronto] = useState(false);
  const [modoFoto, setModoFoto] = useState(false);
  const [somLigado, setSomLigado] = useState(false);
  const [sem3d, setSem3d] = useState(false);

  useEffect(() => {
    if (!canvasRef.current) return;
    const motor = criarMotor(canvasRef.current, () => setPronto(true));
    if (!motor) {
      // sem 3D: mostra todos os textos (normalmente eles aparecem com a rolagem do 3D)
      setSem3d(true);
      setPronto(true);
      secoesRef.current.forEach((s) => {
        const bloco = s?.querySelector<HTMLElement>(".revelar");
        if (bloco) {
          bloco.style.opacity = "1";
          bloco.style.transform = "none";
        }
      });
      return;
    }
    motorRef.current = motor;
    const n = MARCACOES.length - 1;

    const foto = new URLSearchParams(window.location.search);
    if (foto.has("p")) {
      // ?p=0..5 : modo foto, vai direto para uma marcação
      setPronto(true);
      setModoFoto(true);
      motor.foto(Number(foto.get("p")) / n);
      if (foto.get("virar") === "1") motor.virarPagina();
      return () => motor.destruir();
    }

    const aoRolar = () => {
      const meio = window.scrollY + window.innerHeight / 2;
      const centros = secoesRef.current.map((s) => (s ? s.offsetTop + s.offsetHeight / 2 : 0));
      let p = 0;
      for (let i = 0; i < centros.length - 1; i++) {
        if (meio >= centros[i]) p = i + Math.min(1, (meio - centros[i]) / (centros[i + 1] - centros[i]));
      }
      motor.setProgresso(p / n);
      secoesRef.current.forEach((s, i) => {
        const bloco = s?.querySelector<HTMLElement>(".revelar");
        if (!bloco) return;
        const v = Math.max(0, 1 - Math.abs(p - i) * 1.6);
        bloco.style.opacity = String(v);
        bloco.style.transform = `translateY(${(1 - v) * 24}px)`;
      });
    };
    aoRolar();
    window.addEventListener("scroll", aoRolar, { passive: true });
    window.addEventListener("resize", aoRolar);
    return () => {
      window.removeEventListener("scroll", aoRolar);
      window.removeEventListener("resize", aoRolar);
      motor.destruir();
    };
  }, []);

  return (
    <div className="pagina relative">
      <canvas ref={canvasRef} className="fixed inset-0 h-screen w-screen" />
      <div className="pointer-events-none fixed inset-0 bg-gradient-to-r from-black/55 via-black/10 to-transparent" />
      {sem3d && (
        <div className="fixed inset-0 flex items-end justify-end p-6 text-right">
          <p className="max-w-xs rounded-xl bg-black/50 p-4 font-serif text-sm italic text-[#e9dccb]">
            Seu navegador não conseguiu abrir o 3D. Tente atualizar a página ou ativar a aceleração de hardware nas configurações do navegador.
          </p>
        </div>
      )}

      <div
        className={`fixed inset-0 z-30 flex items-center justify-center bg-[#070a12] transition-opacity duration-700 ${pronto ? "pointer-events-none opacity-0" : "opacity-100"} ${modoFoto ? "hidden" : ""}`}
      >
        <span className="font-serif text-lg italic tracking-wide text-[#f2e3c2]">acendendo as luzes…</span>
      </div>

      <main className="relative z-10">
        {SECOES.map((s, i) => (
          <section
            key={s.id}
            id={s.id}
            ref={(el) => {
              secoesRef.current[i] = el;
            }}
            className={`flex items-center px-6 md:px-16 ${i === 0 ? "min-h-[110vh]" : "min-h-[140vh]"}`}
          >
            <div className="revelar max-w-md">
              <p className="mb-3 font-mono text-[11px] tracking-[0.25em] text-[#e7b9a1] uppercase">{s.kicker}</p>
              <h2 className={`mb-4 font-serif leading-tight text-[#f7ecd8] ${i === 0 ? "text-5xl italic md:text-7xl" : "text-4xl md:text-5xl"}`}>{s.titulo}</h2>
              {s.texto && <p className="text-base leading-relaxed text-[#e9dccb]">{s.texto}</p>}

              {s.id === "salao" && (
                <button
                  onClick={() => setSomLigado(motorRef.current?.alternarSom() ?? false)}
                  className="mt-8 rounded-full border border-[#f2e3c2]/40 bg-black/30 px-6 py-3 font-mono text-xs tracking-[0.2em] text-[#f7ecd8] uppercase backdrop-blur"
                >
                  {somLigado ? "Desligar o som do salão" : "Ouvir o salão"}
                </button>
              )}

              {s.id === "cardapio" && (
                <button
                  onClick={() => motorRef.current?.virarPagina()}
                  className="mt-8 rounded-full border border-[#f2e3c2]/40 bg-black/30 px-6 py-3 font-mono text-xs tracking-[0.2em] text-[#f7ecd8] uppercase backdrop-blur"
                >
                  Virar a página
                </button>
              )}

              {s.id === "reserva" && (
                <div className="space-y-5 text-[#e9dccb]">
                  <div>
                    <p className="font-serif text-xl text-[#f7ecd8]">Terça a domingo</p>
                    <p>Almoço 12h às 15h · Jantar 19h às 23h30</p>
                  </div>
                  <div>
                    <p className="font-serif text-xl text-[#f7ecd8]">Rua Fictícia, 123 · Bixiga</p>
                    <p>São Paulo, SP</p>
                  </div>
                  <p>Mesas para 2 a 8 pessoas. Para grupos maiores, fale com a gente.</p>
                  <a
                    href="#reserva"
                    className="inline-block rounded-full bg-[#9e1b1f] px-7 py-3 font-mono text-xs tracking-[0.2em] text-[#f7ecd8] uppercase"
                  >
                    Reservar pelo WhatsApp
                  </a>
                  <p className="pt-10 font-serif text-sm italic text-[#bfae97]">
                    Restaurante fictício · projeto de estudo de Samuel Rogério em Next.js e three.js
                  </p>
                </div>
              )}
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}
