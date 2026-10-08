import { Composition } from "remotion";
import { Call, CallData } from "./Call";
import d0 from "./data/offside-past-keeper.json";

const all = [d0] as unknown as CallData[];
export const Root = () => (
  <>
    {all.map((d) => (
      <Composition key={d.slug} id={d.slug} component={Call} defaultProps={d}
        durationInFrames={Math.round(d.seconds * 30)} fps={30} width={1080} height={1920} />
    ))}
  </>
);
