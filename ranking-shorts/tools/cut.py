import json, subprocess, sys, os, re
CLIP = 5.5
plan = json.load(open(sys.argv[1], encoding="utf-8"))
slug = plan["slug"]
os.makedirs(f"public/clips/{slug}", exist_ok=True); os.makedirs("raw", exist_ok=True)
YT = ["yt-dlp", "--js-runtimes", "node:/opt/node22/bin/node", "--no-playlist"]

def best_start(info, raw):
    dur = float(info.get("duration") or 0)
    if dur <= CLIP + 0.5: return 0.0
    hm = info.get("heatmap") or []
    if hm:  # en çok tekrar izlenen pencere; zirveden ~1.5 sn önce başla
        best, bs = -1, 0.0
        for h in hm:
            s = max(0.0, min(h["start_time"] - 1.5, dur - CLIP))
            score = sum(x["value"] for x in hm if x["end_time"] > s and x["start_time"] < s + CLIP)
            if score > best: best, bs = score, s
        return round(bs, 2)
    # yedek: en yüksek ses tepesi (çığlık/çarpma)
    r = subprocess.run(["ffmpeg", "-i", raw, "-af",
        "astats=metadata=1:reset=10,ametadata=print:key=lavfi.astats.Overall.RMS_level",
        "-f", "null", "-"], capture_output=True, text=True).stderr
    ts = [float(x) for x in re.findall(r"pts_time:([\d.]+)", r)]
    lv = [float(x) if x not in ("-inf", "inf") else -99 for x in re.findall(r"RMS_level=([-\w.]+)", r)]
    if not lv: return 0.0
    peak = ts[lv.index(max(lv))]
    return round(max(0.0, min(peak - 3.0, dur - CLIP)), 2)

out_items = []
for it in plan["items"]:
    raw = f"raw/{slug}_{it['rank']}.mp4"
    info = json.loads(subprocess.run(YT + ["-J", it["url"]], capture_output=True, text=True).stdout)
    if not os.path.exists(raw):
        subprocess.run(YT + ["-f", "bv*[height<=1920][ext=mp4]+ba[ext=m4a]/b[ext=mp4]/b",
                             "--merge-output-format", "mp4", "-o", raw, it["url"]], check=True)
    st = it["start"] if it.get("start") is not None else best_start(info, raw)
    dst = f"public/clips/{slug}/{it['rank']}.mp4"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-ss", str(st), "-i", raw, "-t", str(CLIP),
        "-vf", "fps=30,scale='if(gt(iw,ih),1080,-2)':'if(gt(iw,ih),-2,1920)'",
        "-af", "loudnorm=I=-14:TP=-1.5:LRA=11", "-ar", "48000",
        "-c:v", "libx264", "-crf", "18", "-preset", "veryfast", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "192k", dst], check=True)
    # tek görsel ile doğrulama: 6 kare yan yana
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", dst, "-vf",
        "fps=6/5.5,scale=240:-2,tile=6x1", "-frames:v", "1", f"raw/{slug}_{it['rank']}_sheet.jpg"], check=True)
    out_items.append({"rank": it["rank"], "label": it["label"],
                      "clip": f"clips/{slug}/{it['rank']}.mp4",
                      "credit": info.get("uploader") or info.get("channel") or "",
                      "source": it["url"], "start": st})
    print(f"#{it['rank']} start={st}s  sheet=raw/{slug}_{it['rank']}_sheet.jpg")

json.dump({"slug": slug, "title": plan["title"], "items": out_items},
          open(f"src/data/{slug}.json", "w", encoding="utf-8"), indent=2, ensure_ascii=False)
