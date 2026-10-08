import React from "react";
import { AbsoluteFill, Audio, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig,
  continueRender, delayRender, Easing } from "remotion";

export type CallData = {
  slug: string; seconds: number;
  events: Record<string, number>;
  cues: [number, number, string][];
  sfx: [string, number, number][];
  vo?: string; // kaydedilen seslendirme, ör. "vo/offside-past-keeper.wav" (0. saniyeden başlar)
};

const font = new FontFace("Anton", `url(${staticFile("fonts/Anton.woff2")})`);
const h = delayRender("font");
font.load().then(() => { document.fonts.add(font); continueRender(h); });

// Saha: üstten görünüm, rakip yarı saha. Orijin kale çizgisinin ortası, y orta çizgiye doğru artar (metre).
const S = 15, GL = 430, CX = 540, HALF = 52.5;
const X = (m: number) => CX + m * S;
const Y = (m: number) => GL + m * S;
type Pt = [number, number];
const ATT = "#2F7BFF", DEF = "#FF7A1A", LINE = "#FFE14D", OFF = "#FF3B4E", ON = "#22C55E";

// P: pas anı, E: oyun akışında vardığı yer
type Player = { id: string; team: "A" | "D"; label: string; P: Pt; E: Pt };
const PLAYERS: Player[] = [
  { id: "B9", team: "A", label: "9", P: [5, 9], E: [4.5, 7.5] },
  { id: "B10", team: "A", label: "10", P: [-9, 24], E: [-8, 19] },
  { id: "B7", team: "A", label: "7", P: [17, 21], E: [13, 15] },
  { id: "B11", team: "A", label: "11", P: [-20, 31], E: [-17, 25] },
  { id: "LD", team: "D", label: "4", P: [2, 0.8], E: [0.4, 0.5] },
  { id: "GK", team: "D", label: "GK", P: [-1, 13.5], E: [-0.6, 9] },
  { id: "D5", team: "D", label: "5", P: [-14, 20], E: [-11, 15] },
  { id: "D3", team: "D", label: "3", P: [12, 25], E: [10, 19.5] },
  { id: "D6", team: "D", label: "6", P: [3, 29], E: [3, 23] },
  { id: "D2", team: "D", label: "2", P: [-25, 32], E: [-21, 27] },
];
const FEET: Pt = [-8.2, 23];
const RB: Pt = [4.1, 6.6]; // 9 numaranın topu oynadığı nokta
const NET: Pt = [-2.6, -1.4];
const SECOND_LAST_Y = 13.5; // kaleci, pas anında

