import React from "react";
import { AbsoluteFill, Audio, Img, Sequence, interpolate, spring, staticFile,
  useCurrentFrame, useVideoConfig, continueRender, delayRender, Easing } from "remotion";

// Seslendirmeli, sahne sahne anlatım shorts'u (data/<slug>.story.json → tools/voice_tr.py → src/data/<slug>.json)
type Pic = { img?: string; focus?: number };
export type Scene = Pic & {
  id: string; kind: "big" | "score" | "price" | "split" | "versus" | "stats" | "quote" | "cta";
  theme: string; vo: string; frames: number; sfx?: string; kicker?: string; num?: string;
  lines?: string[]; hl?: number; home?: string; away?: string; score?: string; scorer?: string;
  price?: string; sub?: string; foot?: string; who?: string; quote?: string[];
  left?: Pic & { team: string; word: string; theme: string }; right?: Pic & { team: string; word: string; theme: string };
  top?: Pic & { label: string; word: string }; bottom?: Pic & { label: string; word: string };
  cards?: { label: string; value: string; bad: boolean }[];
  q?: string[]; a?: string; b?: string;
};
export type StoryData = { slug: string; badge: string; scenes: Scene[] };
export const storyFrames = (d: StoryData) => d.scenes.reduce((s, x) => s + x.frames, 0);

const F = "AntonTR";
const h = delayRender("font-tr");
Promise.all([
  new FontFace(F, `url(${staticFile("fonts/Anton.woff2")})`).load(),
  new FontFace(F, `url(${staticFile("fonts/AntonExt.woff2")})`, { unicodeRange: "U+0100-024F" }).load(),
]).then((fs) => { fs.forEach((x) => document.fonts.add(x)); continueRender(h); });

const TH: Record<string, { a: string; b: string }> = {
  fb: { a: "#FFE600", b: "#0B1E5B" }, gs: { a: "#FDB912", b: "#A90432" },
  benfica: { a: "#FFFFFF", b: "#D6001C" }, dark: { a: "#FFD400", b: "#121212" }, alarm: { a: "#FF2B2B", b: "#000000" },
};
const T = (w: number): React.CSSProperties => ({
  fontFamily: F, WebkitTextStroke: `${w}px #000`, paintOrder: "stroke fill", textTransform: "uppercase",
  textShadow: "0 6px 18px rgba(0,0,0,.6)", lineHeight: 1.02, letterSpacing: 0.5,
});
const SAFE_BOTTOM = 1500; // altı YouTube arayüzü

const useSlam = (delay: number, stiff = 200) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig();
  return spring({ frame: f - delay, fps, config: { damping: 12, stiffness: stiff } });
};

const Photo: React.FC<Pic & { dur: number; dim?: number; style?: React.CSSProperties }> = ({ img, focus = 50, dur, dim = 0.5, style }) => {
  const f = useCurrentFrame();
  if (!img) return null;
  const z = interpolate(f, [0, dur], [1.08, 1.2]);
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", ...style }}>
      <Img src={staticFile(img)} style={{ width: "100%", height: "100%", objectFit: "cover",
        objectPosition: `${focus}% 30%`, transform: `scale(${z})`, filter: `brightness(${1 - dim * 0.5}) saturate(1.15) contrast(1.05)` }} />
    </div>
  );
};

const Kicker: React.FC<{ text?: string; color: string; y: number }> = ({ text, color, y }) => {
  const s = useSlam(0);
  if (!text) return null;
  return (
    <div style={{ position: "absolute", top: y, width: "100%", display: "flex", justifyContent: "center",
      transform: `translateY(${(1 - s) * -40}px)`, opacity: s }}>
      <div style={{ background: color, color: "#000", fontFamily: F, fontSize: 46, padding: "6px 26px", borderRadius: 8,
        textTransform: "uppercase", letterSpacing: 1 }}>{text}</div>
    </div>
  );
};

const Lines: React.FC<{ lines: string[]; hl?: number; accent: string; y: number; size?: number; step?: number }> = ({ lines, hl, accent, y, size = 120, step = 7 }) => (
  <div style={{ position: "absolute", top: y, width: "100%", textAlign: "center", padding: "0 40px", boxSizing: "border-box" }}>
    {lines.map((l, i) => {
      const s = useSlam(4 + i * step);
      const fs = Math.min(size, Math.floor(1900 / Math.max(6, l.length)));
      return (
        <div key={i} style={{ ...T(10), fontSize: fs, color: i === hl ? accent : "#fff",
          transform: `scale(${interpolate(s, [0, 1], [2.2, 1])})`, opacity: Math.min(1, s * 2) }}>{l}</div>
      );
    })}
  </div>
);

