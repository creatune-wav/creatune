# Kullanım: python tools/psych_build.py data/<slug>.script.json
# Önce tools/vo_tr.py ile satır seslerini üret. Bu araç:
#  1) zaman çizelgesini + kelime kelime altyazı zamanlarını çıkarır  -> src/data/<slug>.json
#  2) müzik + SFX + seslendirme miksini sentezler                       -> public/mix/<slug>.wav
import json, os, re, sys
import numpy as np, soundfile as sf
from scipy.signal import fftconvolve, butter, sosfilt

SR, FPS = 48000, 30
sc = json.load(open(sys.argv[1], encoding="utf-8"))
slug = sc["slug"]
rng = np.random.default_rng(7)

# ---------- 1) zaman çizelgesi ----------
LEAD = 0.12
t = LEAD
lines = []
for ln in sc["lines"]:
    y, sr = sf.read(f"public/vo/{slug}/{ln['id']}.wav", dtype="float32")
    assert sr == SR
    lines.append({**ln, "audio": y, "start": t, "dur": len(y) / SR})
    t += len(y) / SR + ln["gap"]
TOTAL = t
L = {x["id"]: x for x in lines}
R = sc.get("roles", {})
IMPACT = None
if R.get("impact"):
    il = L[R["impact"]["after"]]
    IMPACT = il["start"] + il["dur"] + R["impact"].get("pad", 0.38)   # cümle + nefes kadar sessizlik

def tr_upper(s):
    return s.replace("i", "İ").replace("ı", "I").upper()

def voiced_segments(y, min_gap=0.11):
    # 10 ms pencerelerde enerji; min_gap'ten uzun sessizlikler ifadeleri ayırır
    hop = SR // 100
    e = np.array([np.sqrt(np.mean(y[i:i + hop] ** 2)) for i in range(0, len(y) - hop, hop)])
    on = e > max(e.max() * 0.06, 1e-4)
    segs, cur, quiet = [], None, 0
    for i, v in enumerate(on):
        if v:
            if cur is None: cur = [i, i]
            cur[1] = i; quiet = 0
        elif cur is not None:
            quiet += 1
            if quiet * 0.01 >= min_gap: segs.append(cur); cur = None
    if cur: segs.append(cur)
    return [(a * 0.01, (b + 1) * 0.01) for a, b in segs]

def syl(w):  # Türkçede hece ≈ ünlü sayısı
    return max(1, len(re.findall(r"[aeıioöuüAEIİOÖUÜ0-9]", w)))

words = []
for ln in lines:
    toks = ln["cap"].replace("...", "… ").split()
    # ifadeler: noktalama ile biten kelimelerde böl
    phrases, cur = [], []
    for w in toks:
        cur.append(w)
        if re.search(r"[,.:;!?…\"]$", w): phrases.append(cur); cur = []
    if cur: phrases.append(cur)
    segs = voiced_segments(ln["audio"])
    if len(segs) != len(phrases):  # eşleşmezse: tüm satırı tek ifade gibi, hecelere göre dağıt
        segs = [(segs[0][0], segs[-1][1])] if segs else [(0, ln["dur"])]
        phrases = [[w for p in phrases for w in p]]
    for ph, (a, b) in zip(phrases, segs):
        tot = sum(syl(w) for w in ph)
        acc = a
        for w in ph:
            d = (b - a) * syl(w) / tot
            hl = w.startswith("*")
            clean = w.replace("*", "").replace("…", "").strip()
            if clean:
                words.append({"w": tr_upper(clean), "s": round(ln["start"] + acc, 3), "e": round(ln["start"] + acc + d, 3),
                              "hl": hl, "line": ln["id"]})
            acc += d

# kalp atışları: roles.beats.from başından roles.beats.to sonuna, bpm0 -> bpm1
beats = []
if R.get("beats"):
    B = R["beats"]
    hb0 = L[B["from"]]["start"] + 0.2
    hb1 = L[B["to"]]["start"] + L[B["to"]]["dur"] + 0.05
    bt = hb0
    while bt < hb1:
        beats.append(round(bt, 3))
        k = (bt - hb0) / (hb1 - hb0)
        bt += 60 / (B["bpm"][0] + (B["bpm"][1] - B["bpm"][0]) * k ** 1.4)
