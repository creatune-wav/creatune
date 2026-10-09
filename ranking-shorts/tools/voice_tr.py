# Kullanım: python tools/voice_tr.py data/<slug>.script.json
# Her sahne için Türkçe seslendirme (edge-tts) üretir: public/vo/<slug>/sN.wav,
# kelime zamanlamalarıyla birlikte src/psiko/<slug>.json'a sahne süresini yazar.
import asyncio, json, os, ssl, subprocess, sys
import edge_tts, edge_tts.communicate as ec
ec._SSL_CTX = ssl.create_default_context(cafile=os.environ.get("SSL_CERT_FILE", "/root/.ccr/ca-bundle.crt"))
FPS, PAD = 30, 9  # sahne sonunda ~0.3 sn nefes

async def say(text, voice, rate, mp3):
    words = []
    with open(mp3, "wb") as fh:
        async for ch in edge_tts.Communicate(text, voice, rate=rate, boundary="WordBoundary").stream():
            if ch["type"] == "audio": fh.write(ch["data"])
            elif ch["type"] == "WordBoundary":
                words.append({"t": round(ch["offset"] / 1e7, 3), "w": ch["text"]})
    return words

def dur(p):
    return float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", p],
                                capture_output=True, text=True).stdout)

s = json.load(open(sys.argv[1]))
slug, out_dir = s["slug"], f"public/vo/{s['slug']}"
os.makedirs(out_dir, exist_ok=True)
scenes = []
for i, sc in enumerate(s["scenes"]):
    mp3, wav = f"{out_dir}/s{i}.mp3", f"{out_dir}/s{i}.wav"
    words = asyncio.run(say(sc["vo"], s["voice"], s["rate"], mp3))
    # anons tonu: hafif kalın, sıkıştırılmış, az yankı; baştaki/sondaki sessizliği kırp
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", mp3, "-af",
        "silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse,"
        "bass=g=3:f=120,acompressor=threshold=-20dB:ratio=3:attack=5:release=80,aecho=0.8:0.4:40:0.12,"
        "loudnorm=I=-14:TP=-1:LRA=7", "-ar", "48000", wav], check=True)
    os.remove(mp3)
    d = dur(wav)
    lead = words[0]["t"] if words else 0  # kırpılan baş sessizliği kadar kaydır
    scenes.append({**sc, "frames": int(d * FPS) + PAD + sc.get("hold", 0), "words": [{**w, "t": round(max(0, w["t"] - lead), 3)} for w in words]})
    print(i, sc["kind"], round(d, 2))
json.dump({"slug": slug, "scenes": scenes}, open(f"src/psiko/{slug}.json", "w"), indent=1, ensure_ascii=False)
print("total", round(sum(x["frames"] for x in scenes) / FPS, 1), "s")
