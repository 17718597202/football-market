/**
 * 一体化 worker：同时跑 scan-deposits + settle-cron
 * 适合内部 MVP，不想跑多个进程时使用
 */
import 'dotenv/config';
import { spawn } from 'child_process';

function start(name: string, args: string[]) {
  const p = spawn('npx', ['tsx', ...args], { stdio: 'inherit' });
  p.on('exit', (code) => {
    console.log(`[worker] ${name} 退出 code=${code}，5 秒后重启`);
    setTimeout(() => start(name, args), 5000);
  });
}

start('scan-deposits', ['scripts/scan-deposits.ts']);
start('settle-cron', ['scripts/settle-cron.ts', '--loop']);
start('sync-matches', ['scripts/sync-matches.ts', '--auto', '--loop']);
