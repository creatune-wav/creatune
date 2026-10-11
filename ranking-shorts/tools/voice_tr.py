# Kullanım: python tools/voice_tr.py data/<slug>.story.json
# Her sahnenin "vo" metnini Edge TTS (tr-TR-AhmetNeural, ücretsiz) ile public/vo/<slug>/<id>.wav olarak üretir,
# süreleri ölçüp src/data/<slug>.json'u (Remotion) yazar.
import asyncio, json, os, subprocess, sys
import certifi
if os.path.exists("/root/.ccr/ca-bundle.crt"):  # bulut ortamındaki proxy sertifikası
    certifi.where = lambda: "/root/.ccr/ca-bundle.crt"
import edge_tts

story = json.load(open(sys.argv[1], encoding="utf-8"))
slug, voice, rate = story["slug"], story.get("voice", "tr-TR-AhmetNeural"), story.get("rate", "+10%")
os.makedirs(f"public/vo/{slug}", exist_ok=True)

def dur(p):
    return float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", p],
                                capture_output=True, text=True).stdout)

FPS, PAD = 30, story.get("pad", 0.35)
out = []
for s in story["scenes"]:
    wav = f"public/vo/{slug}/{s['id']}.wav"
    if not os.path.exists(wav):
        mp3 = wav[:-4] + ".mp3"
        asyncio.run(edge_tts.Communicate(s["vo"], voice, rate=rate, pitch="-4Hz").save(mp3))
        # sondaki sessizliği kırp, kalın ve sıkıştırılmış anons tonu
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", mp3, "-af",
            "areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse,"
            "bass=g=3:f=120,acompressor=threshold=-20dB:ratio=3:attack=5:release=80,loudnorm=I=-14:TP=-1:LRA=7",
            "-ar", "48000", wav], check=True)
        os.remove(mp3)
    d = dur(wav)
    out.append({**{k: v for k, v in s.items() if k != "vo"}, "vo": f"vo/{slug}/{s['id']}.wav",
                "frames": round((d + PAD) * FPS)})
    print(f"{s['id']:<10} {d:5.2f}s")

data = {k: v for k, v in story.items() if k not in ("scenes", "voice", "rate", "pad")}
data["scenes"] = out
json.dump(data, open(f"src/data/{slug}.json", "w", encoding="utf-8"), indent=2, ensure_ascii=False)
print("total", round(sum(x["frames"] for x in out) / FPS, 1), "s")
