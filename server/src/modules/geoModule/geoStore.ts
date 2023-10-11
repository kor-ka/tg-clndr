import { MDB } from "../../utils/MDB";

export type TzGeo = { tz: string, location: { type: "Point", coordinates: readonly [number, number] } }
export const TZ_GEO = () => MDB.collection<TzGeo>("tz_geo");
