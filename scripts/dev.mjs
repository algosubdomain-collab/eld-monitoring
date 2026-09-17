// API serverni va Vite'ni birga ishga tushiradi: npm run dev
//
// API doim o'z portida turadi (API_PORT, standart 3000). Tashqaridan kelgan
// PORT o'zgaruvchisi Vite uchun, shuning uchun uni API'ga uzatmaymiz —
// aks holda ikkalasi bitta portga urinadi.
import { spawn } from 'node:child_process';

const API_PORT = process.env.API_PORT ?? '3000';
const { PORT, ...rest } = process.env;

const procs = [
  ['api', 'node', ['--env-file-if-exists=.env', 'src/server.js'], { ...rest, PORT: API_PORT }],
  ['web', 'npx', ['vite'], { ...rest, API_PORT }],
].map(([name, cmd, args, env]) => {
  const p = spawn(cmd, args, { stdio: 'inherit', env });
  p.on('exit', (code) => { if (code) process.exit(code); });
  return p;
});

const stop = () => { procs.forEach((p) => p.kill('SIGTERM')); process.exit(0); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