const lerp = (a: Pt, b: Pt, k: number): Pt => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
const prog = (t: number, s: number, e: number, ease = Easing.inOut(Easing.cubic)) =>
  interpolate(t, [s, e], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
const between = (t: number, s: number, e: number) => t >= s && t < e;

const txt = (w: number): React.CSSProperties => ({
  WebkitTextStroke: `${w}px #000`, paintOrder: "stroke fill", fontFamily: "Anton",
  textShadow: "0 4px 14px rgba(0,0,0,.45)", textTransform: "uppercase", letterSpacing: 1, lineHeight: 1.02,
});
const inter = (size: number, weight = 800): React.CSSProperties => ({ fontFamily: "Inter", fontWeight: weight, fontSize: size });

const Pitch: React.FC = () => {
  const stripes = Array.from({ length: 10 }, (_, i) => i);
  const arcDx = Math.sqrt(9.15 ** 2 - 5.5 ** 2);
  const ln = { stroke: "rgba(255,255,255,.9)", strokeWidth: 4, fill: "none" };
  return (
    <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
      {stripes.map((i) => (
        <rect key={i} x={X(-34)} y={Y(i * 5.25)} width={68 * S} height={5.25 * S + 0.5} fill={i % 2 ? "#2C8A3E" : "#319746"} />
      ))}
      <rect x={X(-34)} y={Y(0)} width={68 * S} height={HALF * S} {...ln} />
      <rect x={X(-20.16)} y={Y(0)} width={40.32 * S} height={16.5 * S} {...ln} />
      <rect x={X(-9.16)} y={Y(0)} width={18.32 * S} height={5.5 * S} {...ln} />
      <circle cx={X(0)} cy={Y(11)} r={4} fill="#fff" />
      <path d={`M ${X(-arcDx)} ${Y(16.5)} A ${9.15 * S} ${9.15 * S} 0 0 0 ${X(arcDx)} ${Y(16.5)}`} {...ln} />
      <path d={`M ${X(-9.15)} ${Y(HALF)} A ${9.15 * S} ${9.15 * S} 0 0 1 ${X(9.15)} ${Y(HALF)}`} {...ln} />
      <path d={`M ${X(-33)} ${Y(0)} A ${S} ${S} 0 0 0 ${X(-34)} ${Y(1)}`} {...ln} />
      <path d={`M ${X(33)} ${Y(0)} A ${S} ${S} 0 0 1 ${X(34)} ${Y(1)}`} {...ln} />
      {/* kale */}
      <rect x={X(-3.66)} y={Y(-2)} width={7.32 * S} height={2 * S} fill="rgba(255,255,255,.12)" stroke="#fff" strokeWidth={4} />
      {Array.from({ length: 9 }, (_, i) => (
        <line key={i} x1={X(-3.66 + (i + 1) * 0.732)} y1={Y(-2)} x2={X(-3.66 + (i + 1) * 0.732)} y2={Y(0)} stroke="rgba(255,255,255,.35)" strokeWidth={1.5} />
      ))}
    </svg>
  );
};

const Badge: React.FC<{ x: number; y: number; at: number; color: string; children: React.ReactNode; align?: "left" | "right"; small?: boolean }> =
  ({ x, y, at, color, children, align = "left", small }) => {
    const f = useCurrentFrame();
    const { fps } = useVideoConfig();
    const s = spring({ frame: f - Math.round(at * fps), fps, config: { damping: 12, stiffness: 180 } });
    if (f < at * fps) return null;
    return (
      <div style={{ position: "absolute", top: y, left: align === "left" ? x : undefined, right: align === "right" ? 1080 - x : undefined,
        transform: `translateY(-50%) scale(${s})`, transformOrigin: align === "left" ? "left center" : "right center",
        background: color, color: "#111", padding: "8px 18px", borderRadius: 14, whiteSpace: "nowrap",
        boxShadow: "0 6px 18px rgba(0,0,0,.35)", ...inter(small ? 29 : 34, 900) }}>{children}</div>
    );
  };

const Check: React.FC<{ at: number; t: number; children: React.ReactNode }> = ({ at, t, children }) => {
  const k = prog(t, at, at + 0.25, Easing.out(Easing.back(2)));
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 18, opacity: t >= at ? 1 : 0.25,
      ...inter(40, 800), color: "#fff", textShadow: "0 3px 10px rgba(0,0,0,.6)" }}>
      <div style={{ width: 46, height: 46, borderRadius: 23, background: t >= at ? ON : "rgba(255,255,255,.2)",
        display: "flex", alignItems: "center", justifyContent: "center", transform: `scale(${t >= at ? k : 1})` }}>
        <svg width={28} height={28} viewBox="0 0 24 24"><path d="M4 12.5l5 5L20 6.5" stroke="#fff" strokeWidth={3.6} fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </div>
      {children}
    </div>
  );
};

const KEY = new Set(["keeper", "keeper.", "keeper?", "goal?", "no", "offside", "second-last", "second-last:", "two", "last:", "11", "level"]);
const Caption: React.FC<{ cues: CallData["cues"]; t: number }> = ({ cues, t }) => {
  const { fps } = useVideoConfig();
  const cue = cues.find(([s, e]) => t >= s && t < e);
  if (!cue) return null;
  const pop = spring({ frame: Math.round((t - cue[0]) * fps), fps, config: { damping: 14, stiffness: 220 } });
  return (
    <div style={{ position: "absolute", top: 1290, left: 90, width: 900, textAlign: "center",
      transform: `scale(${0.85 + 0.15 * pop})`, ...inter(62, 900), color: "#fff", lineHeight: 1.15,
      WebkitTextStroke: "12px #000", paintOrder: "stroke fill" }}>
      {cue[2].split(" ").map((w, i) => (
        <span key={i} style={{ color: KEY.has(w.toLowerCase().replace(/[,]/g, "")) ? LINE : "#fff" }}>{w} </span>
      ))}
    </div>
  );
};

