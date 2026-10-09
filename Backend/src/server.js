require('dotenv').config();

const { createServer } = require('http');
const app = require('./app');
const { connectDatabase } = require('./config/database');
const { configureRealtime } = require('./realtime');

const port = Number(process.env.PORT) || 5000;

async function start() {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters. Add it to Backend/.env.');
  }
  await connectDatabase();
  const server = createServer(app);
  configureRealtime(server, app);
  server.listen(port, () => console.log(`Tutor Link API and real-time chat running on http://localhost:${port}`));
}

start().catch((error) => {
  console.error(`Failed to start API: ${error.message}`);
  process.exitCode = 1;
});
