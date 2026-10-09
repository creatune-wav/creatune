import React from "react";
import { AbsoluteFill, Audio, Sequence, interpolate, spring, random,
  staticFile, useCurrentFrame, useVideoConfig, continueRender, delayRender, Easing } from "remotion";

// psikofutbol: maç görüntüsü kullanmayan, animasyonlu anlatım Shorts'ları (Türkçe)
type Word = { t: number; w: string };
export type Scene = { kind: string; vo: string; frames: number; words: Word[] };
export type PsikoData = { slug: string; scenes: Scene[] };
export const psikoFrames = (d: PsikoData) => d.scenes.reduce((s, x) => s + x.frames, 0);

const FPS = 30;
const fonts = [
  new FontFace("Anton", `url(${staticFile("fonts/Anton.woff2")})`),
  // Anton.woff2 alt kümesinde Ğ, Ş, İ yok; latin-ext'ten tamamlanır
  new FontFace("Anton", `url(${staticFile("fonts/Anton-ext.woff2")})`, { unicodeRange: "U+0100-0130, U+0132-024F" }),
];
const h = delayRender("font");
Promise.all(fonts.map((f) => f.load())).then((l) => { l.forEach((f) => document.fonts.add(f)); continueRender(h); });

const YELLOW = "#FFD400", RED = "#FF3B3B", GREEN = "#2BD46B", WHITE = "#EEF2FA";
const up = (s: string) => s.toLocaleUpperCase("tr-TR");
const txt = (w: number): React.CSSProperties => ({
  WebkitTextStroke: `${w}px #000`, paintOrder: "stroke fill", fontFamily: "Anton",
  textShadow: "0 4px 14px rgba(0,0,0,.5)", letterSpacing: 0.5,
});
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const pop = (f: number, at: number, stiffness = 190) => spring({ frame: f - at, fps: FPS, config: { damping: 11, stiffness } });
// sahnedeki bir kelimenin söylendiği kare (önek eşleşmesi)
const cue = (words: Word[], prefix: string, nth = 0) => {
  const m = words.filter((x) => up(x.w).startsWith(up(prefix)));
  return m.length ? Math.round(m[Math.min(nth, m.length - 1)].t * FPS) : 0;
};

// ---------- çizim parçaları ----------
const Keeper: React.FC<{ x: number; y: number; s?: number; dive?: number; spread?: number; color?: string; glove?: string; arms?: "up" | "front" }> =
  ({ x, y, s = 1, dive = 0, spread = 1, color = WHITE, glove = YELLOW, arms = "up" }) => {
  // dive: -1 sola tam uçuş, +1 sağa; ağırlık merkezi etrafında döner, yana ve biraz yukarı kayar
  const a = dive * 72, dx = dive * 210 * spread, dy = (-Math.sin(Math.abs(dive) * Math.PI) * 60 - Math.abs(dive) * 20) * spread;
  const hand = arms === "up" ? [[-92, -258], [92, -258]] : [[-40, -150], [40, -150]];
  return (
    <g transform={`translate(${x} ${y}) scale(${s}) translate(${dx} ${dy}) rotate(${a} 0 -130)`}>
      <line x1={-12} y1={-110} x2={-38} y2={0} stroke={color} strokeWidth={24} strokeLinecap="round" />
      <line x1={12} y1={-110} x2={38} y2={0} stroke={color} strokeWidth={24} strokeLinecap="round" />
      <rect x={-40} y={-212} width={80} height={112} rx={28} fill={color} />
      <line x1={-30} y1={-196} x2={hand[0][0]} y2={hand[0][1]} stroke={color} strokeWidth={20} strokeLinecap="round" />
      <line x1={30} y1={-196} x2={hand[1][0]} y2={hand[1][1]} stroke={color} strokeWidth={20} strokeLinecap="round" />
      <circle cx={hand[0][0]} cy={hand[0][1]} r={17} fill={glove} />
      <circle cx={hand[1][0]} cy={hand[1][1]} r={17} fill={glove} />
      <circle cx={0} cy={-248} r={31} fill={color} />
    </g>
  );
};

