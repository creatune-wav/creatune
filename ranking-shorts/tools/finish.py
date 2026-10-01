# Kullanım: python tools/finish.py <slug> "<YouTube başlığı>" "<etiketler>"
# Render + 30MB altına sıkıştırma + out/<slug>.txt (açıklama, kaynaklar).
import json, subprocess, sys, os
slug, title, tags = sys.argv[1], sys.argv[2], sys.argv[3]
p = json.load(open(f"data/{slug}.local.json"))
raw = f"out/{slug}_hq.mp4"
subprocess.run(["npx", "remotion", "render", "src/index.ts", slug, raw, "--crf=18", "--log=error", f"--concurrency={os.cpu_count()}"], check=True)
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", raw, "-c:v", "libx264", "-crf", "21", "-preset", "slow",
                "-maxrate", "4.5M", "-bufsize", "9M", "-c:a", "copy", "-movflags", "+faststart", f"out/{slug}.mp4"], check=True)
os.remove(raw)
items = sorted(p["items"], key=lambda x: -x["rank"])
lines = "\n".join(f"#{i['rank']} {i['label'].title()}" for i in items)
cred = "\n".join(f"#{i['rank']} {i['credit']} – {i['url']}" for i in items)
hashtags = " ".join("#" + t.strip().replace(" ", "") for t in tags.split(",")[:6])
open(f"out/{slug}.txt", "w").write(f"""TITLE:
{title}

DESCRIPTION:
Which one is the craziest? 👇 Comment your number!

{lines}

Subscribe for more insane rankings every day 🔥

Credits:
{cred}

#shorts #ranking #top5 {hashtags}

TAGS:
ranking, top 5, {tags}, viral, shorts

PINNED COMMENT:
Which number would you never try? 🤔
""")
d = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration,size", "-of", "csv=p=0", f"out/{slug}.mp4"],
                   capture_output=True, text=True).stdout.strip()
print(slug, d)