if R.get("end_beats"):
    beats += [round(L[R["end_beats"]]["start"] + 0.25, 3), round(L[R["end_beats"]]["start"] + 1.05, 3)]

# işaretler: belirli bir kelimenin başladığı an (görsel + ses olayı)
marks = {}
for name, m in sc.get("marks", {}).items():
    ln = L[m["line"]]
    marks[name] = next((w["s"] for w in words if w["line"] == m["line"] and w["w"].startswith(m["word"])),
                       ln["start"] + ln["dur"] * 0.5)
TYPE_RATE = 0.045   # HUD daktilo: karakter başına sn
TYPE = R.get("type")
TYPE_START = L[TYPE["line"]]["start"] + 0.05 if TYPE else 0
HUD = TYPE["hud"] if TYPE else []

f = lambda s: int(round(s * FPS))
scenes = []
for ln in lines:
    if ln.get("img") is None: continue   # önceki sahne devam eder
    scenes.append({"id": ln["id"], "from": f(ln["start"] - (0.12 if ln is not lines[0] else LEAD)), "img": ln["img"],
                   "a": ln["a"], "b": ln["b"], "fx": ln["fx"], "opt": ln.get("opt", {})})
if IMPACT is not None:
    imp = R["impact"]["scene"]
    scenes.append({"id": "impact", "from": f(IMPACT), "img": imp["img"], "a": imp["a"], "b": imp["b"], "fx": imp["fx"], "opt": {}})
scenes.sort(key=lambda s: s["from"])
for i, s in enumerate(scenes):
    s["to"] = scenes[i + 1]["from"] if i + 1 < len(scenes) else f(TOTAL)
    s["frames"] = s["to"] - s["from"]
    s["img"] = f"img/{slug}/{s['img']}.jpg"

out = {"slug": slug, "series": sc["series"], "fps": FPS, "frames": f(TOTAL), "scenes": scenes,
       "words": [{**w, "s": f(w["s"]), "e": f(w["e"])} for w in words],
       "beats": [f(b) for b in beats], "impact": f(IMPACT) if IMPACT is not None else -1,
       "marks": {k: f(v) for k, v in marks.items()}, **{k: f(v) for k, v in marks.items()},
       "typeStart": f(TYPE_START), "typeRate": TYPE_RATE * FPS, "hud": HUD,
       "audio": f"mix/{slug}.wav"}