const Goal: React.FC<{ x: number; y: number; w: number; hgt: number; bulge?: { x: number; k: number } }> = ({ x, y, w, hgt, bulge }) => {
  const lines: React.ReactNode[] = [];
  const step = 34;
  for (let i = step; i < w; i += step) {
    const b = bulge ? Math.exp(-(((i - bulge.x) / 70) ** 2)) * bulge.k : 0;
    lines.push(<line key={"v" + i} x1={x + i} y1={y} x2={x + i + b * 0.3} y2={y + hgt} stroke="#fff" strokeOpacity={0.16} strokeWidth={2} />);
  }
  for (let j = step; j < hgt; j += step)
    lines.push(<line key={"h" + j} x1={x} y1={y + j} x2={x + w} y2={y + j} stroke="#fff" strokeOpacity={0.16} strokeWidth={2} />);
  return (
    <g>
      <rect x={x} y={y} width={w} height={hgt} fill="rgba(255,255,255,.04)" />
      {lines}
      <path d={`M${x} ${y + hgt} V${y} H${x + w} V${y + hgt}`} fill="none" stroke="#fff" strokeWidth={16} strokeLinejoin="round" />
      <line x1={x - 160} y1={y + hgt + 8} x2={x + w + 160} y2={y + hgt + 8} stroke="#fff" strokeOpacity={0.5} strokeWidth={5} />
    </g>
  );
};

const Ball: React.FC<{ x: number; y: number; r: number; spin?: number }> = ({ x, y, r, spin = 0 }) => (
  <g transform={`translate(${x} ${y}) rotate(${spin})`}>
    <circle r={r} fill="#fff" stroke="#111" strokeWidth={r * 0.08} />
    <polygon fill="#111" points={[0, 1, 2, 3, 4].map((i) => {
      const a = (i * 72 - 90) * Math.PI / 180; return `${Math.cos(a) * r * 0.38},${Math.sin(a) * r * 0.38}`; }).join(" ")} />
    {[0, 1, 2, 3, 4].map((i) => {
      const a = (i * 72 - 90) * Math.PI / 180;
      return <line key={i} x1={Math.cos(a) * r * 0.38} y1={Math.sin(a) * r * 0.38} x2={Math.cos(a) * r * 0.95} y2={Math.sin(a) * r * 0.95} stroke="#111" strokeWidth={r * 0.07} />;
    })}
  </g>
);

// topu penaltı noktasından kaledeki hedefe uçurur
const shot = (f: number, at: number, len: number, from: [number, number, number], to: [number, number, number]) => {
  const p = interpolate(f, [at, at + len], [0, 1], { ...clamp, easing: Easing.in(Easing.quad) });
  return { x: from[0] + (to[0] - from[0]) * p, y: from[1] + (to[1] - from[1]) * p - Math.sin(p * Math.PI) * 60, r: from[2] + (to[2] - from[2]) * p, p };
};

const Headline: React.FC<{ lines: { t: string; at: number; color?: string; size?: number }[]; top?: number }> = ({ lines, top = 190 }) => {
  const f = useCurrentFrame();
  return (
    <div style={{ position: "absolute", top, width: "100%", textAlign: "center", lineHeight: 1.05 }}>
      {lines.map((l, i) => f >= l.at && (
        <div key={i} style={{ ...txt(l.size && l.size > 90 ? 10 : 8), fontSize: l.size ?? 84, color: l.color ?? "#fff",
          transform: `scale(${pop(f, l.at)})` }}>{up(l.t)}</div>
      ))}
    </div>
  );
};

