import React from "react";
import { AbsoluteFill, Audio, Img, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig,
  continueRender, delayRender, Easing, random } from "remotion";

// "Futbolun Psikolojisi" formatı: fotoğraf + Ken Burns + HUD animasyonları + kelime kelime altyazı.
// Veriyi tools/psych_build.py üretir (src/data/<slug>.json).
type Rect = [number, number, number]; // kaynak (1280x720) uzayında merkez x, merkez y, genişlik
export type Scene = { id: string; from: number; frames: number; img: string; a: Rect; b: Rect; fx: string[]; opt?: Record<string, any> };
export type Word = { w: string; s: number; e: number; hl: boolean; line: string };
export type PsychData = {
  slug: string; series: string; frames: number; scenes: Scene[]; words: Word[]; beats: number[];
  impact: number; devre: number; hakaret: number; amigdala: number; typeStart: number; typeRate: number;
  hud: string[]; audio: string; marks?: Record<string, number>;
};

const fonts: [string, string, string, string][] = [
  ["Anton", "fonts/anton-latin.woff2", "400", "U+0000-00FF,U+0131,U+0152-0153,U+2000-206F,U+2191,U+2193"],
  ["Anton", "fonts/anton-latin-ext.woff2", "400", "U+0100-02BA,U+1E00-1E9F"],
  ["JBM", "fonts/jbm-latin-400.woff2", "400", "U+0000-00FF,U+0131,U+2000-206F"],
  ["JBM", "fonts/jbm-latin-ext-400.woff2", "400", "U+0100-02BA"],
  ["JBM", "fonts/jbm-latin-700.woff2", "700", "U+0000-00FF,U+0131,U+2000-206F"],
  ["JBM", "fonts/jbm-latin-ext-700.woff2", "700", "U+0100-02BA"],
];
const fh = delayRender("fonts");
Promise.all(fonts.map(([fam, src, weight, unicodeRange]) => {
  const ff = new FontFace(fam, `url(${staticFile(src)})`, { weight, unicodeRange });
  return ff.load().then((x) => document.fonts.add(x));
})).then(() => continueRender(fh));

const W = 1080, BAND_TOP = 150, BAND_H = 1440; // görüntü bandı (3:4); altı YouTube arayüzüne kalır
const YEL = "#FFD400", RED = "#FF2A2A", CYAN = "#5CF2FF";
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const stroke = (w: number): React.CSSProperties => ({
  fontFamily: "Anton", WebkitTextStroke: `${w}px #000`, paintOrder: "stroke fill",
  textShadow: "0 6px 24px rgba(0,0,0,.65)",
});
const mono: React.CSSProperties = { fontFamily: "JBM", fontWeight: 700, letterSpacing: 2 };

// sahnedeki kamera: a -> b arası yumuşak geçiş
const camAt = (s: Scene, f: number): Rect => {
  const k = interpolate(f, [0, Math.max(1, s.frames)], [0, 1], { ...clamp, easing: Easing.inOut(Easing.sin) });
  return [0, 1, 2].map((i) => s.a[i] + (s.b[i] - s.a[i]) * k) as Rect;
};
const toScreen = (cam: Rect, x: number, y: number) => {
  const sc = W / cam[2], h = cam[2] * 4 / 3;
  return { x: (x - (cam[0] - cam[2] / 2)) * sc, y: BAND_TOP + (y - (cam[1] - h / 2)) * sc };
};

const Photo: React.FC<{ src: string; cam: Rect; filter?: string; style?: React.CSSProperties }> = ({ src, cam, filter, style }) => {
  const sc = W / cam[2], h = cam[2] * 4 / 3;
  return (
    <div style={{ position: "absolute", left: 0, top: BAND_TOP, width: W, height: BAND_H, overflow: "hidden", ...style }}>
      <Img src={staticFile(src)} style={{ position: "absolute", width: 1280 * sc, height: 720 * sc,
        left: -(cam[0] - cam[2] / 2) * sc, top: -(cam[1] - h / 2) * sc, filter }} />
    </div>
  );
};

const Grain: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ mixBlendMode: "overlay", opacity: 0.35, pointerEvents: "none" }}>
      <svg width="100%" height="100%">
        <filter id="g"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed={f % 12} /></filter>
        <rect width="100%" height="100%" filter="url(#g)" />
      </svg>
    </AbsoluteFill>
  );
};

const beatPulse = (beats: number[], f: number) => {
  let v = 0;
  for (const b of beats) if (f >= b && f < b + 8) v = Math.max(v, 1 - (f - b) / 8);
  return v;
};

