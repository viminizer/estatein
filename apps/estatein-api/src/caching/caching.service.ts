import { Cache, CACHE_MANAGER } from "@nestjs/cache-manager";
import { Inject, Injectable } from "@nestjs/common";
import { CACHE_TTL } from "../libs/config";

@Injectable()
export class CachingService {
  constructor(@Inject(CACHE_MANAGER) private readonly cacheManager: Cache) { }

  public async setCacheData(key: string, value: any) {
    const stringVal = JSON.stringify(value);
    try {
      await this.cacheManager.set(key, stringVal, CACHE_TTL);
      console.log("Cache created successfully for key:", key);
    } catch (err: any) {
      console.log("Error creating cache!", err);
    }
  }

  public async getCacheData(key: string) {
    console.log("KEY", key);
    const result = await this.cacheManager.get<string>(key);
    console.log("RESULT", result);
    if (result) {
      console.log("Cache Hit!");
      return JSON.parse(result);
    } else {
      console.log("Cache Miss!");
      return null;
    }
  }
}
