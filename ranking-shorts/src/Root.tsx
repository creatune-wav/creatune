import { Composition } from "remotion";
import { Ranking, CLIP, RankingData } from "./Ranking";
import a from "./data/highest-jumps.json";

const all = [a] as RankingData[];
export const Root = () => (
  <>
    {all.map((d) => (
      <Composition key={d.slug} id={d.slug} component={Ranking} defaultProps={d}
        durationInFrames={d.items.length * CLIP} fps={30} width={1080} height={1920} />
    ))}
  </>
);
