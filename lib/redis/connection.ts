// lib/redis/connection.ts

import { Redis } from "ioredis";

// Reuses the same connection pattern as video-profile-prototype.
// If your Redis isn't on localhost:6379, set REDIS_URL in .env.
const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";

// BullMQ requires maxRetriesPerRequest: null on the connection it's given.
export function createRedisConnection() {
  return new Redis(REDIS_URL, {
    maxRetriesPerRequest: null,
  });
}