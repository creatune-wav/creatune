# Kullanım: python tools/vo_tr.py data/<slug>.script.json
# Türkçe erkek Piper sesi (fahrettin, sherpa-onnx) ile her satırı ayrı üretir: public/vo/<slug>/<id>.wav
# Ses modeli tools/voice/ içine indirilir (GitHub, k2-fsa/sherpa-onnx tts-models).
import json, os, subprocess, sys
import numpy as np, soundfile as sf, sherpa_onnx
V = "tr_TR-fahrettin-medium"
D = os.path.join(os.path.dirname(__file__), "voice", f"vits-piper-{V}")
if not os.path.exists(D):
    subprocess.run(f"curl -sL https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-piper-{V}.tar.bz2"
                   f" | tar xj -C {os.path.dirname(D)}", shell=True, check=True)
tts = sherpa_onnx.OfflineTts(sherpa_onnx.OfflineTtsConfig(model=sherpa_onnx.OfflineTtsModelConfig(
    vits=sherpa_onnx.OfflineTtsVitsModelConfig(model=f"{D}/{V}.onnx", tokens=f"{D}/tokens.txt",
        data_dir=f"{D}/espeak-ng-data", noise_scale=0.6, noise_scale_w=0.7), num_threads=4)))
sc = json.load(open(sys.argv[1], encoding="utf-8"))
out = f"public/vo/{sc['slug']}"
os.makedirs(out, exist_ok=True)
for ln in sc["lines"]:
    # "..." = dramatik duraklama: parçaları ayrı üret, araya sessizlik koy
    parts, sr = [], 22050
    for i, chunk in enumerate(x.strip() for x in ln["say"].split("...")):
        if not chunk: continue
        a = tts.generate(chunk, sid=0, speed=ln.get("speed", sc.get("speed", 1.0)))
        sr = a.sample_rate
        y = np.array(a.samples)
        nz = np.nonzero(np.abs(y) > 0.01)[0]
        y = y[max(0, nz[0] - 200): nz[-1] + 3500] if len(nz) else y
        if parts: parts.append(np.zeros(int(sr * ln.get("pause", 0.32))))
        parts.append(y)
    raw = f"{out}/{ln['id']}.raw.wav"
    sf.write(raw, np.concatenate(parts), sr)
    # belgesel anlatıcı tonu: biraz kalın, sıcak, sıkıştırılmış, hafif oda
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", raw, "-af",
        "asetrate=22050*0.965,aresample=48000,atempo=1.07,highpass=f=70,bass=g=5:f=110,treble=g=2:f=5000,"
        "acompressor=threshold=-22dB:ratio=4:attack=4:release=90,"
        "silenceremove=start_periods=1:start_threshold=-50dB,"
        "loudnorm=I=-15:TP=-1.5:LRA=7", "-ar", "48000", "-ac", "1", f"{out}/{ln['id']}.wav"], check=True)
    os.remove(raw)
    d = sf.info(f"{out}/{ln['id']}.wav").duration
    print(f"{ln['id']:7s} {d:5.2f}s  {ln['say']}")
