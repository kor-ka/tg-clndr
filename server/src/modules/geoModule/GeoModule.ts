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

  geocode = async (text: string) => {
    const res = await (await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(text)}&key=${key}`)).json();
    const result = res?.results?.[0]
    if (result && result.geometry.location && result.formatted_address) {
      const location = [result.geometry.location.lat as number, result.geometry.location.lng as number] as const;
      const address = result.formatted_address as string;
      return { location, address }
    }
  }
}
