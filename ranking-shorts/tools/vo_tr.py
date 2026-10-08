# Kullanım: python tools/vo_tr.py data/<slug>.script.json [edge|piper]
# Her satırı ayrı üretir: public/vo/<slug>/<id>.wav
#  edge : Microsoft nöral sesi (tr-TR-AhmetNeural). speech.platform.bing.com ağ izni gerekir.
#  gtrans: Google'ın nöral Türkçe sesi (translate.googleapis.com, kadın anlatıcı). Doğal ve telaffuzu kusursuz.
#  piper: yerel Türkçe Piper sesi (fahrettin, sherpa-onnx); model tools/voice/ içine indirilir.
# Motor verilmezse sırayla edge, gtrans, piper denenir; ilk çalışan kullanılır.
# Satırda "say_neural" varsa edge onu okur (özel isimleri düzgün okuduğu için fonetik yazım gerekmez).
import asyncio, json, os, subprocess, sys, tempfile
import numpy as np, soundfile as sf

sc = json.load(open(sys.argv[1], encoding="utf-8"))
engine = sys.argv[2] if len(sys.argv) > 2 else os.environ.get("VO_ENGINE", "auto")
out = f"public/vo/{sc['slug']}"
os.makedirs(out, exist_ok=True)
EDGE_VOICE = sc.get("edge_voice", "tr-TR-AhmetNeural")

def edge_chunk(text, rate):
    import certifi, edge_tts
    ca = os.environ.get("SSL_CERT_FILE") or ("/root/.ccr/ca-bundle.crt" if os.path.exists("/root/.ccr/ca-bundle.crt") else None)
    if ca: certifi.where = lambda: ca   # kurumsal proxy arkasında TLS: proxy CA paketine güven
    with tempfile.TemporaryDirectory() as d:
        mp3 = os.path.join(d, "a.mp3")
        asyncio.run(edge_tts.Communicate(text, EDGE_VOICE, rate=rate, pitch=sc.get("edge_pitch", "-3Hz"), proxy=os.environ.get("HTTPS_PROXY")).save(mp3))
        y, sr = load_any(mp3)
    return y, sr

def load_any(path):
    wav = path + ".wav"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", path, "-ac", "1", "-ar", "48000", wav], check=True)
    return sf.read(wav, dtype="float32")

def gtrans_chunk(text):
    import urllib.parse, urllib.request
    q = urllib.parse.urlencode({"ie": "UTF-8", "client": "gtx", "tl": "tr", "q": text})
    with tempfile.TemporaryDirectory() as d:
        mp3 = os.path.join(d, "a.mp3")
        with urllib.request.urlopen(f"https://translate.googleapis.com/translate_tts?{q}", timeout=30) as r:
            open(mp3, "wb").write(r.read())
        return load_any(mp3)

_piper = None
def piper_chunk(text, speed):
    global _piper
    if _piper is None:
        import sherpa_onnx
        V = "tr_TR-fahrettin-medium"
        D = os.path.join(os.path.dirname(__file__), "voice", f"vits-piper-{V}")
        if not os.path.exists(D):
            subprocess.run(f"curl -sL https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-piper-{V}.tar.bz2"
                           f" | tar xj -C {os.path.dirname(D)}", shell=True, check=True)
        _piper = sherpa_onnx.OfflineTts(sherpa_onnx.OfflineTtsConfig(model=sherpa_onnx.OfflineTtsModelConfig(
            vits=sherpa_onnx.OfflineTtsVitsModelConfig(model=f"{D}/{V}.onnx", tokens=f"{D}/tokens.txt",
                data_dir=f"{D}/espeak-ng-data", noise_scale=0.6, noise_scale_w=0.7), num_threads=4)))
    a = _piper.generate(text, sid=0, speed=speed)
    return np.array(a.samples, dtype="float32"), a.sample_rate

if engine == "auto":
    for cand, probe in (("edge", lambda: edge_chunk("Deneme.", "+0%")), ("gtrans", lambda: gtrans_chunk("Deneme."))):
        try:
            probe(); engine = cand; break
        except Exception as e:
            print(f"{cand} erişilemedi:", type(e).__name__)
    else:
        engine = "piper"

# motor başına son işlem: piper biraz kalınlaştırılır; nöral ses zaten doğal, hafif dokunulur
POST = {
    "piper": f"asetrate=22050*0.965,aresample=48000,atempo={sc.get('piper_tempo', 1.07)},highpass=f=70,bass=g=5:f=110,treble=g=2:f=5000,"
             "acompressor=threshold=-22dB:ratio=4:attack=4:release=90,silenceremove=start_periods=1:start_threshold=-50dB,"
             "loudnorm=I=-15:TP=-1.5:LRA=7",
    "gtrans": f"aresample=48000,atempo={sc.get('gtrans_tempo', 1.2)},highpass=f=80,equalizer=f=180:t=q:w=1:g=2,"
              "equalizer=f=3500:t=q:w=1.5:g=2,acompressor=threshold=-20dB:ratio=3:attack=5:release=100,"
              "silenceremove=start_periods=1:start_threshold=-50dB,loudnorm=I=-15:TP=-1.5:LRA=7",
    "edge": "aresample=48000,highpass=f=70,bass=g=3:f=120,acompressor=threshold=-20dB:ratio=3:attack=5:release=100,"
            "silenceremove=start_periods=1:start_threshold=-50dB,loudnorm=I=-15:TP=-1.5:LRA=7",
}
for ln in sc["lines"]:
    text = ln.get("say_neural", ln["say"]) if engine in ("edge", "gtrans") else ln["say"]
    # "..." = dramatik duraklama: parçaları ayrı üret, araya sessizlik koy
    parts, sr = [], 48000
    # nöral motorlar cümleyi bütün okursa tonlama doğal kalır; "..." onların kendi duraklamasına bırakılır
    chunks = [text.replace("...", ",")] if engine in ("edge", "gtrans") and sc.get("whole", True) else text.split("...")
    for chunk in (x.strip() for x in chunks):
        if not chunk: continue
        if engine == "edge":
            y, sr = edge_chunk(chunk, sc.get("edge_rate", "+4%"))
        elif engine == "gtrans":
            y, sr = gtrans_chunk(chunk)
        else:
            y, sr = piper_chunk(chunk, ln.get("speed", sc.get("speed", 1.0)))
        nz = np.nonzero(np.abs(y) > 0.01)[0]
        y = y[max(0, nz[0] - int(sr * 0.04)): nz[-1] + int(sr * sc.get("tail", 0.16))] if len(nz) else y
        if parts: parts.append(np.zeros(int(sr * ln.get("pause", sc.get("pause", 0.32)))))
        parts.append(y)
    raw = f"{out}/{ln['id']}.raw.wav"
    sf.write(raw, np.concatenate(parts), sr)
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", raw, "-af", POST[engine], "-ar", "48000", "-ac", "1",
                    f"{out}/{ln['id']}.wav"], check=True)
    os.remove(raw)
    dur = sf.info(f"{out}/{ln['id']}.wav").duration
    print(f"{ln['id']:8s} {dur:5.2f}s  [{engine}] {text}")
