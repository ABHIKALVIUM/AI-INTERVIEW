import { z } from 'zod';
import { config } from 'dotenv';
import path from 'path';

// Run from apps/api so process.cwd() is apps/api
config({ path: path.resolve(process.cwd(), '../../.env') });
const envSchema = z.object({
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid URL'),
  JWT_ACCESS_SECRET: z
    .string()
    .min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z
    .string()
    .min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  JWT_ACCESS_EXPIRES_IN: z.string().min(1, 'JWT_ACCESS_EXPIRES_IN is required'),
  JWT_REFRESH_EXPIRES_IN: z
    .string()
    .min(1, 'JWT_REFRESH_EXPIRES_IN is required'),
  GROQ_API_KEY: z.string().min(1, 'GROQ_API_KEY is required'),
  GROQ_BASE_URL: z.string().url('GROQ_BASE_URL must be a valid URL').default('https://api.groq.com/openai/v1'),
  GROQ_MODEL: z.string().default('llama-3.3-70b-versatile'),
  LIVEKIT_URL: z.string().url('LIVEKIT_URL must be a valid URL'),
  LIVEKIT_API_KEY: z.string().min(1, 'LIVEKIT_API_KEY is required'),
  LIVEKIT_API_SECRET: z.string().min(1, 'LIVEKIT_API_SECRET is required'),
  FRONTEND_URL: z.string().url('FRONTEND_URL must be a valid URL'),
  API_PORT: z.coerce
    .number()
    .int()
    .min(1)
    .max(65535)
    .default(4000),
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
});

export type Env = z.infer<typeof envSchema>;

function validateEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const formatted = result.error.errors
      .map((e) => `  • ${e.path.join('.')}: ${e.message}`)
      .join('\n');

    console.error(
      `\n❌  Environment validation failed. Fix the following:\n${formatted}\n`,
    );
    process.exit(1);
  }

  return result.data;
}

export const env = validateEnv();
