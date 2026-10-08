import { Composition } from "remotion";
import { Ranking, RankingData, totalFrames } from "./Ranking";
import { Psych, PsychData } from "./Psych";
import zk from "./data/zidane-kafa.json";
import mi from "./data/montella-italya.json";
import ag from "./data/arda-guler.json";
import ms from "./data/messi-2016.json";
import ak from "./data/abdulkerim.json";
import d0 from "./data/biggest-waves.json";
import d1 from "./data/craziest-base-jumps.json";
import d2 from "./data/craziest-bike-jumps.json";
import d3 from "./data/craziest-moto-jumps.json";
import d4 from "./data/craziest-ski-drops.json";
import d5 from "./data/highest-jumps.json";
import d6 from "./data/miracle-moments.json";

const all = [d0, d1, d2, d3, d4, d5, d6] as RankingData[];
export const Root = () => (
  <>
    {all.map((d) => (
      <Composition key={d.slug} id={d.slug} component={Ranking} defaultProps={d}
        durationInFrames={totalFrames(d)} fps={30} width={1080} height={1920} />
    ))}
    {([zk, mi, ag, ms, ak] as unknown as PsychData[]).map((d) => (
      <Composition key={d.slug} id={d.slug} component={Psych} defaultProps={d}
        durationInFrames={d.frames} fps={30} width={1080} height={1920} />
    ))}
  </>
);
