import { Composition } from "remotion";
import { Ranking, RankingData, totalFrames } from "./Ranking";
import d0 from "./data/biggest-waves.json";
import d1 from "./data/craziest-base-jumps.json";
import d2 from "./data/craziest-bike-jumps.json";
import d3 from "./data/craziest-moto-jumps.json";
import d4 from "./data/craziest-parkour.json";
import d5 from "./data/craziest-ski-drops.json";
import d6 from "./data/craziest-wingsuit.json";
import d7 from "./data/highest-jumps.json";
import d8 from "./data/miracle-moments.json";

const all = [d0, d1, d2, d3, d4, d5, d6, d7, d8] as RankingData[];
export const Root = () => (
  <>
    {all.map((d) => (
      <Composition key={d.slug} id={d.slug} component={Ranking} defaultProps={d}
        durationInFrames={totalFrames(d)} fps={30} width={1080} height={1920} />
    ))}
  </>
);
