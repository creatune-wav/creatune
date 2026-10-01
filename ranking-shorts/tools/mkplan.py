# Kullanım: python tools/mkplan.py <slug> '<hook json>' '<picks json>'
# picks: {rank: {start, dur, impact?, crop?, focus?, replay?}} — label/url batch.json'dan, credit info.json'dan gelir.
import json, sys
slug, hook, picks = sys.argv[1], json.loads(sys.argv[2]), json.loads(sys.argv[3])
v = next(x for x in json.load(open("data/batch.json")) if x["slug"] == slug)
items = []
for rank, vid, label in v["items"]:
    p = picks[str(rank)]
    info = json.load(open(f"raw/{slug}_{rank}.info.json"))
    items.append({"rank": rank, "src": f"raw/{slug}_{rank}.mp4", "label": label,
                  "credit": info.get("uploader") or info.get("channel") or "", "url": f"https://www.youtube.com/watch?v={vid}", **p})
hook["src"] = f"raw/{slug}_{hook.pop('rank')}.mp4"
plan = {"slug": slug, "title": v["title"], "hook": hook, "numbers": True,
        "cta": {"frames": 75, "sub": "FOR MORE VIDEOS", "at": "one"}, "items": items}
json.dump(plan, open(f"data/{slug}.local.json", "w"), indent=2, ensure_ascii=False)
print("ok", slug)
