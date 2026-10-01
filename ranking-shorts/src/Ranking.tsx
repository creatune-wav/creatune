import React from "react";
import { AbsoluteFill, Audio, OffthreadVideo, Sequence, interpolate, spring,
  staticFile, useCurrentFrame, useVideoConfig, continueRender, delayRender, Easing } from "remotion";

export type Item = { rank: number; label: string; clip: string; credit: string; frames: number; impact: number; focus: number };
export type RankingData = {
  slug: string; title: string[];
  hook: { clip: string; frames: number };
  cta: { frames: number; sub: string; at?: "one" | "end" };
  items: Item[];
  numbers?: boolean; // her klibin başında "Number five…" seslendirmesi
};

export const totalFrames = (d: RankingData) => d.hook.frames + d.items.reduce((s, x) => s + x.frames, 0);

const font = new FontFace("Anton", `url(${staticFile("fonts/Anton.woff2")})`);
const h = delayRender("font");
font.load().then(() => { document.fonts.add(font); continueRender(h); });

const BAND_TOP = 380, BAND_H = 1180; // video bandı; alt 360 px YouTube arayüzüne kalır
const NUM: Record<number, string> = { 1: "one", 2: "two", 3: "three", 4: "four", 5: "five" };
const RANK_COLOR: Record<number, string> = { 1: "#FFD400", 2: "#DADADA", 3: "#E8904A", 4: "#FFFFFF", 5: "#FFFFFF" };
const txt = (w: number): React.CSSProperties => ({
  WebkitTextStroke: `${w}px #000`, paintOrder: "stroke fill", fontFamily: "Anton",
  textShadow: "0 4px 14px rgba(0,0,0,.5)", textTransform: "uppercase", letterSpacing: 0.5,
});

const ClipLayer: React.FC<{ src: string; focus: number; impact: number; volume?: number; duck?: boolean }> = ({ src, focus, impact, volume = 1, duck = false }) => {
  const f = useCurrentFrame();
  const punch = interpolate(f, [0, 9], [1.07, 1], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  // çarpma anında kısa sarsıntı
  const k = impact > 0 ? f - impact : -1;
  const shake = k >= 0 && k < 6 ? (6 - k) * 2.2 * (k % 2 ? 1 : -1) : 0;
  return (
    <AbsoluteFill>
      <OffthreadVideo src={staticFile(src)} muted
        style={{ width: "100%", height: "100%", objectFit: "cover", filter: "blur(38px) brightness(.45) saturate(1.2)", transform: "scale(1.25)" }} />
      <div style={{ position: "absolute", top: BAND_TOP, height: BAND_H, width: "100%", overflow: "hidden",
        transform: `translate(${shake}px, ${shake * 0.6}px) scale(${punch})` }}>
        <OffthreadVideo src={staticFile(src)} volume={(fr) => (duck && fr < 38 ? 0.35 : 1) * volume}
          style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: `${focus}% 50%` }} />
      </div>
      {/* bant kenarlarını yumuşat */}
      <div style={{ position: "absolute", top: BAND_TOP - 2, height: 90, width: "100%", background: "linear-gradient(180deg, rgba(0,0,0,.55), rgba(0,0,0,0))" }} />
      <div style={{ position: "absolute", top: BAND_TOP + BAND_H - 120, height: 122, width: "100%", background: "linear-gradient(0deg, rgba(0,0,0,.55), rgba(0,0,0,0))" }} />
    </AbsoluteFill>
  );
};

