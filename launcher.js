const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const PROJECT_DIR = __dirname;
const LOG_FILE = path.join(PROJECT_DIR, 'dev.log');

function startServer() {
  const env = {
    ...process.env,
    DATABASE_URL: 'postgresql://postgres.hojpkyszlbjkscbwquuz:3lolScar%4025%23@aws-0-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true',
    DIRECT_URL: 'postgresql://postgres.hojpkyszlbjkscbwquuz:3lolScar%4025%23@aws-0-eu-west-1.pooler.supabase.com:5432/postgres',
  };

  const child = spawn('node', [
    path.join(PROJECT_DIR, 'node_modules/.bin/next'),
    'dev', '-p', '3000'
  ], {
    env,
    cwd: PROJECT_DIR,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const logStream = fs.createWriteStream(LOG_FILE, { flags: 'w' });

  child.stdout.on('data', (d) => {
    logStream.write(d);
    process.stdout.write(d);
  });

  child.stderr.on('data', (d) => {
    logStream.write(d);
    process.stderr.write(d);
  });

  child.on('exit', (code, signal) => {
    const msg = `[Launcher] Server exited: code=${code} signal=${signal} at ${new Date().toISOString()}\n`;
    fs.appendFileSync(LOG_FILE, msg);
    console.log(msg.trim());
    
    // Restart after a brief delay
    setTimeout(() => {
      console.log('[Launcher] Restarting server...');
      startServer();
    }, 3000);
  });

  console.log(`[Launcher] Server started with PID: ${child.pid}`);
  return child;
}

startServer();