const Stamp: React.FC<{ text: string; at: number; color: string; x: number; y: number; rot?: number; size?: number }> = ({ text, at, color, x, y, rot = -8, size = 92 }) => {
  const f = useCurrentFrame();
  if (f < at) return null;
  const s = interpolate(f - at, [0, 5], [2.2, 1], { ...clamp, easing: Easing.out(Easing.back(2)) });
  return (
    <div style={{ position: "absolute", left: x, top: y, transform: `translate(-50%,-50%) rotate(${rot}deg) scale(${s})`,
      border: `8px solid ${color}`, borderRadius: 18, padding: "4px 28px", background: "rgba(0,0,0,.55)",
      opacity: interpolate(f - at, [0, 3], [0, 1], clamp) }}>
      <span style={{ fontFamily: "Anton", fontSize: size, color, letterSpacing: 2 }}>{up(text)}</span>
    </div>
  );
};

const Svg: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <svg width={1080} height={1920} viewBox="0 0 1080 1920" style={{ position: "absolute", inset: 0 }}>{children}</svg>
);
const Sfx: React.FC<{ at: number; src: string; v?: number }> = ({ at, src, v = 0.6 }) => (
  <Sequence from={Math.max(0, at)}><Audio src={staticFile(`sfx/${src}.wav`)} volume={v} /></Sequence>
);
const Source: React.FC = () => (
  <div style={{ position: "absolute", left: 0, width: "100%", top: 1322, textAlign: "center", fontFamily: "Anton",
    fontSize: 26, color: "rgba(255,255,255,.55)", letterSpacing: 0.5 }}>KAYNAK: BAR-ELİ VD. (2007), 286 PENALTI</div>
);

// ---------- sahneler ----------
const GOAL = { x: 105, y: 640, w: 870, hgt: 300 };
const SPOT: [number, number, number] = [540, 1230, 40];

const HookVisual: React.FC<{ f: number; total: number }> = ({ f, total }) => {
  const zoom = interpolate(f, [0, total], [1, 1.14]);
  const q = 0.75 + 0.25 * Math.sin(f / 5);
  return (
    <AbsoluteFill style={{ transform: `scale(${zoom})`, transformOrigin: "50% 45%" }}>
      <Svg>
        <Goal {...GOAL} />
        <Keeper x={540} y={GOAL.y + GOAL.hgt} s={0.95} />
        <Ball x={SPOT[0]} y={SPOT[1]} r={SPOT[2]} />
        <text x={540} y={560} textAnchor="middle" fontFamily="Anton" fontSize={150} fill={YELLOW}
          opacity={q} stroke="#000" strokeWidth={8} paintOrder="stroke">?</text>
      </Svg>
    </AbsoluteFill>
  );
};

const Hook: React.FC<{ sc: Scene }> = ({ sc }) => {
  const f = useCurrentFrame();
  const ama = cue(sc.words, "ama");
  return (
    <>
      <HookVisual f={f} total={sc.frames} />
      <Headline top={150} lines={[
        { t: "Kaleciler bunu biliyor…", at: 0, size: 80 },
        { t: "ama yapmıyor", at: ama, color: YELLOW, size: 120 },
      ]} />
      <Sfx at={0} src="boom" v={0.8} />
      <Sfx at={ama} src="hit" v={0.7} />
    </>
  );
};

