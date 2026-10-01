# src/data/*.json dosyalarından src/Root.tsx üretir.
import glob, os
names = sorted(os.path.basename(p)[:-5] for p in glob.glob("src/data/*.json"))
imp = "\n".join(f'import d{i} from "./data/{n}.json";' for i, n in enumerate(names))
arr = ", ".join(f"d{i}" for i in range(len(names)))
open("src/Root.tsx", "w").write(f'''import {{ Composition }} from "remotion";
import {{ Ranking, RankingData, totalFrames }} from "./Ranking";
{imp}

const all = [{arr}] as RankingData[];
export const Root = () => (
  <>
    {{all.map((d) => (
      <Composition key={{d.slug}} id={{d.slug}} component={{Ranking}} defaultProps={{d}}
        durationInFrames={{totalFrames(d)}} fps={{30}} width={{1080}} height={{1920}} />
    ))}}
  </>
);
''')
print(names)