json.dump(out, open(f"src/data/{slug}.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(f"timeline: {TOTAL:.2f}s, {len(words)} words, {len(beats)} beats, impact {IMPACT}")

# ---------- 2) ses tasarımı ----------
N = int((TOTAL + 0.5) * SR)
music = np.zeros((N, 2)); sfx = np.zeros((N, 2)); vo = np.zeros(N)
tt = lambda d: np.arange(int(d * SR)) / SR

def put(buf, x, at, gain=1.0, pan=0.0):
    i = int(at * SR)
    if x.ndim == 1: x = np.stack([x * (1 - max(pan, 0)), x * (1 + min(pan, 0))], 1)
    j = min(N, i + len(x))
    if j > i: buf[i:j] += x[: j - i] * gain

def lp(x, fc, order=2): return sosfilt(butter(order, fc, "low", fs=SR, output="sos"), x, axis=0)
def hp(x, fc, order=2): return sosfilt(butter(order, fc, "high", fs=SR, output="sos"), x, axis=0)
def bp(x, lo, hi): return sosfilt(butter(2, [lo, hi], "band", fs=SR, output="sos"), x, axis=0)

def reverb(x, sec=2.4, wet=0.35, pre=0.02):
    n = int(sec * SR); tn = np.arange(n) / SR
    irs = []
    for _ in range(2):
        ir = rng.standard_normal(n) * np.exp(-tn * 6.9 / sec)
        ir = lp(ir, 6000); ir[: int(pre * SR)] = 0; ir /= np.sqrt(np.sum(ir ** 2))
        irs.append(ir)
    mono = x if x.ndim == 1 else x.mean(1)
    w = np.stack([fftconvolve(mono, irs[0])[: len(mono)], fftconvolve(mono, irs[1])[: len(mono)]], 1)
    dry = x if x.ndim == 2 else np.stack([x, x], 1)
    return dry * (1 - wet) + w * wet * 1.4

def env_adsr(n, a, r):
    e = np.ones(n); ai, ri = int(a * SR), int(r * SR)
    if ai: e[:ai] = np.linspace(0, 1, ai)
    if ri: e[-ri:] *= np.linspace(1, 0, ri)
    return e

def saw(fr, d, cutoff=900):
    x = tt(d); y = np.zeros_like(x)
    for k in range(1, int(cutoff / fr) + 1): y += np.sin(2 * np.pi * fr * k * x + rng.uniform(0, 6.28)) / k
    return y

def heartbeat(gain=1.0):
    def thump(d=0.16, f0=62, f1=38):
        x = tt(d); fr = f1 + (f0 - f1) * np.exp(-x * 30)
        return np.sin(2 * np.pi * np.cumsum(fr) / SR) * np.exp(-x * 22)
    a = thump(); b = thump(0.14, 55, 35) * 0.7
    y = np.zeros(int(0.45 * SR)); y[: len(a)] += a; i = int(0.2 * SR); y[i: i + len(b)] += b
    return lp(y, 180) * gain * 1.6

def boom(d=2.4):
    x = tt(d); fr = 30 + 110 * np.exp(-x * 9)
    sub = np.sin(2 * np.pi * np.cumsum(fr) / SR) * np.exp(-x * 1.7)
    crack = hp(rng.standard_normal(len(x)), 1200) * np.exp(-x * 38) * 0.9
    body = lp(rng.standard_normal(len(x)), 400) * np.exp(-x * 6) * 0.8
    return np.tanh((sub * 1.3 + crack + body) * 1.6)

def whoosh(d=0.55, up=True):
    x = tt(d); n = rng.standard_normal(len(x))
    e = np.sin(np.pi * x / d) ** 2
    y = np.zeros_like(x)
    for i0 in range(0, len(x), 1024):  # kayan bant geçiren: merkez frekans zamanla kayar
        k = i0 / len(x); fc = 400 + 3200 * (k if up else 1 - k)
        y[i0:i0 + 1024] = bp(n[i0:i0 + 1024 + 0], fc * 0.55, min(fc * 1.7, 20000))
    y = lp(y, 7000) * e
    return y * 0.8

def click(d=0.025, fc=3000):
    x = tt(d); return bp(rng.standard_normal(len(x)), fc * 0.6, min(fc * 1.6, 20000)) * np.exp(-x * 260)

def mixs(*xs):  # farklı uzunluktaki sesleri topla
    y = np.zeros(max(len(x) for x in xs))
    for x in xs: y[:len(x)] += x
    return y

def type_key():
    return mixs(click(0.03, 2500) * 0.9, click(0.012, 6000) * 0.5)

def tick():
    x = tt(0.04); return mixs(np.sin(2 * np.pi * 2400 * x) * np.exp(-x * 160), click(0.02, 7000) * 0.4) * 0.6

def tape_stop(d=0.8, f0=147):
    x = tt(d); rate = (1 - x / d) ** 1.6
    ph = np.cumsum(f0 * rate) / SR * 2 * np.pi
    y = sum(np.sin(ph * k) / k for k in range(1, 9)) * (1 - x / d) ** 0.6
    return lp(y, 1500) * 0.7

def glitch(d=0.35):
    x = tt(d); y = rng.standard_normal(len(x))
    y = np.round(y * 3) / 3  # bitcrush
    gate = (np.floor(x * 38) % 2 == 0) * (rng.uniform(size=len(x)) > 0.0)
    sq = np.sign(np.sin(2 * np.pi * 180 * x)) * 0.5
    return hp((y * 0.6 + sq) * gate, 300) * 0.55

def reverse_swell(d=1.6):
    x = tt(d); n = rng.standard_normal(len(x))
    y = hp(n, 2500) * (x / d) ** 3 * 0.6
    tone = sum(np.sin(2 * np.pi * f * x) for f in (293.7, 311.1, 587.3)) * (x / d) ** 2.5 * 0.18
    return y + lp(tone, 4000)

def whistle(d=0.9):
    x = tt(d); fr = 3100 + 140 * np.sign(np.sin(2 * np.pi * 26 * x))
    y = np.sin(2 * np.pi * np.cumsum(fr) / SR) + 0.25 * hp(rng.standard_normal(len(x)), 2500)
    return y * env_adsr(len(x), 0.02, 0.15) * 0.35

def piano(fr, d=3.2, vel=1.0):
    x = tt(d); y = np.zeros_like(x)
    for k, a in zip(range(1, 8), (1, .55, .32, .2, .12, .07, .04)):
        y += a * np.sin(2 * np.pi * fr * k * 1.0008 ** k * x) * np.exp(-x * (1.1 + 0.9 * k))
    hammer = lp(rng.standard_normal(len(x)), 2500) * np.exp(-x * 90) * 0.15
    return (y + hammer) * vel * env_adsr(len(x), 0.004, 0.4)

def tinnitus(d, f0=5200):
    x = tt(d); return np.sin(2 * np.pi * f0 * x) * env_adsr(len(x), d * 0.3, d * 0.5) * 0.05

hz = lambda n: 440 * 2 ** ((n - 69) / 12)   # MIDI -> Hz

# --- müzik: karanlık D minör drone; darbe ya da hüzün bölümünde biter
SAD = L[R["sad"]]["start"] + 0.25 if R.get("sad") else TOTAL
TRI = L[R["triumph"]]["start"] - 0.1 if R.get("triumph") else None
if TRI is not None: SAD = TRI   # drone, zafer müziği başlayınca biter
pre_end = IMPACT - 0.35 if IMPACT is not None else SAD
d0 = pre_end
x = tt(d0)
swell = np.clip(x / d0, 0, 1)
drone = (np.sin(2 * np.pi * hz(26) * x) * 0.55 + saw(hz(38), d0, 600) * 0.35 + saw(hz(38) * 1.004, d0, 600) * 0.3
         + saw(hz(45), d0, 700) * 0.18 * swell)
drone *= (0.55 + 0.45 * swell) * (1 + 0.15 * np.sin(2 * np.pi * 0.25 * x))
fz = L[R["freeze"]]["start"] if R.get("freeze") else None
k0 = fz if fz is not None else d0 * 0.5
clus = (saw(hz(74), d0, 3000) + saw(hz(75), d0, 3000) * 0.8) * np.clip((x - k0) / (pre_end - k0), 0, 1) ** 2 * 0.07
dr = np.stack([drone + clus * 1.1, drone * 0.97 + clus * 0.9], 1) * env_adsr(len(x), 0.6, 0.6 if IMPACT is None else 0.05)[:, None]
if fz is not None:   # donma anında drone durur, resume satırında geri döner
    fz_i = int(fz * SR); back_i = int((L[R["resume"]]["start"] + 0.2) * SR)
    g = np.ones(len(x)); g[fz_i:back_i] = 0
    ramp = int(0.8 * SR); g[back_i:back_i + ramp] = np.linspace(0, 1, ramp)[: len(g[back_i:back_i + ramp])]
    dr *= g[:, None]
put(music, reverb(hp(lp(dr, 2400), 45), 3.0, 0.3), 0, 0.3)

# sub darbeler + saat tik-takları
if R.get("kicks"):
    p, end = L[R["kicks"][0]]["start"], L[R["kicks"][1]]["start"]
    while p < end - 0.1:
        x2 = tt(0.5); kick = np.sin(2 * np.pi * np.cumsum(40 + 50 * np.exp(-x2 * 25)) / SR) * np.exp(-x2 * 7)
        put(music, lp(kick, 150), p, 0.3)
        p += 0.75
if R.get("ticks"):
    p, end = L[R["ticks"][0]]["start"], L[R["ticks"][1]]["start"]
    while p < end - 0.05:
        put(sfx, tick(), p, 0.22, pan=0.3 if int(p / 0.375) % 2 else -0.3); p += 0.375

# kanca: darbe
put(sfx, boom(1.8), 0.0, 0.55)
put(sfx, reverb(whoosh(0.5, False), 1.5, 0.3), 0.0, 0.5)
put(sfx, tinnitus(1.4), 0.15, 0.6)

# sahne geçiş whoosh'ları
for s in scenes:
    if s["id"] in R.get("whoosh", []):
        put(sfx, whoosh(0.45, True), max(0, s["from"] / FPS - 0.22), 0.32, pan=rng.uniform(-.4, .4))

# HUD daktilo
if HUD:
    for i in range(sum(len(h) for h in HUD)):
        put(sfx, type_key(), TYPE_START + i * TYPE_RATE + (0.12 if i >= len(HUD[0]) else 0) + (0.12 if len(HUD) > 2 and i >= len(HUD[0]) + len(HUD[1]) else 0),
            0.35 * rng.uniform(.7, 1), pan=rng.uniform(-.3, .3))

# adlandırılmış ses olayları (işaretlerde ve satır başlarında)
def event(name, t0):
    if name == "hit": put(sfx, boom(0.9) * 0.6, t0, 0.5)
    elif name == "glitch": put(sfx, glitch(0.3), t0, 0.5)
    elif name == "bigglitch": put(sfx, glitch(0.45), t0, 0.75); put(sfx, tape_stop(0.6, 220) * 0.6, t0 + 0.05, 0.6)
    elif name == "alarm": put(sfx, reverb(lp(boom(1.2), 900), 2, .4), t0, 0.35)
    elif name == "stamp": put(sfx, reverb(boom(0.7), 1.2, .3) * 0.7, t0, 0.45); put(sfx, click(0.03, 1500), t0, 0.6)
    elif name == "triple":
        for k in range(3): put(sfx, reverb(boom(0.6), 1.0, .3) * 0.6, t0 + k * 0.2, 0.45)
    elif name == "quad":
        for k in range(4): put(sfx, lp(boom(0.5), 700), t0 + k * 0.16, 0.4)
    elif name == "riser": put(sfx, reverse_swell(0.9), t0 - 0.9, 0.5)
    elif name == "whistle": put(sfx, reverb(whistle(0.85), 2.0, 0.3), t0 - 0.35, 0.55); put(sfx, reverb(whoosh(0.4, False), 1.2, 0.3), t0 - 0.05, 0.3)
for name, m in sc.get("marks", {}).items():
    for e in m.get("sfx", []): event(e, marks[name])
for ln in lines:
    for e in ln.get("sfx", []): event(e, ln["start"] - 0.05)

# zamanı durdur: tape-stop + uğultu
if fz is not None:
    put(sfx, reverb(tape_stop(), 2.0, 0.4), fz - 0.05, 0.8)
    put(sfx, tinnitus(L[R["resume"]]["start"] - fz + 0.5, 6100), fz + 0.2, 0.5)
for b in beats: put(sfx, heartbeat(), b, 0.65)
if IMPACT is not None:   # ters yükselen + büyük darbe
    put(sfx, reverse_swell(1.5), IMPACT - 1.5, 0.75)
    put(sfx, reverb(boom(2.6), 3.2, 0.35), IMPACT, 1.0)
    put(sfx, tinnitus(2.4, 4700), IMPACT + 0.3, 0.9)

# hüzünlü piyano (sad satırı -> son)
pst = SAD
if TRI is not None:
    # zafer: D majör akorlar (D A Bm G), sekizlik piyano + yükselen pad + vuruş
    seq = [[50, 57, 62, 66], [45, 57, 61, 64], [47, 59, 62, 66], [43, 55, 59, 62]]
    span = TOTAL - TRI
    bar = span / 4
    tri = np.zeros((int((span + 4) * SR), 2))
    for ci, ch in enumerate(seq):
        st8 = bar / 8
        for k in range(8):
            n = ch[1:][k % 3] + (12 if k % 4 == 3 else 0)
            y = piano(hz(n), 1.4, 0.32 + 0.1 * (k % 2 == 0)); i = int((ci * bar + k * st8) * SR)
            tri[i:i + len(y)] += np.stack([y * (0.8 if k % 2 else 1), y * (1 if k % 2 else 0.8)], 1)[: len(tri) - i]
        y = piano(hz(ch[0] - 12), bar + 1.5, 0.7); i = int(ci * bar * SR); tri[i:i + len(y)] += np.stack([y, y], 1)[: len(tri) - i]
        x2 = tt(0.5)
        for b in range(4):   # dörtlük vuruş
            kick = np.sin(2 * np.pi * np.cumsum(45 + 70 * np.exp(-x2 * 30)) / SR) * np.exp(-x2 * 9)
            i = int((ci * bar + b * bar / 4) * SR); tri[i:i + len(kick)] += np.stack([kick, kick], 1)[: len(tri) - i] * 0.5
    pad_x = tt(span + 1)
    pad = sum(saw(hz(n), span + 1, 2500) for n in (62, 66, 69, 74)) * env_adsr(len(pad_x), 2.0, 1.0) * 0.035 * np.linspace(0.6, 1.2, len(pad_x))
    put(music, reverb(tri, 2.6, 0.35), TRI, 0.55)
    put(music, reverb(lp(pad, 3000), 3.0, 0.4), TRI, 0.6)
    pst = TOTAL
if pst < TOTAL:
    chords = [[38, 50, 53, 57, 62], [34, 46, 50, 53, 58], [41, 53, 57, 60, 65], [33, 45, 49, 52, 57]]  # Dm Bb F A
    dur_ch = (TOTAL - pst) / 4
    pn = np.zeros((int((TOTAL - pst + 4) * SR), 2))
    for ci, ch in enumerate(chords):
        for ni, n in enumerate(ch):
            y = piano(hz(n), dur_ch + 2.5, 0.5 if ni else 0.7)
            i = int((ci * dur_ch + ni * 0.05) * SR); pn[i:i + len(y)] += np.stack([y * (1 - 0.1 * ni), y * (0.6 + 0.1 * ni)], 1)[: len(pn) - i]
        y = piano(hz([69, 65, 65, 64][ci]), dur_ch + 2, 0.55); i = int((ci * dur_ch + dur_ch * 0.5) * SR)
        pn[i:i + len(y)] += np.stack([y, y], 1)[: len(pn) - i]
    pad_x = tt(TOTAL - pst + 1)
    pad = sum(saw(hz(n), TOTAL - pst + 1, 1800) for n in (50, 57, 62)) * env_adsr(len(pad_x), 1.5, 1.0) * 0.05
    put(music, reverb(pn, 3.5, 0.45), pst, 0.5)
    put(music, reverb(lp(pad, 1500), 3.0, 0.4), pst, 0.6)

# --- seslendirme + ducking
for ln in lines: put_vo_i = int(ln["start"] * SR); vo[put_vo_i:put_vo_i + len(ln["audio"])] += ln["audio"]
vo = vo[:N]
env = np.convolve(np.abs(vo), np.ones(int(0.05 * SR)) / int(0.05 * SR), mode="same")
env = np.clip(env / (env.max() + 1e-9) * 6, 0, 1)
env = np.convolve(env, np.ones(int(0.25 * SR)) / int(0.25 * SR), mode="same")
duck = 1 - 0.72 * env
vo_st = np.stack([vo, vo], 1)
mix = vo_st * 1.0 + music * duck[:, None] * 0.9 + sfx * (1 - 0.45 * env)[:, None]
mix = mix[: int(TOTAL * SR)]
if os.environ.get("DIAG"):
    bed = (music * duck[:, None] * 0.9 + sfx * (1 - 0.45 * env)[:, None])[: len(mix)].mean(1); v = vo_st[: len(mix), 0]
    mu = (music * duck[:, None] * 0.9)[: len(mix)].mean(1); sx = (sfx * (1 - 0.45 * env)[:, None])[: len(mix)].mean(1)
    m = env[: len(mix)] > 0.5
    r = lambda x: 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-9)
    lowv = lp(v, 250); lowb = lp(bed, 250)
    print(f"music {r(mu[m]):.1f} sfx {r(sx[m]):.1f}"); print(f"speech: vo {r(v[m]):.1f} dB, bed {r(bed[m]):.1f} dB | <250Hz vo {r(lowv[m]):.1f} bed {r(lowb[m]):.1f} | 1-4k vo {r(bp(v,1000,4000)[m]):.1f} bed {r(bp(bed,1000,4000)[m]):.1f}")
fade = int(0.4 * SR); mix[-fade:] *= np.linspace(1, 0, fade)[:, None]
mix /= np.abs(mix).max() + 1e-9
os.makedirs("public/mix", exist_ok=True)
tmp = f"public/mix/{slug}.pre.wav"
sf.write(tmp, (mix * 0.9).astype(np.float32), SR)
os.system(f"ffmpeg -y -loglevel error -i {tmp} -af 'acompressor=threshold=-16dB:ratio=3:attack=8:release=120,"
          f"loudnorm=I=-14:TP=-1.2:LRA=9,alimiter=limit=0.89' -ar 48000 public/mix/{slug}.wav && rm {tmp}")
print("mix:", f"public/mix/{slug}.wav")
