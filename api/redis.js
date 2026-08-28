// api/redis.js
// Detect which environment variables are available
const hasVercelKV = process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN;
const hasUpstash = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN;

let redis;

if (hasVercelKV) {
  // Project 1: Use Vercel KV
  const { kv } = require('@vercel/kv');
  redis = kv;
} else if (hasUpstash) {
  // Project 2: Use Upstash directly
  const { Redis } = require('@upstash/redis');
  redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
} else {
  throw new Error('No Redis configuration found. Please set up environment variables.');
}

module.exports = redis;