const ZONES = [{ n: "SOL", c: 92 }, { n: "ORTA", c: 82 }, { n: "SAĞ", c: 112 }]; // 286 şutun dağılımı (%32 / %29 / %39)
const Zones: React.FC<{ sc: Scene }> = ({ sc }) => {
  const f = useCurrentFrame();
  const count = Math.round(interpolate(f, [4, 50], [0, 286], { ...clamp, easing: Easing.out(Easing.cubic) }));
  const hi = cue(sc.words, "üçte");
  const zw = GOAL.w / 3;
  const dots: React.ReactNode[] = [];
  let k = 0;
  ZONES.forEach((z, zi) => {
    for (let i = 0; i < z.c; i++, k++) {
      const at = 10 + (k / 286) * 70 + random(`d${k}`) * 20;
      if (f < at) continue;
      const s = interpolate(f - at, [0, 4], [2, 1], clamp);
      const x = GOAL.x + zi * zw + 18 + random(`x${k}`) * (zw - 36);
      const y = GOAL.y + 18 + random(`y${k}`) * (GOAL.hgt - 36);
      const lit = zi === 1 && f >= hi;
      dots.push(<circle key={k} cx={x} cy={y} r={7 * s} fill={lit ? YELLOW : "#fff"} opacity={zi === 1 || f < hi ? 0.9 : 0.35} />);
    }
  });
  const glow = interpolate(f, [hi, hi + 6], [0, 1], clamp);
  return (
    <>
      <Svg>
        <rect x={GOAL.x + zw} y={GOAL.y} width={zw} height={GOAL.hgt} fill={YELLOW} opacity={0.22 * glow} />
        <Goal {...GOAL} />
        {[1, 2].map((i) => <line key={i} x1={GOAL.x + i * zw} y1={GOAL.y} x2={GOAL.x + i * zw} y2={GOAL.y + GOAL.hgt}
          stroke="#fff" strokeOpacity={0.6} strokeWidth={4} strokeDasharray="14 12" />)}
        {dots}
        {ZONES.map((z, i) => <text key={z.n} x={GOAL.x + zw * (i + 0.5)} y={GOAL.y + GOAL.hgt + 70} textAnchor="middle"
          fontFamily="Anton" fontSize={48} fill={i === 1 && f >= hi ? YELLOW : "#fff"}>{z.n}</text>)}
      </Svg>
      <Headline top={190} lines={[{ t: `${count} penaltı`, at: 0, size: 120 }]} />
      {f >= hi && (
        <div style={{ position: "absolute", top: 1040, width: "100%", textAlign: "center", transform: `scale(${pop(f, hi)})` }}>
          <div style={{ ...txt(10), fontSize: 150, color: YELLOW, lineHeight: 1 }}>%29</div>
          <div style={{ ...txt(8), fontSize: 64, color: "#fff" }}>TAM ORTAYA</div>
        </div>
      )}
      <Source />
      {[6, 14, 22, 30, 38, 46].map((t) => <Sfx key={t} at={t} src="tick" v={0.5} />)}
      <Sfx at={hi} src="ding" v={0.7} />
    </>
  );
};

const Panel: React.FC<{ y: number; label: string; pct: number; color: string; dive: number; at: number; good: boolean }> = ({ y, label, pct, color, dive, at, good }) => {
  const f = useCurrentFrame();
  if (f < at) return null;
  const inP = pop(f, at, 160);
  const fill = interpolate(f, [at + 6, at + 30], [0, pct], { ...clamp, easing: Easing.out(Easing.cubic) });
  const gx = 70, gw = 400, gh = 150;
  return (
    <div style={{ position: "absolute", left: 0, top: y, width: 1080, height: 420, opacity: inP, transform: `translateX(${(1 - inP) * -80}px)` }}>
      <svg width={1080} height={420} viewBox="0 0 1080 420" style={{ position: "absolute" }}>
        <Goal x={gx} y={110} w={gw} hgt={gh} />
        <Keeper x={gx + gw / 2} y={110 + gh} s={0.45} dive={dive * interpolate(f, [at, at + 12], [0, 1], clamp)} />
        <rect x={540} y={250} width={470} height={46} rx={23} fill="rgba(255,255,255,.12)" />
        <rect x={540} y={250} width={470 * fill / 100} height={46} rx={23} fill={color} />
      </svg>
      <div style={{ position: "absolute", left: 540, top: 30, ...txt(7), fontSize: 56, color: "#fff" }}>{up(label)}</div>
      <div style={{ position: "absolute", left: 540, top: 100, ...txt(8), fontSize: 110, color, lineHeight: 1.1 }}>
        %{Math.round(fill)} <span style={{ fontSize: 50, color: "#fff" }}>KURTARIŞ</span>
      </div>
      <div style={{ position: "absolute", left: 30, top: 0, fontFamily: "Anton", fontSize: 90, color,
        transform: `scale(${pop(f, at + 30)})` }}>{good ? "✓" : "✗"}</div>
    </div>
  );
};

