/**
 * Daemon lifecycle — shared between CLI and MCP server.
 *
 * Extracted from cli.ts so the MCP server can start/stop/health-check
 * the browse daemon without duplicating logic.
 *
 * Dependency graph:
 *   daemon.ts ──▶ cli.ts (re-exports for backward compat)
 *              ──▶ mcp-server.ts (daemon lifecycle)
 *              ──▶ config.ts (paths)
 */

import * as fs from 'fs';
import * as path from 'path';
import { resolveConfig, ensureStateDir, readVersionHash } from './config';

const config = resolveConfig();
const IS_WINDOWS = process.platform === 'win32';
const MAX_START_WAIT = IS_WINDOWS ? 15000 : (process.env.CI ? 30000 : 8000);

export interface ServerState {
  pid: number;
  port: number;
  token: string;
  startedAt: string;
  serverPath: string;
  binaryVersion?: string;
  mode?: 'launched' | 'headed';
}

export function getConfig() {
  return config;
}

export function getMaxStartWait() {
  return MAX_START_WAIT;
}

export function isWindows() {
  return IS_WINDOWS;
}

export function resolveServerScript(
  env: Record<string, string | undefined> = process.env,
  metaDir: string = import.meta.dir,
  execPath: string = process.execPath
): string {
  if (env.BROWSE_SERVER_SCRIPT) {
    return env.BROWSE_SERVER_SCRIPT;
  }

  if (!metaDir.includes('$bunfs')) {
    const direct = path.resolve(metaDir, 'server.ts');
    if (fs.existsSync(direct)) {
      return direct;
    }
  }

  if (execPath) {
    const adjacent = path.resolve(path.dirname(execPath), '..', 'src', 'server.ts');
    if (fs.existsSync(adjacent)) {
      return adjacent;
    }
  }

  throw new Error(
    'Cannot find server.ts. Set BROWSE_SERVER_SCRIPT env or run from the browse source tree.'
  );
}

export function resolveNodeServerScript(
  metaDir: string = import.meta.dir,
  execPath: string = process.execPath
): string | null {
  if (!metaDir.includes('$bunfs')) {
    const distScript = path.resolve(metaDir, '..', 'dist', 'server-node.mjs');
    if (fs.existsSync(distScript)) return distScript;
  }

  if (execPath) {
    const adjacent = path.resolve(path.dirname(execPath), 'server-node.mjs');
    if (fs.existsSync(adjacent)) return adjacent;
  }

  return null;
}

