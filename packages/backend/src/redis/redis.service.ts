import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { RedisStore } from 'cache-manager-ioredis-yet';
import { Redis } from 'ioredis';

@Injectable()
export class RedisService {
  constructor(@Inject(CACHE_MANAGER) private readonly cacheManager: Cache) {}

  getClient(): Redis {
    // The `cache-manager` in v5+ structure accesses stores via an array or properties depending on how it's wrapped.
    // In @nestjs/cache-manager with cache-manager-ioredis-yet, the underlying store needs to be type-cast.
    // However, it seems cache-manager v6/v7 changed the interface slightly. Let's just create a direct client for raw access to be safe, 
    // or we can extract it if we cast it to any first.
    return (this.cacheManager as any).store.client;
  }
}
