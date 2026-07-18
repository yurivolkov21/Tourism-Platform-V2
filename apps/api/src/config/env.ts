import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  // Mặc định trỏ compose Postgres local — prod PHẢI override qua env thật.
  DATABASE_URL: z
    .string()
    .startsWith('postgres')
    .default('postgresql://tourism:tourism@localhost:5432/tourism'),
});

export type Env = z.infer<typeof EnvSchema>;

export function parseEnv(raw: NodeJS.ProcessEnv): Env {
  const result = EnvSchema.safeParse(raw);
  if (!result.success) {
    const detail = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid environment: ${detail}`);
  }
  return result.data;
}

export const env: Env = parseEnv(process.env);
