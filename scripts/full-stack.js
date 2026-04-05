import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

console.log('\n--- 🚀 TECHSPHERE FULL-STACK RUNNER ---\n');

// 1. Start the API Server
const apiProcess = spawn('node', ['--env-file=.env', 'scripts/api-server.js'], {
  cwd: rootDir,
  stdio: 'inherit',
  shell: true
});

// 2. Start the Vite Dev Server
const viteProcess = spawn('npx', ['vite'], {
  cwd: rootDir,
  stdio: 'inherit',
  shell: true
});

// Handle termination
const killAll = () => {
  console.log('\nStopping servers...');
  apiProcess.kill();
  viteProcess.kill();
  process.exit();
};

process.on('SIGINT', killAll);
process.on('SIGTERM', killAll);

apiProcess.on('exit', (code) => {
  if (code !== 0) console.error(`API server exited with code ${code}`);
});

viteProcess.on('exit', (code) => {
  if (code !== 0) console.error(`Vite server exited with code ${code}`);
});
