# Kullanım: python tools/find.py "cliff jump #shorts" "bridge jump shorts" > data/highest-jumps.cands.txt
import subprocess, sys
seen = set()
rows = []
for q in sys.argv[1:]:
    out = subprocess.run(
        ["yt-dlp", "--js-runtimes", "node", "--flat-playlist",
         "--print", "%(id)s\t%(duration)s\t%(view_count)s\t%(channel)s\t%(title)s",
         f"ytsearch25:{q}"], capture_output=True, text=True).stdout
    for line in out.splitlines():
        p = line.split("\t")
        if len(p) < 5 or p[0] in seen: continue
        seen.add(p[0])
        try: dur = float(p[1]); views = int(p[2])
        except ValueError: continue
        if dur > 180 or views < 300_000: continue      # tek-an kısa videolar, viral
        rows.append((views, p[0], int(dur), p[3][:20], p[4][:70]))
rows.sort(reverse=True)
for v, i, d, ch, t in rows[:30]:
    print(f"{v/1e6:5.1f}M | {d:3d}s | {i} | {ch} | {t}")
