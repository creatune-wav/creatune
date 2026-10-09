# Kullanım: python tools/finish_psiko.py data/<slug>.script.json
# Render + 30MB altına sıkıştırma + out/<slug>.txt (başlık, açıklama, sabit yorum script'ten).
import json, os, subprocess, sys
s = json.load(open(sys.argv[1]))
slug, raw = s["slug"], f"out/{s['slug']}_hq.mp4"
os.makedirs("out", exist_ok=True)
subprocess.run(["npx", "remotion", "render", "src/index.ts", slug, raw, "--crf=18", "--log=error", f"--concurrency={os.cpu_count()}"], check=True)
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", raw, "-c:v", "libx264", "-crf", "21", "-preset", "slow",
                "-maxrate", "4.5M", "-bufsize", "9M", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", f"out/{slug}.mp4"], check=True)
os.remove(raw)
p = s["publish"]
open(f"out/{slug}.txt", "w").write(f"TITLE:\n{p['title']}\n\nDESCRIPTION:\n{p['description']}\n\nTAGS:\n{p['tags']}\n\nPINNED COMMENT:\n{p['pinned']}\n")
print(slug, subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration,size", "-of", "csv=p=0", f"out/{slug}.mp4"],
                           capture_output=True, text=True).stdout.strip())