// ---------- sahne ----------
const SceneView: React.FC<{ s: Scene; d: PsychData }> = ({ s, d }) => {
  const f = useCurrentFrame(); // sahne içi kare
  const g = s.from + f;        // genel kare
  const { fps } = useVideoConfig();
  const fx = (k: string) => s.fx.includes(k);
  const cam = camAt(s, f);

  // giriş vuruşu
  let punch = interpolate(f, [0, 8], [1.06, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  let sx = 0, sy = 0;
  if (fx("shake") && f < 14) { sx = (random(`sx${f}`) - .5) * (14 - f) * 3; sy = (random(`sy${f}`) - .5) * (14 - f) * 3; }
  if (fx("impact")) {
    punch = interpolate(f, [0, 10], [1.22, 1], { ...clamp, easing: Easing.out(Easing.exp) });
    const k = Math.max(0, 18 - f);
    sx = (random(`ix${f}`) - .5) * k * 4.5; sy = (random(`iy${f}`) - .5) * k * 4.5;
  }
  if (fx("tremble")) {
    const k = interpolate(f, [0, s.frames], [1, 6], clamp);
    sx = (random(`tx${f}`) - .5) * k * 2; sy = (random(`ty${f}`) - .5) * k * 2;
  }
  const bp = beatPulse(d.beats, g);
  if (fx("brain") || fx("why") || fx("turn") || fx("freeze") || fx("tremble") || fx("redduo")) punch *= 1 + bp * 0.025;

  // renk filtreleri
  let filter = "contrast(1.08) saturate(1.05)";
  if (fx("sepia")) filter = "sepia(.55) contrast(1.1) brightness(.85)";
  if (fx("desat")) filter = "saturate(.45) contrast(1.12) brightness(.9)";
  if (fx("freeze")) filter = `grayscale(${interpolate(f, [0, 8], [0, 1], clamp)}) contrast(1.25) brightness(.85)`;
  if (fx("gray")) filter = "grayscale(1) contrast(1.3) brightness(.7)";
  if (fx("redtint")) filter = "saturate(.6) contrast(1.2) brightness(.8)";
  if (fx("redduo")) filter = "grayscale(1) contrast(1.35) brightness(.75)";
  if (fx("dark")) filter = `saturate(.5) contrast(1.25) brightness(${interpolate(f, [0, s.frames], [.8, .45], clamp)})`;
  if (fx("impact")) filter = "contrast(1.2) saturate(1.15)";

  const chroma = fx("impact") ? Math.max(0, 14 - f) * 1.6 : 0;
  const hakG = g - d.hakaret;
  const glitchOn = fx("glitch") && hakG >= 0 && hakG < 9;
  const gx = glitchOn ? (random(`gl${f}`) - .5) * 40 : 0;

  return (
    <AbsoluteFill>
      {/* bulanık arka plan */}
      <AbsoluteFill style={{ overflow: "hidden" }}>
        <Img src={staticFile(s.img)} style={{ position: "absolute", height: "100%", left: "50%", transform: "translateX(-50%) scale(1.2)",
          filter: `blur(40px) brightness(.32) ${fx("gray") || fx("freeze") || fx("redduo") ? "grayscale(1)" : ""}` }} />
      </AbsoluteFill>
      <AbsoluteFill style={{ transform: `translate(${sx + gx}px, ${sy}px) scale(${punch})` }}>
        {chroma > 0 && <>
          <Photo src={s.img} cam={cam} filter={filter} style={{ transform: `translateX(${-chroma}px)`, mixBlendMode: "screen", opacity: .7 }} />
        </>}
        <Photo src={s.img} cam={cam} filter={filter} style={chroma > 0 ? { transform: `translateX(${chroma}px)` } : undefined} />
        {(fx("redtint") || fx("redduo")) && (
          <div style={{ position: "absolute", top: BAND_TOP, width: W, height: BAND_H, background: RED, mixBlendMode: "multiply", opacity: fx("redduo") ? .85 : .45 }} />
        )}
        {fx("gray") && g >= d.amigdala && (
          <div style={{ position: "absolute", top: BAND_TOP, width: W, height: BAND_H, background: `radial-gradient(circle at 70% 35%, rgba(255,30,30,${.25 + bp * .3}), transparent 60%)` }} />
        )}
      </AbsoluteFill>
      {/* bant kenarları: üst/alt karartma */}
      <div style={{ position: "absolute", top: BAND_TOP - 2, height: 300, width: W, background: "linear-gradient(180deg, rgba(0,0,0,.85) 0%, rgba(0,0,0,.4) 40%, rgba(0,0,0,0))" }} />
      <div style={{ position: "absolute", top: BAND_TOP + BAND_H - 420, height: 422, width: W, background: "linear-gradient(0deg, rgba(0,0,0,.92) 0%, rgba(0,0,0,.45) 45%, rgba(0,0,0,0))" }} />
      <div style={{ position: "absolute", top: BAND_TOP + BAND_H, bottom: 0, width: W, background: "linear-gradient(180deg, rgba(0,0,0,.92), rgba(0,0,0,.75))" }} />

      {glitchOn && <GlitchBars seed={f} />}
      {fx("typehud") && <TypeHud d={d} />}
      {fx("clock") && <Clock s={s} />}
      {fx("tags") && <Tags cam={cam} />}
      {fx("stamp:HAKARET") && <Stamp text="HAKARET" at={d.hakaret - s.from} />}
      {fx("freeze") && <FreezeHud sub={s.opt?.sub ?? "109:58"} />}
      {fx("brain") && <BrainScan d={d} s={s} />}
      {fx("ecg") && <Ecg d={d} s={s} />}
      {fx("logic") && <Logic d={d} s={s} />}
      {fx("family") && <Family d={d} s={s} />}
      {fx("impact") && <ImpactRings cam={cam} />}
      {fx("redcard") && <RedCard />}
      {fx("cta") && <Cta />}
      {fx("flags") && <Flags />}
      {fx("quote") && <QuoteCard o={s.opt!} />}
      {fx("score") && <Score o={s.opt!} d={d} s={s} />}
      {fx("table") && <Table o={s.opt!} d={d} s={s} />}
      {fx("question") && <Question n={s.opt!.n} />}
      {fx("poll") && <Poll o={s.opt!} />}

      {/* geçiş flaşı */}
      <AbsoluteFill style={{ background: "#fff", pointerEvents: "none",
        opacity: fx("impact") ? interpolate(f, [0, 3], [.95, 0], clamp) : fx("flash") ? interpolate(f, [0, 1, 6], [0, .7, 0], clamp)
          : fx("redcard") ? 0 : interpolate(f, [0, 3], [.35, 0], clamp) }} />
      {fx("redcard") && <AbsoluteFill style={{ background: RED, opacity: interpolate(f, [0, 8], [.55, 0], clamp) }} />}
      {(fx("brain") || fx("why") || fx("turn") || fx("ecg")) && (
        <AbsoluteFill style={{ boxShadow: `inset 0 0 ${180 + bp * 120}px rgba(255,0,0,${.25 + bp * .35})`, pointerEvents: "none" }} />
      )}
    </AbsoluteFill>
  );
};

// ---------- HUD parçaları ----------
const GlitchBars: React.FC<{ seed: number }> = ({ seed }) => (
  <AbsoluteFill style={{ pointerEvents: "none" }}>
    {Array.from({ length: 9 }).map((_, i) => {
      const y = random(`gy${seed}-${i}`) * 1500 + 150, h = 6 + random(`gh${seed}-${i}`) * 40;
      return <div key={i} style={{ position: "absolute", top: y, height: h, left: 0, width: W,
        background: i % 3 === 0 ? "rgba(255,0,60,.55)" : i % 3 === 1 ? "rgba(0,255,255,.4)" : "rgba(255,255,255,.35)",
        transform: `translateX(${(random(`gx${seed}-${i}`) - .5) * 200}px)`, mixBlendMode: "screen" }} />;
    })}
  </AbsoluteFill>
);

const TypeHud: React.FC<{ d: PsychData }> = ({ d }) => {
  const f = useCurrentFrame();
  const sceneStart = d.scenes.find((x) => x.fx.includes("typehud"))!.from;
  let t = f + sceneStart - d.typeStart;
  const sizes = [104, 40, 40];
  return (
    <div style={{ position: "absolute", left: 70, top: 300 }}>
      {d.hud.map((line, i) => {
        const gap = i * 0.12 * 30;
        const n = Math.max(0, Math.min(line.length, Math.floor((t - gap) / d.typeRate)));
        t -= line.length * d.typeRate;
        const typing = n > 0 && n < line.length;
        return (
          <div key={i} style={{ ...mono, fontSize: sizes[i], color: i === 0 ? "#fff" : i === 1 ? YEL : "rgba(255,255,255,.85)",
            textShadow: "0 3px 14px rgba(0,0,0,.9)", marginTop: i ? 14 : 0, whiteSpace: "pre" }}>
            {line.slice(0, n)}{(typing || (i === 2 && n === line.length && Math.floor(f / 8) % 2 === 0)) ? "▌" : ""}
          </div>
        );
      })}
    </div>
  );
};

const Clock: React.FC<{ s: Scene }> = ({ s }) => {
  const f = useCurrentFrame();
  const sec = Math.min(59, 52 + Math.floor(f / 9));
  const label = sec >= 59 ? "110:00" : `109:${String(sec).padStart(2, "0")}`;
  const k = spring({ frame: f, fps: 30, config: { damping: 14 } });
  return (
    <div style={{ position: "absolute", right: 60, top: 300, textAlign: "right", transform: `scale(${k})`, transformOrigin: "right top" }}>
      <div style={{ ...mono, fontSize: 36, color: YEL, textShadow: "0 3px 12px #000" }}>● CANLI · İTA 1-1 FRA</div>
      <div style={{ ...mono, fontSize: 120, color: "#fff", textShadow: "0 4px 20px #000" }}>{label}</div>
      <div style={{ display: "inline-block", marginTop: 10, background: RED, color: "#fff", ...mono, fontSize: 38, padding: "8px 18px" }}>
        KARİYERİNİN SON MAÇI
      </div>
    </div>
  );
};

const Tags: React.FC<{ cam: Rect }> = ({ cam }) => {
  const f = useCurrentFrame();
  const tags = [{ n: "ZIDANE · 10", x: 455, y: 250, at: 2 }, { n: "MATERAZZI · 23", x: 950, y: 215, at: 30 }];
  return (
    <>
      {tags.map((t) => {
        const p = toScreen(cam, t.x, t.y);
        const k = spring({ frame: f - t.at, fps: 30, config: { damping: 13 } });
        if (f < t.at) return null;
        return (
          <div key={t.n} style={{ position: "absolute", left: Math.max(190, Math.min(890, p.x)), top: p.y - 190, transform: `translateX(-50%) scale(${k})`, transformOrigin: "bottom center",
            display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ ...mono, fontSize: 40, color: "#000", background: YEL, padding: "8px 18px", whiteSpace: "nowrap" }}>{t.n}</div>
            <div style={{ width: 4, height: 110, background: YEL }} />
            <div style={{ width: 22, height: 22, borderRadius: 11, border: `4px solid ${YEL}` }} />
          </div>
        );
      })}
    </>
  );
};

const Stamp: React.FC<{ text: string; at: number }> = ({ text, at }) => {
  const f = useCurrentFrame() - at;
  if (f < 0) return null;
  const k = interpolate(f, [0, 6], [2.4, 1], { ...clamp, easing: Easing.out(Easing.back(2)) });
  return (
    <div style={{ position: "absolute", top: 430, width: W, display: "flex", justifyContent: "center" }}>
      <div style={{ transform: `rotate(-8deg) scale(${k})`, opacity: interpolate(f, [0, 3], [0, 1], clamp),
        border: `10px solid ${RED}`, padding: "6px 34px", fontFamily: "Anton", fontSize: 150, color: RED, letterSpacing: 6,
        textShadow: "0 0 30px rgba(255,0,0,.5)", background: "rgba(0,0,0,.35)" }}>{text}</div>
    </div>
  );
};

const FreezeHud: React.FC<{ sub: string }> = ({ sub }) => {
  const f = useCurrentFrame();
  const k = spring({ frame: f - 3, fps: 30, config: { damping: 12 } });
  return (
    <>
      <AbsoluteFill style={{ backgroundImage: "repeating-linear-gradient(0deg, rgba(255,255,255,.06) 0 2px, transparent 2px 6px)" }} />
      <div style={{ position: "absolute", top: 380, width: W, display: "flex", flexDirection: "column", alignItems: "center", transform: `scale(${k})` }}>
        <div style={{ display: "flex", gap: 26 }}>
          <div style={{ width: 46, height: 160, background: "#fff", boxShadow: "0 0 30px rgba(255,255,255,.5)" }} />
          <div style={{ width: 46, height: 160, background: "#fff", boxShadow: "0 0 30px rgba(255,255,255,.5)" }} />
        </div>
        <div style={{ ...mono, fontSize: 52, color: "#fff", marginTop: 30, letterSpacing: 10, textShadow: "0 3px 14px #000" }}>ZAMAN DURDU</div>
        <div style={{ ...mono, fontSize: 40, color: YEL, marginTop: 8, opacity: Math.floor(f / 10) % 2 ? .4 : 1 }}>{sub}</div>
      </div>
    </>
  );
};

// sola bakan beyin (Zidane'ın profil fotoğrafıyla aynı yön)
const BRAIN = "M150 250 C 120 190 150 120 220 95 C 260 50 340 40 390 62 C 440 40 520 50 555 95 C 610 105 650 160 640 215 C 670 260 650 320 600 335 C 590 375 540 395 495 382 C 470 410 420 415 390 395 C 350 410 300 405 275 380 C 230 390 180 365 175 325 C 140 315 130 280 150 250 Z";
const GYRI = ["M220 140 C 260 120 290 150 330 130", "M360 90 C 380 130 430 120 450 150", "M480 100 C 500 140 550 130 580 160",
  "M200 220 C 250 200 280 240 330 215", "M360 190 C 400 170 430 210 470 190", "M500 210 C 540 190 580 230 615 220",
  "M210 300 C 250 280 290 320 340 300", "M380 270 C 420 300 470 280 520 300", "M540 290 C 570 270 600 300 620 290"];

const BrainScan: React.FC<{ d: PsychData; s: Scene }> = ({ d, s }) => {
  const f = useCurrentFrame(), g = s.from + f;
  const k = spring({ frame: f, fps: 30, config: { damping: 15 } });
  const o = s.opt ?? {};
  const alarmAt = o.alarmAt ? d.marks![o.alarmAt] : d.amigdala;
  const offAt = o.alarmAt ? Infinity : d.devre;
  const lit = g >= alarmAt;
  const pulse = lit ? .6 + .4 * Math.sin((g - alarmAt) / 2.2) : 0;
  const off = g >= offAt;
  const scan = (f * 9) % 460;
  const draw = interpolate(f, [0, 18], [1, 0], clamp);
  return (
    <div style={{ position: "absolute", left: 90, top: 250, width: 900, height: 560, transform: `scale(${k})`, transformOrigin: "center",
      background: "rgba(0,12,18,.55)", border: `2px solid rgba(92,242,255,.5)`, borderRadius: 18, overflow: "hidden",
      backgroundImage: "linear-gradient(rgba(92,242,255,.08) 1px, transparent 1px), linear-gradient(90deg, rgba(92,242,255,.08) 1px, transparent 1px)",
      backgroundSize: "40px 40px" }}>
      <div style={{ ...mono, position: "absolute", left: 22, top: 16, fontSize: 28, color: CYAN }}>{o.title ?? "BEYİN TARAMASI · CANLI"}</div>
      <div style={{ ...mono, position: "absolute", right: 22, top: 16, fontSize: 28, color: lit ? RED : CYAN, opacity: lit && Math.floor(f / 6) % 2 ? .4 : 1 }}>
        {lit ? `⚠ ${o.alarm ?? "ALARM"}` : "NORMAL"}
      </div>
      <svg viewBox="100 20 600 420" style={{ position: "absolute", left: 110, top: 70, width: 680, height: 470 }}>
        <defs>
          <radialGradient id="am"><stop offset="0" stopColor="#ff3030" stopOpacity="1" /><stop offset="1" stopColor="#ff0000" stopOpacity="0" /></radialGradient>
        </defs>
        <path d={BRAIN} fill="rgba(92,242,255,.08)" stroke={CYAN} strokeWidth="4" pathLength={1} strokeDasharray="1" strokeDashoffset={draw} />
        {GYRI.map((p, i) => <path key={i} d={p} fill="none" stroke={CYAN} strokeWidth="2.5" opacity={.55} pathLength={1} strokeDasharray="1" strokeDashoffset={draw} />)}
        {/* prefrontal korteks (ön, solda): mantık */}
        <ellipse cx="215" cy="215" rx="70" ry="95" fill={off ? "rgba(80,80,80,.25)" : `rgba(92,242,255,${.35 - interpolate(g, [alarmAt, o.alarmAt ? alarmAt + 90 : d.devre], [0, .25], clamp)})`} />
        {/* amigdala */}
        {lit && <circle cx="360" cy="320" r={60 + pulse * 70} fill="url(#am)" opacity={.9} />}
        <ellipse cx="360" cy="320" rx="26" ry="16" fill={lit ? "#ff3b3b" : "rgba(92,242,255,.5)"} stroke="#fff" strokeWidth="2" />
        <line x1="100" y1={60 + scan} x2="700" y2={60 + scan} stroke={CYAN} strokeWidth="2" opacity=".35" />
      </svg>
      {/* etiketler */}
      <div style={{ ...mono, position: "absolute", left: 40, top: 470, fontSize: 30, color: off ? "#888" : CYAN }}>
        {o.cortex ?? "PREFRONTAL · MANTIK"}{off ? " ✕" : ""}
      </div>
      {lit && <div style={{ ...mono, position: "absolute", right: 40, top: 470, fontSize: 34, color: "#fff", background: RED, padding: "4px 14px",
        transform: `scale(${spring({ frame: g - alarmAt, fps: 30, config: { damping: 10 } })})` }}>{o.amyg ?? "AMİGDALA"}</div>}
      {o.left && lit && <TugOfWar left={o.left} right={o.right} f={g - alarmAt} />}
    </div>
  );
};

const Ecg: React.FC<{ d: PsychData; s: Scene }> = ({ d, s }) => {
  const f = useCurrentFrame(), g = s.from + f;
  const past = d.beats.filter((b) => b <= g);
  const bpm = past.length >= 2 ? Math.round(1800 / (past[past.length - 1] - past[past.length - 2])) : 64;
  // son 2.5 saniyenin EKG çizgisi
  const span = 75, Wd = 560, pts: string[] = [];
  for (let i = 0; i <= 140; i++) {
    const fr = g - span + (i / 140) * span;
    let y = 0;
    for (const b of d.beats) { const t = fr - b; if (t > -1 && t < 5) y += t < 0.6 ? -80 * (t + 1) : t < 1.6 ? 60 * (t - 1.2) * 3 : t < 3 ? -12 : 0; }
    pts.push(`${(i / 140) * Wd},${70 + Math.max(-65, Math.min(55, y))}`);
  }
  const bp = beatPulse(d.beats, g);
  const top = s.fx.includes("brain") ? 840 : 300;
  return (
    <div style={{ position: "absolute", left: 60, top, display: "flex", alignItems: "center", gap: 22 }}>
      <svg width={Wd} height={140} style={{ background: "rgba(0,0,0,.45)", borderRadius: 12, border: "2px solid rgba(255,60,60,.5)" }}>
        <polyline points={pts.join(" ")} fill="none" stroke={RED} strokeWidth="5" strokeLinejoin="round" style={{ filter: "drop-shadow(0 0 6px red)" }} />
      </svg>
      <div style={{ textAlign: "left" }}>
        <div style={{ fontSize: 64, transform: `scale(${1 + bp * .35})`, color: RED, lineHeight: 1 }}>♥</div>
        <div style={{ ...mono, fontSize: 78, color: "#fff", lineHeight: 1, textShadow: "0 3px 12px #000" }}>{bpm}</div>
        <div style={{ ...mono, fontSize: 26, color: "rgba(255,255,255,.8)" }}>NABIZ / DK</div>
      </div>
    </div>
  );
};

const Logic: React.FC<{ d: PsychData; s: Scene }> = ({ d, s }) => {
  const f = useCurrentFrame(), g = s.from + f;
  const v = g < d.devre ? Math.round(interpolate(g, [d.amigdala, d.devre], [100, 38], clamp)) : 0;
  const off = g >= d.devre;
  const k = spring({ frame: g - d.devre, fps: 30, config: { damping: 9 } });
  return (
    <div style={{ position: "absolute", left: 60, top: 1010, width: 960 }}>
      <div style={{ display: "flex", justifyContent: "space-between", ...mono, fontSize: 32, color: "#fff" }}>
        <span>MANTIK</span><span style={{ color: off ? RED : "#fff" }}>%{v}</span>
      </div>
      <div style={{ height: 22, background: "rgba(255,255,255,.15)", marginTop: 8, borderRadius: 4 }}>
        <div style={{ height: "100%", width: `${v}%`, background: v > 60 ? CYAN : YEL, borderRadius: 4 }} />
      </div>
      {off && <div style={{ position: "absolute", left: 0, right: 0, top: -560, display: "flex", justifyContent: "center" }}>
        <div style={{ transform: `rotate(-6deg) scale(${interpolate(g - d.devre, [0, 6], [2.2, 1], { ...clamp, easing: Easing.out(Easing.back(2)) })})`,
          border: `10px solid ${RED}`, padding: "4px 30px", fontFamily: "Anton", fontSize: 128, color: RED, background: "rgba(0,0,0,.55)", opacity: k > 0 ? 1 : 0 }}>
          DEVRE DIŞI
        </div>
      </div>}
    </div>
  );
};

const Family: React.FC<{ d: PsychData; s: Scene }> = ({ d, s }) => {
  const f = useCurrentFrame();
  const kendine = d.words.find((w) => w.line === "why" && w.hl)?.s ?? s.from + 50;
  const m = interpolate(s.from + f, [kendine - 6, kendine + 10], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const k = spring({ frame: f, fps: 30, config: { damping: 14 } });
  const circ = (label: string, x: number, col: string, op = 1) => (
    <div style={{ position: "absolute", left: x - 140, top: 0, width: 280, height: 280, borderRadius: 140, border: `8px solid ${col}`,
      display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,.45)", opacity: op }}>
      <span style={{ fontFamily: "Anton", fontSize: 76, color: "#fff" }}>{label}</span>
    </div>
  );
  return (
    <div style={{ position: "absolute", top: 520, left: 0, width: W, height: 300, transform: `scale(${k})` }}>
      {circ("AİLE", 540 - 190 * (1 - m), "#fff", 1 - m * .9)}
      {circ("BEN", 540 + 190 * (1 - m), "#fff", 1 - m * .9)}
      {m > .6 && circ("TEHDİT", 540, RED, interpolate(m, [.6, 1], [0, 1]))}
      {m < .5 && <div style={{ position: "absolute", left: 0, width: W, top: 110, textAlign: "center", fontFamily: "Anton", fontSize: 70, color: YEL, opacity: 1 - m * 2 }}>=</div>}
    </div>
  );
};

const ImpactRings: React.FC<{ cam: Rect }> = ({ cam }) => {
  const f = useCurrentFrame();
  const p = toScreen(cam, 900, 440);
  return (
    <>
      {[0, 4, 8].map((o) => {
        const t = f - o; if (t < 0 || t > 16) return null;
        const r = 40 + t * 45;
        return <div key={o} style={{ position: "absolute", left: p.x - r, top: p.y - r, width: r * 2, height: r * 2, borderRadius: r,
          border: `${Math.max(1, 10 - t * .5)}px solid rgba(255,255,255,${1 - t / 16})` }} />;
      })}
    </>
  );
};

const RedCard: React.FC = () => {
  const f = useCurrentFrame();
  const k = spring({ frame: f - 2, fps: 30, config: { damping: 9, stiffness: 180 } });
  return (
    <div style={{ position: "absolute", right: 80, top: 290, width: 200, height: 280, background: "linear-gradient(135deg,#ff3434,#c40000)",
      borderRadius: 16, boxShadow: "0 20px 60px rgba(0,0,0,.6), 0 0 60px rgba(255,0,0,.5)", transform: `rotate(${12 - k * 4}deg) scale(${k})` }} />
  );
};

const Cta: React.FC = () => {
  const f = useCurrentFrame();
  const k = spring({ frame: f - 2, fps: 30, config: { damping: 12 } });
  const bob = Math.sin(f / 4) * 10;
  return (
    <div style={{ position: "absolute", top: 300, width: W, display: "flex", flexDirection: "column", alignItems: "center", transform: `scale(${k})` }}>
      <div style={{ ...stroke(10), fontSize: 120, color: "#fff", lineHeight: 1 }}>SEN OLSAN</div>
      <div style={{ ...stroke(10), fontSize: 132, color: YEL, lineHeight: 1.05 }}>NE YAPARDIN?</div>
      <div style={{ marginTop: 40, background: "#fff", color: "#000", ...mono, fontSize: 44, padding: "14px 34px", borderRadius: 999,
        transform: `translateY(${bob}px)` }}>YORUMLARA YAZ ↓</div>
    </div>
  );
};

// ---------- 2. bölüm parçaları ----------
const TurkFlag: React.FC<{ w: number }> = ({ w }) => (
  <svg width={w} height={w * 2 / 3} viewBox="0 0 30 20" style={{ display: "block" }}>
    <rect width="30" height="20" fill="#E30A17" />
    <circle cx="11.25" cy="10" r="5" fill="#fff" /><circle cx="12.5" cy="10" r="4" fill="#E30A17" />
    <polygon fill="#fff" transform="translate(17.6 10) rotate(-90) scale(1.25)"
      points="0,-1 0.2245,-0.309 0.951,-0.309 0.363,0.118 0.588,0.809 0,0.382 -0.588,0.809 -0.363,0.118 -0.951,-0.309 -0.2245,-0.309" />
  </svg>
);
const ItaFlag: React.FC<{ w: number }> = ({ w }) => (
  <svg width={w} height={w * 2 / 3} viewBox="0 0 3 2" style={{ display: "block" }}>
    <rect width="1" height="2" fill="#009246" /><rect x="1" width="1" height="2" fill="#fff" /><rect x="2" width="1" height="2" fill="#CE2B37" />
  </svg>
);

// kanca: iki bayrak arasında çatlayan kalp
const Flags: React.FC = () => {
  const f = useCurrentFrame();
  const k = spring({ frame: f - 4, fps: 30, config: { damping: 12 } });
  const crack = interpolate(f, [40, 52], [0, 1], clamp);
  const split = crack * 18;
  const flag = (el: React.ReactNode, side: number) => (
    <div style={{ transform: `translateX(${side * (1 - k) * 300}px) rotate(${side * -6}deg)`, boxShadow: "0 16px 40px rgba(0,0,0,.6)",
      border: "6px solid #fff", borderRadius: 10, overflow: "hidden" }}>{el}</div>
  );
  return (
    <div style={{ position: "absolute", top: 330, width: W, display: "flex", justifyContent: "center", alignItems: "center", gap: 40 }}>
      {flag(<ItaFlag w={250} />, -1)}
      <svg width="190" height="180" viewBox="0 0 100 95" style={{ transform: `scale(${k})`, filter: "drop-shadow(0 0 24px rgba(255,0,0,.7))", overflow: "visible" }}>
        <g transform={`translate(${-split} 0) rotate(${-crack * 8} 50 90)`}>
          <path d="M50 90 L50 25 C 45 8 25 0 12 10 C -2 22 2 45 20 60 Z" fill={RED} />
        </g>
        <g transform={`translate(${split} 0) rotate(${crack * 8} 50 90)`}>
          <path d="M50 90 L50 25 C 55 8 75 0 88 10 C 102 22 98 45 80 60 Z" fill={RED} />
        </g>
        {crack > 0 && <polyline points="50,22 44,40 56,52 46,66 52,80 50,90" fill="none" stroke="#fff" strokeWidth={3 * crack} />}
      </svg>
      {flag(<TurkFlag w={250} />, 1)}
    </div>
  );
};

const QuoteCard: React.FC<{ o: Record<string, any> }> = ({ o }) => {
  const f = useCurrentFrame();
  const k = spring({ frame: f - 3, fps: 30, config: { damping: 14 } });
  const n = Math.floor(interpolate(f, [8, 8 + o.text.length * 1.1], [0, o.text.length], clamp));
  return (
    <div style={{ position: "absolute", left: 60, right: 60, top: 280, transform: `translateY(${(1 - k) * 60}px)`, opacity: k,
      background: "rgba(0,0,0,.62)", borderLeft: `12px solid ${RED}`, padding: "30px 36px", borderRadius: 8 }}>
      <div style={{ fontFamily: "Anton", fontSize: 64, color: "#fff", lineHeight: 1.15 }}>
        {o.text.slice(0, n)}<span style={{ opacity: 0 }}>{o.text.slice(n)}</span>
      </div>
      <div style={{ ...mono, fontSize: 30, color: YEL, marginTop: 18 }}>— {o.by}</div>
    </div>
  );
};

const Score: React.FC<{ o: Record<string, any>; d: PsychData; s: Scene }> = ({ o, d, s }) => {
  const f = useCurrentFrame(), g = s.from + f;
  const gAt = d.marks!.goals, fin = d.marks!.final;
  const k = spring({ frame: f - 2, fps: 30, config: { damping: 14 } });
  const shown = g >= fin;
  const pop = spring({ frame: g - fin, fps: 30, config: { damping: 9, stiffness: 200 } });
  return (
    <div style={{ position: "absolute", top: 280, width: W, display: "flex", flexDirection: "column", alignItems: "center", transform: `scale(${k})` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 26, background: "rgba(0,0,0,.7)", padding: "18px 34px", borderRadius: 16,
        border: "2px solid rgba(255,255,255,.2)" }}>
        <TurkFlag w={96} />
        <span style={{ ...mono, fontSize: 56, color: "#fff" }}>{o.home}</span>
        <span style={{ fontFamily: "Anton", fontSize: 130, color: shown ? "#fff" : "rgba(255,255,255,.25)", minWidth: 250, textAlign: "center",
          transform: `scale(${shown ? .8 + .2 * pop : 1})`, display: "inline-block" }}>{shown ? `${o.hs} - ${o.as}` : "? - ?"}</span>
        <span style={{ ...mono, fontSize: 56, color: "#fff" }}>{o.away}</span>
        <ItaFlag w={96} />
      </div>
      <div style={{ display: "flex", gap: 22, marginTop: 26 }}>
        {o.goals.map((m: string, i: number) => {
          const t = g - (gAt + i * 6);
          if (t < 0) return null;
          const p = spring({ frame: t, fps: 30, config: { damping: 9, stiffness: 220 } });
          return <div key={m} style={{ ...mono, fontSize: 44, color: "#fff", background: RED, padding: "8px 22px", borderRadius: 8,
            transform: `scale(${p})` }}>⚽ {m}</div>;
        })}
      </div>
    </div>
  );
};

const Table: React.FC<{ o: Record<string, any>; d: PsychData; s: Scene }> = ({ o, d, s }) => {
  const f = useCurrentFrame(), g = s.from + f;
  const four = d.marks!.four, zero = d.marks!.zero;
  const k = spring({ frame: f - 2, fps: 30, config: { damping: 14 } });
  const z = spring({ frame: g - zero, fps: 30, config: { damping: 8, stiffness: 200 } });
  return (
    <div style={{ position: "absolute", top: 280, width: W, display: "flex", flexDirection: "column", alignItems: "center", opacity: k }}>
      <div style={{ ...mono, fontSize: 32, color: YEL, letterSpacing: 4 }}>{o.title}</div>
      <div style={{ ...mono, fontSize: 40, color: "#fff", marginTop: 10, background: "rgba(0,0,0,.6)", padding: "6px 20px" }}>{o.last}</div>
      <div style={{ display: "flex", gap: 20, marginTop: 30 }}>
        {[0, 1, 2, 3].map((i) => {
          const t = g - (four + i * 5);
          const p = t >= 0 ? spring({ frame: t, fps: 30, config: { damping: 10, stiffness: 220 } }) : 0;
          return <div key={i} style={{ width: 150, height: 150, borderRadius: 14, background: p ? RED : "rgba(255,255,255,.12)",
            display: "flex", alignItems: "center", justifyContent: "center", transform: `scale(${t >= 0 ? .7 + .3 * p : 1})`,
            border: "3px solid rgba(255,255,255,.3)" }}>
            <span style={{ fontFamily: "Anton", fontSize: 90, color: "#fff", opacity: p }}>M</span>
          </div>;
        })}
      </div>
      {g >= zero && <div style={{ marginTop: 34, transform: `rotate(-5deg) scale(${interpolate(g - zero, [0, 6], [2.2, 1], { ...clamp, easing: Easing.out(Easing.back(2)) })})`,
        border: `10px solid ${RED}`, padding: "4px 34px", fontFamily: "Anton", fontSize: 130, color: RED, background: "rgba(0,0,0,.55)", opacity: z > 0 ? 1 : 0 }}>
        0 PUAN</div>}
    </div>
  );
};

// beyin taramasının altında iki kimlik arasında halat çekme
const TugOfWar: React.FC<{ left: string; right: string; f: number }> = ({ left, right, f }) => {
  const x = Math.sin(f / 5) * 60 + Math.sin(f / 2.3) * 18;
  return (
    <div style={{ position: "absolute", left: 40, right: 40, top: 70, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}><TurkFlag w={60} /><span style={{ ...mono, fontSize: 26, color: "#fff" }}>{left}</span></div>
      <div style={{ position: "absolute", left: "50%", top: 18, width: 16, height: 16, borderRadius: 8, background: RED, transform: `translateX(${x - 8}px)`,
        boxShadow: "0 0 18px red" }} />
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}><span style={{ ...mono, fontSize: 26, color: "#fff" }}>{right}</span><ItaFlag w={60} /></div>
    </div>
  );
};

const Question: React.FC<{ n: number }> = ({ n }) => {
  const f = useCurrentFrame();
  const k = interpolate(f, [0, 7], [2.2, 1], { ...clamp, easing: Easing.out(Easing.back(2)) });
  return (
    <div style={{ position: "absolute", top: 330, width: W, display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ transform: `rotate(-4deg) scale(${k})`, opacity: interpolate(f, [0, 3], [0, 1], clamp), border: `10px solid #fff`,
        padding: "0 40px", background: RED, boxShadow: "0 20px 60px rgba(0,0,0,.6)" }}>
        <span style={{ fontFamily: "Anton", fontSize: 150, color: "#fff", letterSpacing: 4 }}>SORU {n}</span>
      </div>
      <div style={{ display: "flex", gap: 14, marginTop: 28 }}>
        {[1, 2, 3].map((i) => <div key={i} style={{ width: 70, height: 12, borderRadius: 6, background: i <= n ? "#fff" : "rgba(255,255,255,.25)" }} />)}
      </div>
    </div>
  );
};

const Poll: React.FC<{ o: Record<string, any> }> = ({ o }) => {
  const f = useCurrentFrame();
  const k = spring({ frame: f - 2, fps: 30, config: { damping: 12 } });
  const opt = (t: string, c: string, i: number) => {
    const p = spring({ frame: f - 10 - i * 5, fps: 30, config: { damping: 11 } });
    return <div style={{ ...mono, fontSize: 52, color: "#fff", background: c, padding: "18px 40px", borderRadius: 14, marginTop: 22,
      transform: `translateX(${(1 - p) * (i ? 400 : -400)}px)`, minWidth: 640, textAlign: "center", boxShadow: "0 12px 30px rgba(0,0,0,.5)" }}>{t}</div>;
  };
  return (
    <div style={{ position: "absolute", top: 300, width: W, display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ ...stroke(10), fontSize: 104, color: "#fff", lineHeight: 1.05, textAlign: "center", padding: "0 50px", transform: `scale(${k})` }}>{o.q}</div>
      {opt(o.a, "#1E9E5A", 0)}
      {opt(o.b, RED, 1)}
      <div style={{ ...mono, fontSize: 40, color: YEL, marginTop: 34, transform: `translateY(${Math.sin(f / 4) * 8}px)` }}>YORUMLARA YAZ ↓</div>
    </div>
  );
};

// ---------- altyazı ----------
type Chunk = { words: Word[]; s: number; e: number };
const chunkWords = (ws: Word[]): Chunk[] => {
  const out: Chunk[] = [];
  let cur: Word[] = [];
  const flush = () => { if (cur.length) out.push({ words: cur, s: cur[0].s, e: cur[cur.length - 1].e }); cur = []; };
  ws.forEach((w, i) => {
    if (cur.length && (cur[0].line !== w.line || cur.length >= 3 || cur.map((x) => x.w).join(" ").length + w.w.length > 17)) flush();
    cur.push(w);
    if (/[.,:!?"]$/.test(w.w) && i + 1 < ws.length && ws[i + 1].s - w.e > 4) flush();
  });
  flush();
  return out;
};

const Captions: React.FC<{ d: PsychData }> = ({ d }) => {
  const f = useCurrentFrame();
  const chunks = React.useMemo(() => {
    const hidden = new Set(d.scenes.filter((x) => x.fx.includes("nocap")).map((x) => x.id));
    return chunkWords(d.words.filter((w) => w.line !== "cta" && !hidden.has(w.line)));
  }, [d]);
  const idx = chunks.findIndex((c, i) => f >= c.s - 1 && f < Math.min(c.e + 12, chunks[i + 1]?.s ?? Infinity));
  if (idx < 0) return null;
  const c = chunks[idx];
  const k = spring({ frame: f - c.s + 1, fps: 30, config: { damping: 12, stiffness: 220 } });
  return (
    <div style={{ position: "absolute", top: 1170, width: W, display: "flex", justifyContent: "center", flexWrap: "wrap", gap: "0 22px",
      padding: "0 60px", transform: `scale(${.85 + .15 * k})` }}>
      {c.words.map((w, i) => {
        const on = f >= w.s;
        const active = on && (f < w.e + 2 || i === c.words.length - 1);
        const col = w.hl ? (on ? RED : "#fff") : active ? YEL : "#fff";
        const pop = active ? spring({ frame: f - w.s, fps: 30, config: { damping: 10, stiffness: 260 } }) : 1;
        return <span key={i} style={{ ...stroke(12), fontSize: w.hl ? 112 : 100, color: col, lineHeight: 1.12,
          transform: `scale(${active ? .9 + .14 * pop : 1})`, display: "inline-block", opacity: on ? 1 : .55,
          textShadow: w.hl && on ? "0 0 30px rgba(255,0,0,.6), 0 6px 24px rgba(0,0,0,.7)" : "0 6px 24px rgba(0,0,0,.7)" }}>
          {w.w.replace(/[.,:!?"]+$/g, "").replace(/^"/, "")}</span>;
      })}
    </div>
  );
};

const SeriesTag: React.FC<{ d: PsychData }> = ({ d }) => {
  const f = useCurrentFrame();
  return (
    <div style={{ position: "absolute", top: 70, left: 0, width: W, display: "flex", justifyContent: "center",
      opacity: interpolate(f, [0, 10], [0, 1], clamp) }}>
      <div style={{ ...mono, fontSize: 30, color: "#fff", background: "rgba(0,0,0,.55)", border: "2px solid rgba(255,255,255,.25)",
        padding: "8px 22px", borderRadius: 999, letterSpacing: 4 }}>
        <span style={{ color: RED }}>●</span> {d.series}
      </div>
    </div>
  );
};

export const Psych: React.FC<PsychData> = (d) => (
  <AbsoluteFill style={{ background: "#000" }}>
    {d.scenes.map((s) => (
      <Sequence key={s.id} from={s.from} durationInFrames={s.frames}><SceneView s={s} d={d} /></Sequence>
    ))}
    <Grain />
    <AbsoluteFill style={{ background: "radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,.55) 100%)", pointerEvents: "none" }} />
    <Captions d={d} />
    <SeriesTag d={d} />
    <Audio src={staticFile(d.audio)} />
  </AbsoluteFill>
);
