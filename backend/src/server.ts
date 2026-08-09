import { app } from './app.js';
import { env } from './config/env.js';

if (!process.env.VERCEL) {
  app.listen(env.port, () => {
    console.log(`FundsRoom API is running at http://localhost:${env.port}`);
  });
}

export default app;
