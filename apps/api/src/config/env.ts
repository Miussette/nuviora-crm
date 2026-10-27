import { config } from 'dotenv';
import { resolve } from 'node:path';
import { z } from 'zod';
config({ path: resolve(__dirname, '../../../../.env'), quiet: true });
export const env = z.object({
  DATABASE_URL: z.url(), APP_ORIGIN: z.url(), PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  SMTP_HOST: z.string().min(1), SMTP_PORT: z.coerce.number().int().default(1025),
  SMTP_USER: z.string().optional(), SMTP_PASSWORD: z.string().optional(), MAIL_FROM: z.string().min(1),
}).parse(process.env);
if (env.NODE_ENV === 'production' && !env.APP_ORIGIN.startsWith('https://')) throw new Error('Producción requiere HTTPS');