export const Ranking: React.FC<RankingData> = ({ slug, title, hook, cta, items, numbers }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const H = hook.frames;
  const total = totalFrames({ hook, items } as RankingData);

  const starts: number[] = [];
  items.reduce((acc, it) => { starts.push(acc); return acc + it.frames; }, H);
  let seg = -1;
  starts.forEach((s, i) => { if (f >= s) seg = i; });
  const segStart = seg >= 0 ? starts[seg] : 0;

  // başlık: hook sırasında ortada büyük, sonra yukarı oturur
  const tIn = spring({ frame: f, fps, config: { damping: 14, stiffness: 160 } });
  const settle = interpolate(f, [H - 8, H + 4], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) });
  const tTop = interpolate(settle, [0, 1], [780, 130]);
  const tScale = interpolate(settle, [0, 1], [1.3, 1]) * (0.6 + 0.4 * tIn);
  const hookZoom = interpolate(f, [0, H], [1, 1.12]);

  // at "one": #1 başlar başlamaz kısa SUBSCRIBE; "end": en sonda karartmalı kapanış
  const atOne = cta.at === "one";
  const ctaStart = atOne ? starts[starts.length - 1] + 10 : total - cta.frames;
  const ctaEnd = atOne ? ctaStart + cta.frames : total + 1;
  const ctaOn = f >= ctaStart && f < ctaEnd;
  const ctaOut = atOne ? interpolate(f, [ctaEnd - 8, ctaEnd], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 1;
  const dim = !atOne && f >= ctaStart;
  const c = spring({ frame: f - ctaStart, fps, config: { damping: 11, stiffness: 170 } });
  const tap = f - ctaStart - 26;
  const tapScale = tap >= 0 && tap < 8 ? interpolate(tap, [0, 3, 8], [1, 0.9, 1]) : 1;
  const subscribed = tap >= 3;

  const cutFlash = seg >= 0 ? interpolate(f - segStart, [0, 3], [0.55, 0], { extrapolateRight: "clamp" }) : 0;

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {/* HOOK */}
      <Sequence durationInFrames={H}>
        <AbsoluteFill style={{ transform: `scale(${hookZoom})` }}>
          <ClipLayer src={hook.clip} focus={50} impact={0} volume={0.35} />
        </AbsoluteFill>
        <Audio src={staticFile("sfx/riser.wav")} volume={0.3} />
        <Sequence from={2}><Audio src={staticFile(`vo/${slug}.wav`)} volume={1} /></Sequence>
      </Sequence>

      {items.map((it, i) => (
        <Sequence key={it.rank} from={starts[i]} durationInFrames={it.frames}>
          <ClipLayer src={it.clip} focus={it.focus} impact={it.impact} duck={numbers} />
          {numbers && <Sequence from={3}><Audio src={staticFile(`vo/num-${NUM[it.rank]}.wav`)} volume={1} /></Sequence>}
          <Audio src={staticFile("sfx/whoosh.wav")} volume={0.6} />
          <Sequence from={5}><Audio src={staticFile("sfx/hit.wav")} volume={0.4} /></Sequence>
          {it.rank === 1 && it.impact > 0 && (
            <Sequence from={it.impact - 1}><Audio src={staticFile("sfx/boom.wav")} volume={1} /></Sequence>
          )}
        </Sequence>
      ))}

      {/* liste okunurluğu için sol gölge */}
      <AbsoluteFill style={{ opacity: settle * (dim ? 1 - c : 1),
        background: "linear-gradient(90deg, rgba(0,0,0,.42) 0%, rgba(0,0,0,0) 58%)" }} />

      {/* başlık */}
      <div style={{ position: "absolute", top: tTop, width: "100%", textAlign: "center", lineHeight: 1.0,
        transform: `scale(${tScale})`, transformOrigin: "center top" }}>
        <div style={{ ...txt(8), fontSize: 52, color: "#FFD400" }}>{title[0]}</div>
        <div style={{ ...txt(10), fontSize: 100, color: "#fff" }}>{title[1]}</div>
      </div>

      {/* sıralama listesi */}
      {f >= H && [1, 2, 3, 4, 5].slice(0, items.length).map((rank, row) => {
        const idx = items.findIndex((x) => x.rank === rank);
        const shownAt = starts[idx] + 5;
        const revealed = f >= shownAt;
        const active = idx === seg;
        const pop = spring({ frame: f - shownAt, fps, config: { damping: 11, stiffness: 190 } });
        const rowIn = spring({ frame: f - H - row * 2, fps, config: { damping: 16 } });
        const fade = dim ? 1 - c : 1;
        return (
          <div key={rank} style={{ position: "absolute", left: 34, top: 440 + row * 112, display: "flex", alignItems: "center", gap: 16,
            opacity: rowIn * fade * (active || !revealed ? 1 : 0.8), transform: `translateX(${(1 - rowIn) * -60}px)` }}>
            <div style={{ ...txt(8), fontSize: 84, color: RANK_COLOR[rank], width: 82,
              transform: `scale(${active ? 1.1 : 1})`, transformOrigin: "left center" }}>{rank}.</div>
            <div style={{ ...txt(7), fontSize: 50, color: "#fff", whiteSpace: "nowrap",
              transform: `scale(${revealed ? pop : 1})`, transformOrigin: "left center" }}>
              {revealed ? items[idx].label : rank === 1 ? "???" : ""}
            </div>
          </div>
        );
      })}

      {/* kaynak */}
      {seg >= 0 && !ctaOn && !dim && (
        <div style={{ position: "absolute", left: 36, top: BAND_TOP + BAND_H - 58, fontFamily: "Anton", fontSize: 26,
          color: "rgba(255,255,255,.7)", letterSpacing: 0.5 }}>
          via {items[seg].credit}
        </div>
      )}

      {/* SUBSCRIBE (sonda) */}
      {ctaOn && (
        <>
          {!atOne && <AbsoluteFill style={{ backgroundColor: `rgba(0,0,0,${0.35 * c})` }} />}
          <Sequence from={ctaStart}><Audio src={staticFile("sfx/ding.wav")} volume={0.7} /></Sequence>
          <div style={{ position: "absolute", top: atOne ? 1230 : 820, width: "100%", display: "flex", flexDirection: "column", alignItems: "center",
            opacity: ctaOut, transform: `scale(${c * tapScale * (atOne ? 0.8 : 1)})` }}>
            <div style={{ background: subscribed ? "#2B2B2B" : "#FF0033", borderRadius: 999, padding: "20px 64px",
              boxShadow: "0 12px 40px rgba(0,0,0,.5)" }}>
              <span style={{ fontFamily: "Anton", fontSize: 88, color: "#fff", letterSpacing: 1 }}>
                {subscribed ? "SUBSCRIBED" : "SUBSCRIBE"}
              </span>
            </div>
            <div style={{ ...txt(7), fontSize: 48, color: "#FFD400", marginTop: 26,
              opacity: interpolate(f - ctaStart, [8, 16], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>
              {cta.sub}
            </div>
          </div>
        </>
      )}

      {/* kesme flaşı */}
      <AbsoluteFill style={{ backgroundColor: "#fff", opacity: cutFlash, pointerEvents: "none" }} />
    </AbsoluteFill>
  );
};
