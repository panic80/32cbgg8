import request from 'supertest';
// Import the Express app from main.js (exports default app)
import app from '../server/main.js';

(async () => {
  try {
    const res = await request(app).get('/health');
    console.log(JSON.stringify(res.body, null, 2));
    process.exit(res.statusCode === 200 ? 0 : 2);
  } catch (err) {
    console.error('Health check failed:', err?.message || err);
    process.exit(1);
  }
})();