const Compare: React.FC<{ sc: Scene }> = ({ sc }) => {
  const b = cue(sc.words, "atlayan");
  return (
    <>
      <Headline top={170} lines={[{ t: "Hangisi daha çok kurtarıyor?", at: 0, size: 70 }]} />
      <Panel y={380} label="Ortada kalan" pct={33} color={GREEN} dive={0} at={4} good />
      <Panel y={840} label="Atlayan" pct={13} color={RED} dive={-1} at={b} good={false} />
      <Source />
      <Sfx at={34} src="ding" v={0.7} />
      <Sfx at={b + 30} src="buzz" v={0.6} />
    </>
  );
};

const STAY = [12, 27, 45, 58, 73, 91];
const Grid: React.FC<{ sc: Scene }> = ({ sc }) => {
  const f = useCurrentFrame();
  const a = cue(sc.words, "doksan"), b = cue(sc.words, "altı");
  const icons: React.ReactNode[] = [];
  for (let i = 0; i < 100; i++) {
    const r = Math.floor(i / 10), c = i % 10;
    const stay = STAY.includes(i);
    const t = a + (i / 100) * 24;
    const d = stay ? 0 : interpolate(f, [t, t + 6], [0, i % 2 ? 1 : -1], clamp) * 0.85;
    const color = stay ? (f >= b ? YELLOW : WHITE) : f >= t ? "#FF6B6B" : WHITE;
    icons.push(<Keeper key={i} x={150 + c * 87} y={560 + r * 80} s={0.2} dive={d} spread={0.2} color={color} glove={color} />);
  }
  const hiS = f >= b ? 1 + 0.08 * Math.sin((f - b) / 3) : 1;
  return (
    <>
      <Svg>
        <g transform={`translate(540 760) scale(${hiS}) translate(-540 -760)`} opacity={1}>{icons}</g>
      </Svg>
      <Headline top={150} lines={[
        { t: "%94 atlıyor", at: a, color: "#FF6B6B", size: 110 },
        { t: "%6 ortada kalıyor", at: b, color: YELLOW, size: 80 },
      ]} />
      {f < a && <Headline top={190} lines={[{ t: "Peki kaleciler ne yaptı?", at: 0, size: 76 }]} />}
      <Source />
      <Sfx at={a} src="whoosh" v={0.7} />
      {[4, 10, 16, 22].map((t) => <Sfx key={t} at={a + t} src="tick" v={0.45} />)}
      <Sfx at={b} src="ding" v={0.7} />
    </>
  );
};

