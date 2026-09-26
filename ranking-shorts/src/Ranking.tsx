import React from "react";
import { AbsoluteFill, Audio, OffthreadVideo, Sequence, interpolate, spring,
  staticFile, useCurrentFrame, useVideoConfig, continueRender, delayRender } from "remotion";

export const CLIP = 165; // 5.5 sn @30fps
export type Item = { rank: number; label: string; clip: string; credit: string };
export type RankingData = { slug: string; title: string[]; items: Item[] };

const font = new FontFace("Anton", `url(${staticFile("fonts/Anton.woff2")})`);
const h = delayRender("font");
font.load().then(() => { document.fonts.add(font); continueRender(h); });

const RANK_COLOR: Record<number, string> = { 1: "#FFD400", 2: "#E6E6E6", 3: "#F0913A", 4: "#FFFFFF", 5: "#FFFFFF" };
const stroke = (w: number): React.CSSProperties => ({
  WebkitTextStroke: `${w}px #000`, paintOrder: "stroke fill",
  textShadow: "0 6px 18px rgba(0,0,0,.55)", fontFamily: "Anton", textTransform: "uppercase",
});

const ClipLayer: React.FC<{ src: string }> = ({ src }) => {
  const f = useCurrentFrame();
  const punch = interpolate(f, [0, 8], [1.08, 1], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {/* bulanık arka plan: yatay klipleri de dolu gösterir */}
      <OffthreadVideo src={staticFile(src)} muted
        style={{ width: "100%", height: "100%", objectFit: "cover", filter: "blur(40px) brightness(.55)", transform: "scale(1.2)" }} />
      <AbsoluteFill style={{ transform: `scale(${punch})` }}>
        <OffthreadVideo src={staticFile(src)} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const Ranking: React.FC<RankingData> = ({ title, items }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const seg = Math.min(items.length - 1, Math.floor(f / CLIP));
  const n = items.length;

  // başlık: ilk 1 sn büyük, sonra yerine oturur
  const tIn = spring({ frame: f, fps, config: { damping: 12 } });
  const tScale = interpolate(f, [0, 22, 32], [1.35, 1.35, 1], { extrapolateRight: "clamp" }) * (0.7 + 0.3 * tIn);

  // CTA: son klip (#1) başlamadan 50 kare önce → #1 başladıktan 8 kare sonra
  const ctaStart = (n - 1) * CLIP - 50, ctaEnd = (n - 1) * CLIP + 8;
  const ctaOn = f >= ctaStart && f < ctaEnd;
  const cta = spring({ frame: f - ctaStart, fps, config: { damping: 9 } });

  const flash = interpolate(f % CLIP, [0, 3], [0.85, 0], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {items.map((it, i) => (
        <Sequence key={it.rank} from={i * CLIP} durationInFrames={CLIP}>
          <ClipLayer src={it.clip} />
          <Sequence from={0}><Audio src={staticFile("sfx/whoosh.wav")} volume={0.7} /></Sequence>
          <Sequence from={6}><Audio src={staticFile("sfx/hit.wav")} volume={0.6} /></Sequence>
          {it.rank === 1 && <Sequence from={4}><Audio src={staticFile("sfx/boom.wav")} volume={0.9} /></Sequence>}
        </Sequence>
      ))}

      {/* üst karartma: metin okunurluğu */}
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(0,0,0,.65) 0%, rgba(0,0,0,0) 32%)" }} />

      {/* başlık */}
      <div style={{ position: "absolute", top: 150, width: "100%", textAlign: "center", transform: `scale(${tScale})`, lineHeight: 1.02 }}>
        <div style={{ ...stroke(10), fontSize: 64, color: "#FFD400" }}>{title[0]}</div>
        <div style={{ ...stroke(12), fontSize: 104, color: "#fff" }}>{title[1]}</div>
      </div>

      {/* sıralama listesi: 1 üstte → 5 altta */}
      {[1, 2, 3, 4, 5].slice(0, n).map((rank, row) => {
        const idx = items.findIndex((x) => x.rank === rank);
        const shownAt = idx * CLIP + 6;
        const revealed = f >= shownAt;
        const active = idx === seg;
        const pop = spring({ frame: f - shownAt, fps, config: { damping: 10, stiffness: 180 } });
        const pulse = active ? 1 + 0.06 * Math.sin((f / fps) * Math.PI * 4) : 1;
        return (
          <div key={rank} style={{ position: "absolute", left: 40, top: 470 + row * 150, display: "flex", alignItems: "center", gap: 22 }}>
            <div style={{ ...stroke(10), fontSize: 110, color: RANK_COLOR[rank], width: 110, transform: `scale(${pulse})` }}>{rank}.</div>
            <div style={{ ...stroke(9), fontSize: 62, color: "#fff", maxWidth: 760, whiteSpace: "nowrap",
              transform: `scale(${revealed ? pop : 1})`, transformOrigin: "left center", opacity: revealed ? 1 : 0.9 }}>
              {revealed ? items[idx].label : rank === 1 ? "???" : ""}
            </div>
          </div>
        );
      })}

      {/* kaynak etiketi */}
      <div style={{ position: "absolute", left: 40, top: 1440, ...stroke(5), fontSize: 34, color: "rgba(255,255,255,.85)", textTransform: "none" }}>
        via @{items[seg].credit}
      </div>

      {/* SUBSCRIBE CTA */}
      {ctaOn && (
        <div style={{ position: "absolute", top: 1180, width: "100%", display: "flex", flexDirection: "column", alignItems: "center",
          transform: `scale(${0.5 + 0.5 * cta}) rotate(-3deg)` }}>
          <div style={{ background: "#FF0033", borderRadius: 26, padding: "14px 44px", border: "6px solid #000" }}>
            <span style={{ ...stroke(0), textShadow: "none", fontSize: 82, color: "#fff" }}>SUBSCRIBE</span>
          </div>
          <div style={{ ...stroke(9), fontSize: 58, color: "#FFD400", marginTop: 14 }}>#1 IS INSANE</div>
        </div>
      )}

      {/* kesme flaşı */}
      <AbsoluteFill style={{ backgroundColor: "#fff", opacity: f < 3 ? 0 : flash, pointerEvents: "none" }} />
    </AbsoluteFill>
  );
};
