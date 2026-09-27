# Kullanım: python tools/cut_local.py data/highest-jumps.local.json
# Yerel kaynak dosyalardan (raw/) elle seçilmiş aralıkları keser, src/data/<slug>.json yazar.
import json, subprocess, sys, os
plan = json.load(open(sys.argv[1], encoding="utf-8"))
slug = plan["slug"]
os.makedirs(f"public/clips/{slug}", exist_ok=True)

def cut(src, st, dur, dst):
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-ss", str(st), "-i", src, "-t", str(dur),
        "-vf", "fps=30,scale=-2:1200:flags=lanczos,unsharp=5:5:0.6",
        "-af", "loudnorm=I=-16:TP=-1.5:LRA=11", "-ar", "48000",
        "-c:v", "libx264", "-crf", "17", "-preset", "medium", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "192k", dst], check=True)

h = plan["hook"]
cut(h["src"], h["start"], h["dur"], f"public/clips/{slug}/hook.mp4")
items = []
for it in plan["items"]:
    dst = f"public/clips/{slug}/{it['rank']}.mp4"
    cut(it["src"], it["start"], it["dur"], dst)
    items.append({"rank": it["rank"], "label": it["label"], "clip": f"clips/{slug}/{it['rank']}.mp4",
                  "credit": it["credit"], "frames": round(it["dur"] * 30),
                  "impact": round(it.get("impact", 0) * 30), "focus": it.get("focus", 50)})
    print(f"#{it['rank']} {it['start']}s +{it['dur']}s")
json.dump({"slug": slug, "title": plan["title"], "hook": {"clip": f"clips/{slug}/hook.mp4", "frames": round(h["dur"] * 30)},
           "cta": plan["cta"], "items": items},
          open(f"src/data/{slug}.json", "w", encoding="utf-8"), indent=2, ensure_ascii=False)