const Mini: React.FC<{ y: number; at: number; vAt: number; dive: number; target: number; label: string; verdict: string; vColor: string; quote: string }> =
  ({ y, at, vAt, dive, target, label, verdict, vColor, quote }) => {
  const f = useCurrentFrame();
  if (f < at) return null;
  const gx = 190, gw = 700, gh = 240, gy = 90;
  const b = shot(f, at + 8, 12, [540, gy + gh + 140, 30], [gx + gw * target, gy + 70, 16]);
  const kd = interpolate(f, [at + 10, at + 20], [0, dive], clamp);
  const hitNet = f >= at + 20;
  return (
    <div style={{ position: "absolute", left: 0, top: y, width: 1080, height: 520, opacity: pop(f, at, 200) }}>
      <svg width={1080} height={520} viewBox="0 0 1080 520" style={{ position: "absolute" }}>
        <Goal x={gx} y={gy} w={gw} hgt={gh} bulge={hitNet ? { x: gw * target, k: interpolate(f, [at + 20, at + 28], [30, 8], clamp) } : undefined} />
        <Keeper x={540} y={gy + gh} s={0.72} dive={kd} />
        <Ball x={b.x} y={b.y} r={b.r} spin={f * 25} />
      </svg>
      <div style={{ position: "absolute", left: 40, top: 0, ...txt(7), fontSize: 60, color: "#fff" }}>{up(label)}</div>
      <Stamp text={verdict} at={vAt} color={vColor} x={540} y={200} />
      {f >= vAt + 6 && (
        <div style={{ position: "absolute", width: "100%", top: 400, textAlign: "center", ...txt(6), fontSize: 46,
          color: vColor, transform: `scale(${pop(f, vAt + 6)})` }}>“{up(quote)}”</div>
      )}
      <Sfx at={at + 8} src="whoosh" v={0.6} />
      <Sfx at={at + 20} src="hit" v={0.8} />
      <Sfx at={vAt} src={vColor === RED ? "buzz" : "ding"} v={0.6} />
    </div>
  );
};

const Blame: React.FC<{ sc: Scene }> = ({ sc }) => {
  const a = cue(sc.words, "ortada"), b = cue(sc.words, "atlayıp"), v1 = cue(sc.words, "aptal"), v2 = cue(sc.words, "elinden");
  return (
    <>
      <Mini y={300} at={Math.max(0, a - 10)} vAt={v1} dive={0} target={0.12} label="Durursan" verdict="Suçlu" vColor={RED} quote="Ayağını bile oynatmadı!" />
      <Mini y={830} at={b - 10} vAt={v2} dive={-1} target={0.88} label="Atlarsan" verdict="Kahraman" vColor={GREEN} quote="Elinden geleni yaptı" />
      <Headline top={170} lines={[{ t: "Neden mi?", at: 0, color: YELLOW, size: 90 }]} />
    </>
  );
};

const Shield: React.FC<{ sc: Scene }> = ({ sc }) => {
  const f = useCurrentFrame();
  const itb = cue(sc.words, "itibar");
  const b = shot(f, 6, 14, SPOT, [GOAL.x + GOAL.w * 0.85, GOAL.y + 90, 20]);
  const net = f >= 20;
  const shake = net && f < 28 ? (28 - f) * 1.6 * (f % 2 ? 1 : -1) : 0;
  return (
    <>
      <AbsoluteFill style={{ transform: `translate(${shake}px, ${shake * 0.5}px)` }}>
        <Svg>
          <Goal {...GOAL} bulge={net ? { x: GOAL.w * 0.85, k: interpolate(f, [20, 30], [40, 10], clamp) } : undefined} />
          <Keeper x={540} y={GOAL.y + GOAL.hgt} s={0.95} arms="front" />
          <g transform={`translate(540 ${GOAL.y + 150}) scale(${pop(f, 0, 150)})`}>
            <path d="M-120 -100 H120 V10 C120 90 40 130 0 150 C-40 130 -120 90 -120 10 Z" fill="#1E3A8A" stroke={YELLOW} strokeWidth={10} />
            <text x={0} y={30} textAnchor="middle" fontFamily="Anton" fontSize={64} fill="#fff">İTİBAR</text>
          </g>
          {b.p < 1 && <Ball x={b.x} y={b.y} r={b.r} spin={f * 25} />}
        </Svg>
      </AbsoluteFill>
      <Headline top={150} lines={[
        { t: "Topu değil…", at: 0, size: 90 },
        { t: "itibarını kurtarıyor", at: itb, color: YELLOW, size: 100 },
      ]} />
      <Sfx at={6} src="whoosh" v={0.7} />
      <Sfx at={20} src="boom" v={0.9} />
    </>
  );
};

