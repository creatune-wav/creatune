# src/data/*.json (sıralama) ve src/psiko/*.json (psikofutbol anlatım) dosyalarından src/Root.tsx üretir.
import glob, os
names = sorted(os.path.basename(p)[:-5] for p in glob.glob("src/data/*.json"))
psiko = sorted(os.path.basename(p)[:-5] for p in glob.glob("src/psiko/*.json"))
imp = "\n".join(f'import d{i} from "./data/{n}.json";' for i, n in enumerate(names))
imp += "".join(f'\nimport p{i} from "./psiko/{n}.json";' for i, n in enumerate(psiko))
arr = ", ".join(f"d{i}" for i in range(len(names)))
parr = ", ".join(f"p{i}" for i in range(len(psiko)))
open("src/Root.tsx", "w").write(f'''import {{ Composition }} from "remotion";
import {{ Ranking, RankingData, totalFrames }} from "./Ranking";
import {{ Psiko, PsikoData, psikoFrames }} from "./Psiko";
{imp}

const all = [{arr}] as RankingData[];
const psiko = [{parr}] as PsikoData[];
export const Root = () => (
  <>
    {{all.map((d) => (
      <Composition key={{d.slug}} id={{d.slug}} component={{Ranking}} defaultProps={{d}}
        durationInFrames={{totalFrames(d)}} fps={{30}} width={{1080}} height={{1920}} />
    ))}}
    {{psiko.map((d) => (
      <Composition key={{d.slug}} id={{d.slug}} component={{Psiko}} defaultProps={{d}}
        durationInFrames={{psikoFrames(d)}} fps={{30}} width={{1080}} height={{1920}} />
    ))}}
  </>
);
''')
print(names, psiko)
