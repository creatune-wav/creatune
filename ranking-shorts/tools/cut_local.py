# Kullanım: python tools/cut_local.py data/highest-jumps.local.json
# Yerel kaynak dosyalardan (raw/) elle seçilmiş aralıkları keser, src/data/<slug>.json yazar.
import json, subprocess, sys, os
plan = json.load(open(sys.argv[1], encoding="utf-8"))
slug = plan["slug"]
os.makedirs(f"public/clips/{slug}", exist_ok=True)

def cut(src, st, dur, dst, crop=None, replay=None):
    # replay: [start, dur, speed] -> ana parçanın ardından (yavaş) tekrar eklenir
    pre = (f"crop={crop}," if crop else "")
    vf = f"{pre}fps=30,scale=-2:1200:flags=lanczos,unsharp=5:5:0.6,setsar=1"
    parts = [(st, dur, 1.0)] + ([tuple(replay)] if replay else [])
    fc = []
    for i, (s0, d0, sp) in enumerate(parts):
        fc.append(f"[0:v]trim={s0}:{s0+d0},setpts=(PTS-STARTPTS)/{sp},{vf}[v{i}]")
        fc.append(f"[0:a]atrim={s0}:{s0+d0},asetpts=PTS-STARTPTS,atempo={sp},aresample=48000[a{i}]")
    fc.append("".join(f"[v{i}][a{i}]" for i in range(len(parts))) + f"concat=n={len(parts)}:v=1:a=1[v][a0]")
    fc.append("[a0]loudnorm=I=-16:TP=-1.5:LRA=11[a]")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", src, "-filter_complex", ";".join(fc),
        "-map", "[v]", "-map", "[a]", "-ar", "48000",
        "-c:v", "libx264", "-crf", "17", "-preset", "medium", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "192k", dst], check=True)

h = plan["hook"]
cut(h["src"], h["start"], h["dur"], f"public/clips/{slug}/hook.mp4", h.get("crop"))
items = []
for it in plan["items"]:
    dst = f"public/clips/{slug}/{it['rank']}.mp4"
    cut(it["src"], it["start"], it["dur"], dst, it.get("crop"), it.get("replay"))
    tot = it["dur"] + (it["replay"][1] / it["replay"][2] if it.get("replay") else 0)
    items.append({"rank": it["rank"], "label": it["label"], "clip": f"clips/{slug}/{it['rank']}.mp4",
                  "credit": it["credit"], "frames": round(tot * 30),
                  "impact": round(it.get("impact", 0) * 30), "focus": it.get("focus", 50)})
    print(f"#{it['rank']} {it['start']}s +{it['dur']}s")
json.dump({"slug": slug, "title": plan["title"], "hook": {"clip": f"clips/{slug}/hook.mp4", "frames": round(h["dur"] * 30)},
           "cta": plan["cta"], "items": items},
          open(f"src/data/{slug}.json", "w", encoding="utf-8"), indent=2, ensure_ascii=False)