const Bias: React.FC<{ sc: Scene }> = ({ sc }) => {
  const f = useCurrentFrame();
  const sen = cue(sc.words, "sen");
  const fade = interpolate(f, [sen - 4, sen + 4], [1, 0.3], clamp);
  const lift = interpolate(f, [sen - 4, sen + 6], [0, -120], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  return (
    <>
      <div style={{ position: "absolute", top: 420, width: "100%", textAlign: "center", opacity: fade, transform: `translateY(${lift}px)` }}>
        <div style={{ ...txt(8), fontSize: 54, color: "#fff", transform: `scale(${pop(f, 0)})` }}>PSİKOLOGLAR BUNA</div>
        <div style={{ ...txt(12), fontSize: 150, color: YELLOW, lineHeight: 1.05, transform: `scale(${pop(f, 6)})` }}>EYLEM<br />YANLILIĞI</div>
        <div style={{ ...txt(6), fontSize: 46, color: "rgba(255,255,255,.8)", transform: `scale(${pop(f, 12)})` }}>(ACTION BIAS)</div>
        <div style={{ ...txt(7), fontSize: 46, color: "#fff", marginTop: 40, padding: "0 70px", transform: `scale(${pop(f, 22)})` }}>
          BİR ŞEY YAPMIŞ OLMAK İÇİN<br />YANLIŞ ŞEYİ YAPMAK</div>
      </div>
      {f >= sen && (
        <div style={{ position: "absolute", top: 1060, width: "100%", textAlign: "center", transform: `scale(${pop(f, sen)}) rotate(-4deg)` }}>
          <div style={{ display: "inline-block", background: YELLOW, padding: "10px 40px", borderRadius: 12 }}>
            <span style={{ fontFamily: "Anton", fontSize: 100, color: "#000" }}>VE SEN DE…</span>
          </div>
          <div style={{ ...txt(8), fontSize: 66, color: "#fff", marginTop: 24 }}>HER GÜN AYNISINI YAPIYORSUN</div>
        </div>
      )}
      <Sfx at={6} src="hit" v={0.7} />
      <Sfx at={sen} src="boom" v={0.7} />
    </>
  );
};

const Cta: React.FC<{ sc: Scene }> = ({ sc }) => {
  const f = useCurrentFrame();
  const c = pop(f, 0, 170);
  const tap = f - 30;
  const tapScale = tap >= 0 && tap < 8 ? interpolate(tap, [0, 3, 8], [1, 0.9, 1]) : 1;
  const done = tap >= 3;
  // son karelerde ilk sahneye geri döner: video döngüye girer
  const loop = interpolate(f, [sc.frames - 14, sc.frames - 1], [0, 1], clamp);
  return (
    <>
      <AbsoluteFill style={{ opacity: 1 - loop }}>
        <div style={{ position: "absolute", top: 560, width: "100%", textAlign: "center" }}>
          <div style={{ ...txt(8), fontSize: 64, color: "#fff", transform: `scale(${pop(f, 4)})` }}>FUTBOLUN GÖRÜNMEYEN</div>
          <div style={{ ...txt(10), fontSize: 110, color: YELLOW, lineHeight: 1.05, transform: `scale(${pop(f, 8)})` }}>PSİKOLOJİSİ</div>
        </div>
        <div style={{ position: "absolute", top: 900, width: "100%", display: "flex", justifyContent: "center", transform: `scale(${c * tapScale})` }}>
          <div style={{ background: done ? "#2B2B2B" : "#FF0033", borderRadius: 999, padding: "20px 64px", boxShadow: "0 12px 40px rgba(0,0,0,.5)" }}>
            <span style={{ fontFamily: "Anton", fontSize: 88, color: "#fff", letterSpacing: 1 }}>{done ? "ABONE OLUNDU" : "ABONE OL"}</span>
          </div>
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ opacity: loop }}><HookVisual f={0} total={1} /></AbsoluteFill>
      <Sfx at={0} src="whoosh" v={0.6} />
      <Sfx at={33} src="ding" v={0.7} />
    </>
  );
};

