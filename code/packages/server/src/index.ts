import { createApp } from './app.js';

const app = createApp();
app.start();

let shuttingDown = false;

async function handleShutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received — serializing game state and shutting down`);
  await app.serializeAndShutdown();
  process.exit(0);
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));
