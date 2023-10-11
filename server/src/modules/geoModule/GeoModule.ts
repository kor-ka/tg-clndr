import fetch from "cross-fetch";
import { singleton } from "tsyringe";
import { TzGeo, TZ_GEO } from "./geoStore";

const key = process.env.GEO_KEY!;

@singleton()
export class GeoModule {
  private db = TZ_GEO();

  getTzLocation = async (tz: string) => {
    if (typeof tz !== 'string') {
      throw new Error(`wrong tz: ${tz}`,)
    }
    let data: TzGeo | null = await this.db.findOne({ tz })
    if (!data) {
      const res = await (await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${tz}&key=${key}`)).json();
      const location = res.results[0].geometry.location;
      const coordinates = [location.lng as number, location.lat as number] as const
      data = { tz, location: { type: 'Point', coordinates } }
      await this.db.updateOne({ tz }, { $set: data }, { upsert: true })
    }
    return data
  }
}