const SCENES: Record<string, React.FC<{ sc: Scene }>> = { hook: Hook, zones: Zones, compare: Compare, grid: Grid, blame: Blame, shield: Shield, bias: Bias, cta: Cta };

// kelime kelime altyazı: 3'lü gruplar, söylenen kelime sarı
const Captions: React.FC<{ words: Word[] }> = ({ words }) => {
  const f = useCurrentFrame();
  const t = f / FPS;
  const groups: Word[][] = [];
  words.forEach((w, i) => (i % 3 === 0 ? groups.push([w]) : groups[groups.length - 1].push(w)));
  const gi = groups.findIndex((g, i) => t >= g[0].t && (i === groups.length - 1 || t < groups[i + 1][0].t));
  if (gi < 0) return null;
  const g = groups[gi];
  const s = interpolate(f - Math.round(g[0].t * FPS), [0, 4], [0.85, 1], clamp);
  return (
    <div style={{ position: "absolute", top: 1400, width: "100%", textAlign: "center", transform: `scale(${s})` }}>
      {g.map((w, i) => {
        const on = t >= w.t && (i === g.length - 1 || t < g[i + 1].t);
        return <span key={i} style={{ ...txt(8), fontSize: 66, color: on ? YELLOW : "#fff", margin: "0 10px" }}>{up(w.w)}</span>;
      })}
    </div>
  );
};

export const Psiko: React.FC<PsikoData> = ({ slug, scenes }) => {
  const f = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const starts: number[] = [];
  scenes.reduce((acc, s) => { starts.push(acc); return acc + s.frames; }, 0);
  const shieldAt = scenes.findIndex((s) => s.kind === "shield");
  const sh0 = starts[shieldAt] ?? -1e6, sh1 = sh0 + (scenes[shieldAt]?.frames ?? 0);
  const segStart = [...starts].reverse().find((s) => f >= s) ?? 0;
  const flash = segStart > 0 ? interpolate(f - segStart, [0, 3], [0.35, 0], clamp) : 0;
  return (
    <AbsoluteFill lang="tr" style={{ background: "radial-gradient(ellipse at 50% 40%, #16264D 0%, #0A1229 55%, #04070F 100%)" }}>
      {/* saha çizgileri */}
      <svg width={1080} height={1920} style={{ position: "absolute", opacity: 0.07 }}>
        <circle cx={540} cy={1650} r={260} fill="none" stroke="#fff" strokeWidth={6} />
        <line x1={0} y1={1650} x2={1080} y2={1650} stroke="#fff" strokeWidth={6} />
      </svg>
      <div style={{ position: "absolute", top: 70, width: "100%", textAlign: "center", fontFamily: "Anton", fontSize: 34,
        color: "rgba(255,255,255,.6)", letterSpacing: 6 }}>PSİKOFUTBOL</div>

      {scenes.map((sc, i) => {
        const S = SCENES[sc.kind];
        return (
          <Sequence key={i} from={starts[i]} durationInFrames={sc.frames}>
            <S sc={sc} />
            <Captions words={sc.words} />
            <Sequence from={2}><Audio src={staticFile(`vo/${slug}/s${i}.wav`)} volume={1} /></Sequence>
          </Sequence>
        );
      })}

      {/* gerilim altlığı; itibar sahnesinde sessizlik */}
      <Audio src={staticFile("sfx/tension.wav")} volume={(fr) =>
        0.55 * interpolate(fr, [sh0 - 6, sh0, sh1, sh1 + 10], [1, 0, 0, 1], clamp) * interpolate(fr, [durationInFrames - 20, durationInFrames], [1, 0.3], clamp)} />
      <Sfx at={0} src="riser" v={0.3} />
      <AbsoluteFill style={{ backgroundColor: "#fff", opacity: flash, pointerEvents: "none" }} />
    </AbsoluteFill>
  );
};