export function readState(): ServerState | null {
  try {
    const data = fs.readFileSync(config.stateFile, 'utf-8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export function isProcessAlive(pid: number): boolean {
  if (IS_WINDOWS) {
    try {
      const result = Bun.spawnSync(
        ['tasklist', '/FI', `PID eq ${pid}`, '/NH', '/FO', 'CSV'],
        { stdout: 'pipe', stderr: 'pipe', timeout: 3000 }
      );
      return result.stdout.toString().includes(`"${pid}"`);
    } catch {
      return false;
    }
  }
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export async function isServerHealthy(port: number): Promise<boolean> {
  try {
    const resp = await fetch(`http://127.0.0.1:${port}/health`, {
      signal: AbortSignal.timeout(2000),
    });
    if (!resp.ok) return false;
    const health = await resp.json() as any;
    return health.status === 'healthy';
  } catch {
    return false;
  }
}

export async function killServer(pid: number): Promise<void> {
  if (!isProcessAlive(pid)) return;

  if (IS_WINDOWS) {
    try {
      Bun.spawnSync(
        ['taskkill', '/PID', String(pid), '/T', '/F'],
        { stdout: 'pipe', stderr: 'pipe', timeout: 5000 }
      );
    } catch {}
    const deadline = Date.now() + 2000;
    while (Date.now() < deadline && isProcessAlive(pid)) {
      await Bun.sleep(100);
    }
    return;
  }

  try { process.kill(pid, 'SIGTERM'); } catch { return; }

  const deadline = Date.now() + 2000;
  while (Date.now() < deadline && isProcessAlive(pid)) {
    await Bun.sleep(100);
  }

  if (isProcessAlive(pid)) {
    try { process.kill(pid, 'SIGKILL'); } catch {}
  }
}

export async function startServer(extraEnv?: Record<string, string>): Promise<ServerState> {
  ensureStateDir(config);

  try { fs.unlinkSync(config.stateFile); } catch {}
  try { fs.unlinkSync(path.join(config.stateDir, 'browse-startup-error.log')); } catch {}

  const serverScript = resolveServerScript();
  const nodeScript = IS_WINDOWS ? resolveNodeServerScript() : null;
  let proc: any = null;

  if (IS_WINDOWS && nodeScript) {
    const launcherCode =
      `const{spawn}=require('child_process');` +
      `spawn(process.execPath,[${JSON.stringify(nodeScript)}],` +
      `{detached:true,stdio:['ignore','ignore','ignore'],env:Object.assign({},process.env,` +
      `{BROWSE_STATE_FILE:${JSON.stringify(config.stateFile)}})}).unref()`;
    Bun.spawnSync(['node', '-e', launcherCode], { stdio: ['ignore', 'ignore', 'ignore'] });
  } else {
    proc = Bun.spawn(['bun', 'run', serverScript], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, BROWSE_STATE_FILE: config.stateFile, ...extraEnv },
    });
    proc.unref();
  }

  const start = Date.now();
  while (Date.now() - start < MAX_START_WAIT) {
    const state = readState();
    if (state && await isServerHealthy(state.port)) {
      return state;
    }
    await Bun.sleep(100);
  }

  if (proc?.stderr) {
    const reader = proc.stderr.getReader();
    const { value } = await reader.read();
    if (value) {
      const errText = new TextDecoder().decode(value);
      throw new Error(`Server failed to start:\n${errText}`);
    }
  } else {
    const errorLogPath = path.join(config.stateDir, 'browse-startup-error.log');
    try {
      const errorLog = fs.readFileSync(errorLogPath, 'utf-8').trim();
      if (errorLog) {
        throw new Error(`Server failed to start:\n${errorLog}`);
      }
    } catch (e: any) {
      if (e.code !== 'ENOENT') throw e;
    }
  }
  throw new Error(`Server failed to start within ${MAX_START_WAIT / 1000}s`);
}

function acquireServerLock(): (() => void) | null {
  const lockPath = `${config.stateFile}.lock`;
  try {
    const fd = fs.openSync(lockPath, 'wx');
    fs.writeSync(fd, `${process.pid}\n`);
    fs.closeSync(fd);
    return () => { try { fs.unlinkSync(lockPath); } catch {} };
  } catch {
    try {
      const holderPid = parseInt(fs.readFileSync(lockPath, 'utf8').trim(), 10);
      if (holderPid && isProcessAlive(holderPid)) {
        return null;
      }
      fs.unlinkSync(lockPath);
      return acquireServerLock();
    } catch {
      return null;
    }
  }
}

export async function ensureServer(): Promise<ServerState> {
  const state = readState();

  if (state && await isServerHealthy(state.port)) {
    const currentVersion = readVersionHash();
    if (currentVersion && state.binaryVersion && currentVersion !== state.binaryVersion) {
      console.error('[browse] Binary updated, restarting server...');
      await killServer(state.pid);
      return startServer();
    }
    return state;
  }

  if (state && state.mode === 'headed' && isProcessAlive(state.pid)) {
    console.error(`[browse] Headed server running (PID ${state.pid}) but not responding.`);
    console.error(`[browse] Run '$B connect' to restart.`);
    process.exit(1);
  }

  ensureStateDir(config);

  const releaseLock = acquireServerLock();
  if (!releaseLock) {
    console.error('[browse] Another instance is starting the server, waiting...');
    const start = Date.now();
    while (Date.now() - start < MAX_START_WAIT) {
      const freshState = readState();
      if (freshState && await isServerHealthy(freshState.port)) return freshState;
      await Bun.sleep(200);
    }
    throw new Error('Timed out waiting for another instance to start the server');
  }

  try {
    const freshState = readState();
    if (freshState && await isServerHealthy(freshState.port)) {
      return freshState;
    }

    if (state && state.pid) {
      await killServer(state.pid);
    }
    console.error('[browse] Starting server...');
    return await startServer();
  } finally {
    releaseLock();
  }
}

export async function sendCommand(state: ServerState, command: string, args: string[], retries = 0): Promise<string> {
  const body = JSON.stringify({ command, args });

  try {
    const resp = await fetch(`http://127.0.0.1:${state.port}/command`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.token}`,
      },
      body,
      signal: AbortSignal.timeout(30000),
    });

    if (resp.status === 401) {
      const newState = readState();
      if (newState && newState.token !== state.token) {
        return sendCommand(newState, command, args);
      }
      throw new Error('Authentication failed');
    }

    const text = await resp.text();

    if (resp.ok) {
      return text;
    } else {
      try {
        const err = JSON.parse(text);
        throw new Error(err.error || text);
      } catch (e: any) {
        if (e.message && !e.message.startsWith('Unexpected')) throw e;
        throw new Error(text);
      }
    }
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error('[browse] Command timed out after 30s');
    }
    if (err.code === 'ECONNREFUSED' || err.code === 'ECONNRESET' || err.message?.includes('fetch failed')) {
      if (retries >= 1) throw new Error('[browse] Server crashed twice in a row — aborting');
      console.error('[browse] Server connection lost. Restarting...');
      const oldState = readState();
      if (oldState && oldState.pid) {
        await killServer(oldState.pid);
      }
      const newState = await startServer();
      return sendCommand(newState, command, args, retries + 1);
    }
    throw err;
  }
}