export const Call: React.FC<CallData> = ({ events: ev, cues, sfx, vo }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = f / fps;

  const posOf = (p: Player): Pt => {
    if (t < ev.pass) return p.P;
    if (t < ev.rewind) return lerp(p.P, p.E, prog(t, ev.pass, p.id === "B9" ? ev.receive : ev.net + 0.3));
    if (t < ev.freeze) return lerp(p.E, p.P, prog(t, ev.rewind, ev.freeze));
    if (p.id === "B9" && t >= ev.replayPass) return lerp(p.P, p.E, prog(t, ev.replayPass, ev.touch));
    return p.P;
  };
  const ball = ((): Pt => {
    if (t < ev.pass) return FEET;
    if (t < ev.receive) return lerp(FEET, RB, prog(t, ev.pass, ev.receive, Easing.out(Easing.quad)));
    if (t < ev.shot) return RB;
    if (t < ev.net) return lerp(RB, NET, prog(t, ev.shot, ev.net, Easing.out(Easing.quad)));
    if (t < ev.rewind) return NET;
    if (t < ev.freeze) {
      const k = prog(t, ev.rewind, ev.freeze, Easing.linear);
      return k < 0.4 ? lerp(NET, RB, k / 0.4) : lerp(RB, FEET, (k - 0.4) / 0.6);
    }
    if (t >= ev.replayPass) return lerp(FEET, RB, prog(t, ev.replayPass, ev.touch, Easing.out(Easing.quad)));
    return FEET;
  })();

  const frozen = t >= ev.freeze && t < ev.ruleCard;
  const rewinding = between(t, ev.rewind, ev.freeze);
  const flash = t < ev.freeze ? 0 : interpolate(t, [ev.freeze, ev.freeze + 0.25], [0.75, 0], { extrapolateRight: "clamp" });
  const netFlash = t < ev.net ? 0 : interpolate(t, [ev.net, ev.net + 0.4], [0.8, 0], { extrapolateRight: "clamp" });
  const stampK = t - ev.noGoal;
  const shake = stampK >= 0 && stampK < 0.2 ? (Math.round(stampK * fps) % 2 ? 7 : -7) : 0;

  // odak: rakipleri sayarken hücumcular soluklaşır, 9 numara sonra geri gelir
  const opacityOf = (p: Player) => {
    if (t < ev.countOpponents || t >= ev.ruleCard) return 1;
    if (p.team === "D") return p.id === "LD" || p.id === "GK" ? 1 : 0.55;
    if (p.id === "B9") return t >= ev.checkHalf ? 1 : 0.4;
    return 0.35;
  };

  const lineK = prog(t, ev.offsideLine, ev.offsideLine + 0.9);
  const showLine = t >= ev.offsideLine && t < ev.ruleCard;
  const zoneK = prog(t, ev.offsideLine + 0.7, ev.offsideLine + 1.1);
  const dimCard = prog(t, ev.ruleCard, ev.ruleCard + 0.35);

  const ring = (id: string, s: number, e: number, color: string) => {
    if (!between(t, s, e)) return null;
    const p = PLAYERS.find((q) => q.id === id)!;
    const [x, y] = posOf(p);
    const k = ((t - s) % 0.8) / 0.8;
    return (
      <g key={id + s}>
        <circle cx={X(x)} cy={Y(y)} r={30 + 26 * k} fill="none" stroke={color} strokeWidth={6} opacity={1 - k} />
        <circle cx={X(x)} cy={Y(y)} r={31} fill="none" stroke={color} strokeWidth={5} />
      </g>
    );
  };

  // üst bant
  let chip: string | null = null, chipColor = "#fff";
  let main: React.ReactNode = null;
  if (t < ev.rewind) {
    chip = "YOU MAKE THE CALL";
    main = <div style={{ ...txt(10), fontSize: 116, color: LINE }}>GOAL OR<br />NO GOAL?</div>;
  } else if (t < ev.freeze) {
    chip = "REWIND";
  } else if (t < ev.ruleCard) {
    chip = "PAUSED AT THE PASS"; chipColor = LINE;
    if (between(t, ev.countOpponents, ev.checkHalf))
      main = <div style={{ ...txt(8), fontSize: 92, color: "#fff" }}>COUNT THE OPPONENTS<br /><span style={{ color: LINE }}>FROM THE GOAL LINE</span></div>;
    else if (between(t, ev.checkHalf, ev.replayPass))
      main = (
        <div style={{ display: "flex", flexDirection: "column", gap: 14, alignItems: "flex-start" }}>
          <Check at={ev.checkHalf} t={t}>In the opponents' half</Check>
          <Check at={ev.checkBall} t={t}>Nearer the goal line than the ball</Check>
          <Check at={ev.checkSecondLast} t={t}>Nearer than the 2nd-last opponent</Check>
        </div>
      );
    else if (between(t, ev.replayPass, ev.ifk))
      main = <div style={{ ...txt(8), fontSize: 96, color: "#fff" }}>HE PLAYS THE BALL<br /><span style={{ color: OFF }}>= OFFSIDE OFFENCE</span></div>;
    else if (t >= ev.ifk)
      main = <div style={{ ...txt(8), fontSize: 96, color: "#fff" }}>INDIRECT FREE KICK<br /><span style={{ color: DEF }}>TO THE DEFENDING TEAM</span></div>;
  } else if (t < ev.outro) {
    chip = "THE RULE"; chipColor = LINE;
    main = <div style={{ ...txt(8), fontSize: 104, color: "#fff" }}>BEATING THE KEEPER<br /><span style={{ color: OFF }}>ISN'T ENOUGH</span></div>;
  } else {
    main = <div style={{ ...txt(10), fontSize: 120, color: LINE }}>DID YOU GET<br />IT RIGHT?</div>;
  }

  const callK = (at: number) => spring({ frame: f - Math.round(at * fps), fps, config: { damping: 11, stiffness: 170 } });
  const pulse = (ph: number) => 1 + 0.04 * Math.sin((t - ev.callButtons) * 7 + ph);

  return (
    <AbsoluteFill style={{ background: "#0B1610" }}>
      <div style={{ position: "absolute", inset: 0, transform: `translate(${shake}px, ${shake * 0.5}px)`,
        filter: rewinding ? "saturate(.35) contrast(1.1)" : undefined }}>
        <Pitch />
        <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
          {/* gol anında file parlaması */}
          <rect x={X(-3.66)} y={Y(-2)} width={7.32 * S} height={2 * S} fill="#fff" opacity={netFlash} />
          {/* ofsayt bölgesi ve çizgisi: pas anındaki sondan ikinci rakip */}
          {showLine && (
            <>
              <rect x={X(-34)} y={Y(0)} width={68 * S} height={SECOND_LAST_Y * S} fill={OFF} opacity={0.2 * zoneK} />
              <line x1={X(-34)} y1={Y(SECOND_LAST_Y)} x2={X(-34) + 68 * S * lineK} y2={Y(SECOND_LAST_Y)}
                stroke={LINE} strokeWidth={7} style={{ filter: `drop-shadow(0 0 8px ${LINE})` }} />
            </>
          )}
          {/* top çizgisi */}
          {between(t, ev.checkBall, ev.replayPass) && (
            <line x1={X(-34)} y1={Y(FEET[1])} x2={X(34)} y2={Y(FEET[1])} stroke="#fff" strokeWidth={4} strokeDasharray="18 14"
              opacity={prog(t, ev.checkBall, ev.checkBall + 0.3)} />
          )}
          {/* pas oku: donmuş karede olacak pası gösterir */}
          {between(t, ev.freeze + 0.2, ev.replayPass) && (
            <>
              <defs>
                <marker id="ah" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
                  <path d="M0,0 L6,3 L0,6 z" fill="#fff" />
                </marker>
              </defs>
              <line x1={X(FEET[0]) + 18} y1={Y(FEET[1]) - 14} x2={X(RB[0]) - 22} y2={Y(RB[1]) + 22} stroke="#fff"
                strokeWidth={5} strokeDasharray="14 12" markerEnd="url(#ah)" opacity={0.85} />
            </>
          )}
          {/* 9'un ofsayt çizgisine göre farkı */}
          {between(t, ev.checkSecondLast, ev.replayPass) && (
            <g opacity={prog(t, ev.checkSecondLast, ev.checkSecondLast + 0.3)}>
              <line x1={X(9.5)} y1={Y(9)} x2={X(9.5)} y2={Y(SECOND_LAST_Y)} stroke={LINE} strokeWidth={5} />
              <line x1={X(9.5) - 14} y1={Y(9)} x2={X(9.5) + 14} y2={Y(9)} stroke={LINE} strokeWidth={5} />
              <line x1={X(9.5) - 14} y1={Y(SECOND_LAST_Y)} x2={X(9.5) + 14} y2={Y(SECOND_LAST_Y)} stroke={LINE} strokeWidth={5} />
            </g>
          )}
          {/* oyuncular */}
          {PLAYERS.map((p) => {
            const [x, y] = posOf(p);
            return (
              <g key={p.id} opacity={opacityOf(p)}>
                <circle cx={X(x)} cy={Y(y) + 4} r={23} fill="rgba(0,0,0,.35)" />
                <circle cx={X(x)} cy={Y(y)} r={23} fill={p.team === "A" ? ATT : DEF} stroke="#fff" strokeWidth={p.id === "GK" ? 5 : 3} />
                <text x={X(x)} y={Y(y) + (p.label === "GK" ? 8 : 9)} textAnchor="middle" fill="#fff"
                  style={{ ...inter(p.label === "GK" ? 20 : 24, 900) }}>{p.label}</text>
              </g>
            );
          })}
          {ring("GK", ev.ringKeeper, ev.ringLineDefender, "#fff")}
          {ring("LD", ev.ringLineDefender, ev.pass, "#fff")}
          {ring("B9", ev.touch, ev.noGoal + 0.4, OFF)}
          {/* top */}
          {(() => {
            const pass = between(t, ev.pass, ev.net) || between(t, ev.replayPass, ev.touch);
            const from = t < ev.shot || t >= ev.replayPass ? FEET : RB;
            return (
              <>
                {pass && <line x1={X(from[0])} y1={Y(from[1])} x2={X(ball[0])} y2={Y(ball[1])} stroke="#fff" strokeWidth={5} opacity={0.45} strokeLinecap="round" />}
                <circle cx={X(ball[0])} cy={Y(ball[1])} r={11} fill="#fff" stroke="#111" strokeWidth={3.5} />
              </>
            );
          })()}
          {/* serbest vuruş noktası */}
          {t >= ev.ifk && t < ev.ruleCard && (
            <g transform={`translate(${X(RB[0])} ${Y(RB[1])}) scale(${prog(t, ev.ifk, ev.ifk + 0.3, Easing.out(Easing.back(2)))})`}>
              <circle r={36} fill="none" stroke={DEF} strokeWidth={6} />
              <path d="M-12,-12 L12,12 M12,-12 L-12,12" stroke={DEF} strokeWidth={6} strokeLinecap="round" />
            </g>
          )}
        </svg>

        {/* saha üstü etiketler */}
        {t >= ev.badgeLast && t < ev.ruleCard && <Badge x={X(2) + 34} y={Y(0.8) + 6} at={ev.badgeLast} color="#fff">1 · LAST</Badge>}
        {t >= ev.badgeSecondLast && t < ev.ruleCard && <Badge x={X(-1) - 34} y={Y(13.5) + 44} at={ev.badgeSecondLast} color="#fff" align="right">2 · SECOND-LAST</Badge>}
        {showLine && lineK > 0.6 && (
          <div style={{ position: "absolute", left: 44, top: Y(SECOND_LAST_Y) - 52, ...inter(30, 900), color: LINE,
            textShadow: "0 2px 8px rgba(0,0,0,.8)", opacity: prog(t, ev.offsideLine + 0.5, ev.offsideLine + 0.8) }}>OFFSIDE LINE</div>
        )}
        {between(t, ev.checkBall, ev.replayPass) && (
          <div style={{ position: "absolute", left: 44, top: Y(FEET[1]) - 48, ...inter(30, 900), color: "#fff",
            textShadow: "0 2px 8px rgba(0,0,0,.8)" }}>BALL</div>
        )}
        {between(t, ev.checkHalf, ev.replayPass) && (
          <div style={{ position: "absolute", left: 44, top: Y(HALF) - 50, ...inter(30, 900), color: "#fff",
            textShadow: "0 2px 8px rgba(0,0,0,.8)" }}>▲ OPPONENTS' HALF</div>
        )}
        {t >= ev.offsidePosition && t < ev.replayPass && <Badge x={X(5) + 32} y={Y(9) - 4} small at={ev.offsidePosition} color={OFF}>
          <span style={{ color: "#fff" }}>OFFSIDE POSITION</span></Badge>}
        {t >= ev.ifk && t < ev.ruleCard && <Badge x={X(RB[0]) + 48} y={Y(RB[1])} at={ev.ifk} color={DEF}>OFFENCE HERE</Badge>}
        <div style={{ position: "absolute", left: 40, top: Y(HALF) + 12, ...inter(22, 600), color: "rgba(255,255,255,.55)" }}>
          Illustration · IFAB Laws of the Game, Law 11
        </div>

        {/* karar butonları */}
        {between(t, ev.callButtons, ev.rewind) && (
          <div style={{ position: "absolute", top: 930, left: 0, width: 1080, display: "flex", justifyContent: "center", gap: 40 }}>
            {[["GOAL", ON, 0], ["NO GOAL", OFF, 0.12]].map(([label, color, d]) => (
              <div key={label as string} style={{ transform: `scale(${callK(ev.callButtons + (d as number)) * pulse(d ? Math.PI : 0)})`,
                background: color as string, color: "#fff", padding: "22px 46px", borderRadius: 26, border: "6px solid #fff",
                boxShadow: "0 10px 30px rgba(0,0,0,.45)", ...txt(0), fontSize: 84 }}>{label}</div>
            ))}
          </div>
        )}

        {/* NO GOAL damgası */}
        {t >= ev.noGoal && t < ev.ruleCard && (
          <div style={{ position: "absolute", top: 860, left: 0, width: 1080, display: "flex", justifyContent: "center" }}>
            <div style={{ transform: `rotate(-6deg) scale(${interpolate(stampK, [0, 0.12], [1.8, 1], { extrapolateRight: "clamp" })})`,
              opacity: interpolate(stampK, [0, 0.08], [0, 1], { extrapolateRight: "clamp" }),
              border: `10px solid ${OFF}`, borderRadius: 24, padding: "10px 40px", background: "rgba(0,0,0,.55)", textAlign: "center" }}>
              <div style={{ ...txt(0), fontSize: 150, color: OFF }}>NO GOAL</div>
              <div style={{ ...inter(44, 900), color: "#fff", letterSpacing: 6, marginTop: -6 }}>OFFSIDE</div>
            </div>
          </div>
        )}

        {/* kural kartı */}
        {t >= ev.ruleCard && (
          <>
            <div style={{ position: "absolute", left: X(-34), top: Y(-2.2), width: 68 * S, height: (HALF + 2.2) * S, background: "#000", opacity: 0.62 * dimCard }} />
            <div style={{ position: "absolute", left: 80, top: 560, width: 920, opacity: dimCard,
              transform: `translateY(${(1 - dimCard) * 40}px)`, background: "rgba(14,24,18,.96)", border: `4px solid ${LINE}`,
              borderRadius: 32, padding: "34px 40px", boxShadow: "0 20px 60px rgba(0,0,0,.5)" }}>
              <svg width={840} height={300} viewBox="0 0 840 300">
                <rect width={840} height={300} rx={18} fill="#2C8A3E" />
                <line x1={0} y1={30} x2={840} y2={30} stroke="#fff" strokeWidth={5} />
                <text x={20} y={22} fill="#fff" style={inter(20, 800)}>GOAL LINE</text>
                <circle cx={430} cy={74} r={22} fill={DEF} stroke="#fff" strokeWidth={3} />
                <text x={430} y={83} textAnchor="middle" fill="#fff" style={inter(24, 900)}>1</text>
                <circle cx={470} cy={200} r={22} fill={DEF} stroke="#fff" strokeWidth={3} />
                <text x={470} y={209} textAnchor="middle" fill="#fff" style={inter(24, 900)}>2</text>
                <line x1={0} y1={200} x2={840} y2={200} stroke={LINE} strokeWidth={5} strokeDasharray="16 10" />
                <text x={20} y={240} fill={LINE} style={inter(22, 800)}>2ND-LAST OPPONENT</text>
                <circle cx={680} cy={200} r={22} fill={ATT} stroke="#fff" strokeWidth={3} />
                <text x={680} y={262} textAnchor="middle" fill={ON} style={inter(30, 900)}>LEVEL = ONSIDE</text>
                <circle cx={190} cy={110} r={22} fill={ATT} stroke="#fff" strokeWidth={3} />
                <text x={190} y={166} textAnchor="middle" fill={OFF} style={inter(30, 900)}>OFFSIDE POSITION</text>
              </svg>
              <div style={{ ...inter(44, 800), color: "#fff", marginTop: 26, lineHeight: 1.25, textAlign: "center" }}>
                At the pass you need <span style={{ color: LINE }}>2 opponents</span><br />level with you or nearer the goal line.
              </div>
            </div>
          </>
        )}

        {/* donma efekti */}
        {frozen && <div style={{ position: "absolute", left: X(-34) - 3, top: Y(-2.2), width: 68 * S + 6, height: (HALF + 2.2) * S,
          border: `6px solid ${LINE}`, borderRadius: 6, boxSizing: "border-box" }} />}
        <div style={{ position: "absolute", inset: 0, background: "#fff", opacity: flash }} />
      </div>

      {/* üst bant */}
      <div style={{ position: "absolute", top: 56, left: 40, width: 1000, height: 330, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "flex-start", gap: 14, textAlign: "center" }}>
        {chip && (
          <div style={{ display: "flex", alignItems: "center", gap: 12, background: "rgba(0,0,0,.55)", color: chipColor,
            border: `3px solid ${chipColor}`, borderRadius: 40, padding: "8px 24px", ...inter(30, 900), letterSpacing: 2 }}>
            {chip === "REWIND" && <svg width={40} height={24} viewBox="0 0 40 24"><path d="M20 0 L0 12 L20 24 z M40 0 L20 12 L40 24 z" fill={chipColor} /></svg>}
            {chip === "PAUSED AT THE PASS" && <svg width={20} height={24} viewBox="0 0 20 24"><rect width={7} height={24} fill={chipColor} /><rect x={13} width={7} height={24} fill={chipColor} /></svg>}
            {chip}
          </div>
        )}
        {main}
      </div>

      <Caption cues={cues} t={t} />

      {vo && <Audio src={staticFile(vo)} />}
      {sfx.map(([name, at, vol], i) => (
        <Sequence key={i} from={Math.round(at * fps)} layout="none">
          <Audio src={staticFile(`sfx/${name}.wav`)} volume={vol} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
