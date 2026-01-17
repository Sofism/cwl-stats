// lib/redis.js

// Detectar qué variables de entorno están disponibles
const hasVercelKV = process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN;
const hasUpstash = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN;

let redis;

if (hasVercelKV) {
  // Proyecto 1: Usar Vercel KV
  const { kv } = require('@vercel/kv');
  redis = kv;
} else if (hasUpstash) {
  // Proyecto 2: Usar Upstash directo
  const { Redis } = require('@upstash/redis');
  redis = Redis.fromEnv();
} else {
  throw new Error('No Redis configuration found. Please set up environment variables.');
}

export default redis;
