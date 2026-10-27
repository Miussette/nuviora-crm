import { createApp } from './bootstrap';
import { env } from './config/env';
async function bootstrap() { const app = await createApp(); await app.listen(env.PORT, '127.0.0.1'); }
void bootstrap();