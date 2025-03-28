import { Module } from "@nestjs/common";
import { CachingService } from "./caching.service";
import { CacheModule } from "@nestjs/cache-manager";
import { createKeyv } from "@keyv/redis";

@Module({
  imports: [
    CacheModule.registerAsync({
      useFactory: async () => {
        return {
          stores: [createKeyv("redis://localhost:6379")],
        };
      },
    }),
  ],
  providers: [CachingService],
})
export class CachingModule { }