const Num: React.FC<{ n?: string; color: string }> = ({ n, color }) => {
  const s = useSlam(0, 260);
  if (!n) return null;
  return (
    <div style={{ position: "absolute", top: 300, left: 40, width: 150, height: 150, borderRadius: 999, background: color,
      display: "flex", alignItems: "center", justifyContent: "center", transform: `scale(${s}) rotate(${(1 - s) * -90}deg)`,
      boxShadow: "0 10px 30px rgba(0,0,0,.6)", border: "6px solid #000" }}>
      <span style={{ fontFamily: F, fontSize: 104, color: "#000" }}>{n}</span>
    </div>
  );
};

const Shade: React.FC<{ from?: number }> = ({ from = 0.35 }) => (
  <AbsoluteFill style={{ background: `linear-gradient(180deg, rgba(0,0,0,${from}) 0%, rgba(0,0,0,.15) 30%, rgba(0,0,0,.75) 58%, rgba(0,0,0,.92) 100%)` }} />
);

const SceneView: React.FC<{ s: Scene }> = ({ s }) => {
  const f = useCurrentFrame();
  const th = TH[s.theme] || TH.dark;
  const dur = s.frames;

  if (s.kind === "split" && s.left && s.right) {
    const L = TH[s.left.theme], R = TH[s.right.theme];
    const sl = useSlam(2), sr = useSlam(14), ft = useSlam(30);
    const half = (p: typeof s.left, c: { a: string; b: string }, x: number, sp: number) => (
      <div style={{ position: "absolute", left: x, top: 0, width: 540, height: 1920, overflow: "hidden",
        transform: `translateY(${(1 - sp) * (x ? 1 : -1) * 600}px)` }}>
        <Photo {...p} dur={dur} dim={0.3} />
        <AbsoluteFill style={{ background: `linear-gradient(180deg, ${c.b}00 25%, ${c.b}EE 62%)` }} />
        <div style={{ position: "absolute", top: 1010, width: "100%", textAlign: "center", padding: "0 20px", boxSizing: "border-box" }}>
          <div style={{ ...T(6), fontSize: 50, color: c.a }}>{p!.team}</div>
          <div style={{ ...T(9), fontSize: p!.word.length > 10 ? 76 : 120, color: "#fff", marginTop: 10 }}>{p!.word}</div>
        </div>
      </div>
    );
    return (
      <AbsoluteFill style={{ background: "#000" }}>
        {half(s.left, L, 0, sl)}{half(s.right, R, 540, sr)}
        <div style={{ position: "absolute", left: 534, top: 0, width: 12, height: 1920, background: "#000" }} />
        <div style={{ position: "absolute", top: 1330, width: "100%", textAlign: "center", opacity: ft, transform: `scale(${ft})` }}>
          <span style={{ ...T(8), fontSize: 66, color: "#FF2B2B" }}>{s.foot}</span>
        </div>
        <Num n={s.num} color={th.a} />
      </AbsoluteFill>
    );
  }

  if (s.kind === "versus" && s.top && s.bottom) {
    const a = useSlam(2), b = useSlam(Math.round(dur * 0.45));
    const part = (p: typeof s.top, y: number, sp: number, col: string, gray: boolean) => (
      <div style={{ position: "absolute", top: y, left: 0, width: 1080, height: 760, overflow: "hidden",
        opacity: sp, transform: `translateX(${(1 - sp) * (y ? 1 : -1) * 500}px)` }}>
        <Photo {...p} dur={dur} dim={0.4} style={{ filter: gray ? "grayscale(1)" : undefined }} />
        <AbsoluteFill style={{ background: "linear-gradient(0deg, rgba(0,0,0,.85), rgba(0,0,0,0) 60%)" }} />
        <div style={{ position: "absolute", bottom: 30, left: 50 }}>
          <div style={{ ...T(6), fontSize: 52, color: "#fff" }}>{p!.label}</div>
          <div style={{ ...T(10), fontSize: 150, color: col }}>{p!.word}</div>
        </div>
      </div>
    );
    return (
      <AbsoluteFill style={{ background: "#000" }}>
        {part(s.top, 0, a, "#35E06A", false)}
        {part(s.bottom, 770, b, "#FF2B2B", true)}
        <Num n={s.num} color={th.a} />
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill style={{ background: th.b }}>
      <Photo img={s.img} focus={s.focus} dur={dur} />
      <Shade />
      <AbsoluteFill style={{ background: `linear-gradient(0deg, ${th.b}AA, ${th.b}00 45%)`, mixBlendMode: "multiply" }} />
      <Num n={s.num} color={th.a} />

      {s.kind === "big" && (<>
        <Kicker text={s.kicker} color={th.a} y={930} />
        <Lines lines={s.lines!} hl={s.hl} accent={th.a} y={s.kicker ? 1020 : 980} />
      </>)}

      {s.kind === "score" && (() => {
        const c = useSlam(2), g = useSlam(22);
        return (<>
          <Kicker text={s.kicker} color={th.a} y={900} />
          <div style={{ position: "absolute", top: 1000, left: 40, right: 40, height: 200, display: "flex", alignItems: "stretch",
            transform: `scale(${c})`, boxShadow: "0 16px 40px rgba(0,0,0,.6)", borderRadius: 18, overflow: "hidden" }}>
            <div style={{ flex: 1, background: "#D6001C", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ ...T(5), fontSize: 64, color: "#fff" }}>{s.home}</span></div>
            <div style={{ width: 230, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontFamily: F, fontSize: 120, color: "#000" }}>{s.score}</span></div>
            <div style={{ flex: 1, background: "#0B1E5B", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ ...T(5), fontSize: 64, color: "#FFE600" }}>{s.away}</span></div>
          </div>
          <div style={{ position: "absolute", top: 1240, width: "100%", textAlign: "center", transform: `scale(${interpolate(g, [0, 1], [2, 1])})`, opacity: g }}>
            <span style={{ ...T(9), fontSize: 82, color: "#FFE600" }}>⚽ {s.scorer}</span>
          </div>
          <div style={{ position: "absolute", top: 1360, width: "100%", textAlign: "center", opacity: g }}>
            <span style={{ ...T(7), fontSize: 64, color: "#fff" }}>FENERBAHÇE ELENDİ</span>
          </div>
        </>);
      })()}

      {s.kind === "price" && (() => {
        const p = useSlam(6, 260), sub = useSlam(20), ft = useSlam(32);
        const k = f - 6; const shake = k >= 0 && k < 8 ? (8 - k) * 3 * (k % 2 ? 1 : -1) : 0;
        return (<>
          <Kicker text={s.kicker} color={th.a} y={880} />
          <div style={{ position: "absolute", top: 960, width: "100%", textAlign: "center",
            transform: `translateX(${shake}px) scale(${interpolate(p, [0, 1], [3, 1])})`, opacity: Math.min(1, p * 2) }}>
            <span style={{ ...T(14), fontSize: 260, color: th.a }}>{s.price}</span>
          </div>
          <div style={{ position: "absolute", top: 1250, width: "100%", textAlign: "center", opacity: sub }}>
            <span style={{ ...T(7), fontSize: 58, color: "#fff" }}>{s.sub}</span></div>
          <div style={{ position: "absolute", top: 1340, width: "100%", textAlign: "center", opacity: ft, transform: `scale(${ft})` }}>
            <span style={{ ...T(8), fontSize: 66, color: "#FF2B2B" }}>{s.foot}</span></div>
        </>);
      })()}

      {s.kind === "stats" && (<>
        <Kicker text={s.kicker} color={th.a} y={700} />
        {s.cards!.map((c, i) => {
          const at = Math.round((dur / (s.cards!.length + 0.4)) * i) + 4;
          const sp = useSlam(at, 240);
          return (
            <div key={i} style={{ position: "absolute", top: 800 + i * 215, left: 50, right: 50, height: 190, borderRadius: 18,
              background: "rgba(10,10,10,.88)", borderLeft: `18px solid ${c.bad ? "#FF2B2B" : "#35E06A"}`,
              display: "flex", flexDirection: "column", justifyContent: "center", paddingLeft: 36,
              transform: `translateX(${(1 - sp) * 1100}px) rotate(${(1 - sp) * 6}deg)`, boxShadow: "0 12px 30px rgba(0,0,0,.6)" }}>
              <div style={{ fontFamily: F, fontSize: 40, color: "rgba(255,255,255,.75)" }}>{c.label}</div>
              <div style={{ ...T(4), fontSize: c.value.length > 10 ? 76 : 100, color: c.bad ? "#FF2B2B" : "#35E06A" }}>{c.value}</div>
            </div>
          );
        })}
      </>)}

      {s.kind === "quote" && (() => {
        const w = useSlam(2), sub = useSlam(30);
        return (<>
          <div style={{ position: "absolute", top: 860, width: "100%", textAlign: "center", opacity: w }}>
            <span style={{ background: "#FF2B2B", fontFamily: F, fontSize: 50, color: "#fff", padding: "6px 24px", borderRadius: 8 }}>🎙 {s.who}</span>
          </div>
          <Lines lines={s.quote!} hl={1} accent="#FF2B2B" y={960} size={130} step={8} />
          <div style={{ position: "absolute", top: 1290, width: "100%", textAlign: "center", opacity: sub, padding: "0 60px", boxSizing: "border-box" }}>
            <span style={{ ...T(6), fontSize: 54, color: "#fff" }}>{s.sub}</span></div>
        </>);
      })()}

      {s.kind === "cta" && (() => {
        const a = useSlam(26, 240), b = useSlam(34, 240), ft = useSlam(46);
        const pulse = 1 + 0.05 * Math.sin(f / 4);
        const btn = (t: string, bg: string, sp: number) => (
          <div style={{ background: bg, borderRadius: 22, padding: "18px 0", width: 420, textAlign: "center", border: "6px solid #000",
            transform: `scale(${sp * pulse})`, boxShadow: "0 12px 30px rgba(0,0,0,.6)" }}>
            <span style={{ fontFamily: F, fontSize: 92, color: "#fff" }}>{t}</span></div>
        );
        return (<>
          <Lines lines={s.q!} hl={1} accent={th.a} y={760} size={170} />
          <div style={{ position: "absolute", top: 1150, width: "100%", display: "flex", justifyContent: "center", gap: 40 }}>
            {btn(s.a!, "#D11B1B", a)}{btn(s.b!, "#159A3F", b)}
          </div>
          <div style={{ position: "absolute", top: 1370, width: "100%", textAlign: "center", opacity: ft, transform: `scale(${ft})` }}>
            <span style={{ ...T(7), fontSize: 56, color: "#FFE600" }}>{s.foot}</span></div>
        </>);
      })()}
    </AbsoluteFill>
  );
};

export const Story: React.FC<StoryData> = ({ badge, scenes }) => {
  const f = useCurrentFrame();
  const starts: number[] = [];
  scenes.reduce((acc, s) => { starts.push(acc); return acc + s.frames; }, 0);
  const titleEnd = starts[2] ?? 0; // "kaçırıldı mı" sahnesinden sonra üstte sabit başlık
  const total = storyFrames({ scenes } as StoryData);
  const prog = f / total;
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {scenes.map((s, i) => {
        const local = f - starts[i];
        const flash = interpolate(local, [0, 4], [0.6, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        return (
          <Sequence key={s.id} from={starts[i]} durationInFrames={s.frames}>
            <AbsoluteFill style={{ transform: `scale(${interpolate(local, [0, 6], [1.06, 1], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) })})` }}>
              <SceneView s={s} />
            </AbsoluteFill>
            <AbsoluteFill style={{ background: "#fff", opacity: flash }} />
            <Audio src={staticFile(s.vo)} />
            <Audio src={staticFile("sfx/whoosh.wav")} volume={0.5} />
            <Sequence from={5}><Audio src={staticFile("sfx/hit.wav")} volume={0.35} /></Sequence>
            {s.sfx === "boom" && <Sequence from={6}><Audio src={staticFile("sfx/boom.wav")} volume={0.8} /></Sequence>}
            {i === 0 && <Audio src={staticFile("sfx/riser.wav")} volume={0.25} />}
          </Sequence>
        );
      })}

      {/* üst başlık bandı */}
      {f >= titleEnd && (
        <div style={{ position: "absolute", top: 120, width: "100%", display: "flex", justifyContent: "center" }}>
          <div style={{ background: "#FF2B2B", padding: "8px 28px", borderRadius: 10, border: "5px solid #000",
            transform: `scale(${spring({ frame: f - titleEnd, fps: 30, config: { damping: 12 } })})` }}>
            <span style={{ fontFamily: F, fontSize: 58, color: "#fff" }}>🚨 {badge} KAÇIRILDI MI?</span>
          </div>
        </div>
      )}
      {/* ilerleme çubuğu */}
      <div style={{ position: "absolute", top: 0, left: 0, height: 10, width: `${prog * 100}%`, background: "#FF2B2B" }} />
    </AbsoluteFill>
  );
};
