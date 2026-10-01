# Kullanım: python tools/fetch.py data/batch.json [cookies.txt]
# Her videoyu raw/<slug>_<rank>.mp4 olarak indirir, bilgiyi raw/<slug>_<rank>.json'a yazar,
# zaman damgalı contact sheet üretir (raw/<slug>_<rank>_sheet.jpg).
import json, os, subprocess, sys
batch = json.load(open(sys.argv[1]))
ck = ["--cookies", sys.argv[2]] if len(sys.argv) > 2 else []
YT = ["yt-dlp", "--js-runtimes", "node:/opt/node22/bin/node", "--no-playlist", "-q", "--no-warnings"] + ck
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
for v in batch:
    for rank, vid, _ in v["items"]:
        base = f"raw/{v['slug']}_{rank}"
        if not os.path.exists(base + ".mp4"):
            r = subprocess.run(YT + ["-f", "bv*[height<=1080][ext=mp4]+ba[ext=m4a]/b[ext=mp4]/bv*+ba/b",
                "--merge-output-format", "mp4", "--write-info-json", "-o", base + ".%(ext)s",
                f"https://www.youtube.com/watch?v={vid}"], capture_output=True, text=True)
            if r.returncode: print("FAIL", base, r.stderr.strip()[-160:]); continue
        dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0",
                                    base + ".mp4"], capture_output=True, text=True).stdout or 0)
        step = max(1, round(dur / 40))
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", base + ".mp4", "-vf",
            f"fps=1/{step},scale=200:-2,drawtext=fontfile={FONT}:text='%{{pts\\:hms}}':x=4:y=4:fontsize=16:"
            "fontcolor=yellow:box=1:boxcolor=black,tile=8x5", "-frames:v", "1", base + "_sheet.jpg"])
        print("OK", base, f"{dur:.0f}s step={step}")
