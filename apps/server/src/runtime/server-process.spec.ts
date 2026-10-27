import { EventEmitter } from 'node:events';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProjectError } from '@ambrogio/conversations/application/project-error';
import { capturedBaseLogger } from '../../test/support/logger-fixture.js';
import { createResourceStack, LifecycleError } from './lifecycle.js';
import { listen, runServerProcess, SHUTDOWN_TIMEOUT_MS, unrefShutdownTimer, type ShutdownTimer } from './server-process.js';

afterEach(() => {
  vi.restoreAllMocks();
});

/** A timer controlled by the test: it records each arming and fires on demand. */
function controlledTimer() {
  const armed: { delayMs: number; callback: () => void; cancelled: boolean }[] = [];
  const timer: ShutdownTimer = (delayMs, callback) => {
    const entry = { delayMs, callback, cancelled: false };
    armed.push(entry);
    return { cancel: () => { entry.cancelled = true; } };
  };
  return { timer, armed };
}

/** A built entry point whose closing is a stack of controlled resources. */
function entryPoint(closings: readonly (readonly [string, () => unknown])[]) {
  const stack = createResourceStack('Server shutdown failed');
  for (const [failure, close] of closings) stack.defer(failure, close);
  const close = vi.fn(() => stack.close());
  return { close, get faults() { return stack.faults; } };
}

async function settle() { for (let i = 0; i < 5; i++) await new Promise(resolve => setImmediate(resolve)); }

function harness() {
  const signals = new EventEmitter();
  const stderr: string[] = [];
  const output = capturedBaseLogger();
  const { timer, armed } = controlledTimer();
  return { signals, stderr, output, timer, armed,
    options: { log: output.log, signals, timer, stderr: (line: string) => { stderr.push(line); } } };
}

describe('runner of the server process', () => {
  // Verification: Prova della costruzione del server senza ascolto
  // Verification: Prova dell'arresto ordinato e limitato del server
  it('activates after building, runs one shutdown for repeated signals and exits with 0 without logs', async () => {
    const h = harness();
    const order: string[] = [];
    const built = entryPoint([['Archive could not be closed', () => { order.push('archive'); }],
      ['Server could not be closed', () => { order.push('server'); }]]);
    const outcome = runServerProcess({ ...h.options, build: async () => { order.push('build'); return built; },
      activate: async () => { order.push('activate'); } });
    await settle();
    expect(order).toEqual(['build', 'activate']);
    h.signals.emit('SIGTERM');
    h.signals.emit('SIGINT');
    expect(await outcome).toEqual({ exitCode: 0, force: false });
    expect(order).toEqual(['build', 'activate', 'server', 'archive']);
    expect(built.close).toHaveBeenCalledOnce();
    expect(h.armed).toHaveLength(1);
    expect(h.armed[0]).toMatchObject({ delayMs: SHUTDOWN_TIMEOUT_MS, cancelled: true });
    expect(h.output.lines()).toEqual([]);
    expect(h.signals.listenerCount('SIGTERM')).toBe(0);
  });

  // Verification: Prova della costruzione del server senza ascolto
  it('does not activate when a shutdown is requested during the construction', async () => {
    const h = harness();
    const built = entryPoint([]);
    const activate = vi.fn(async () => undefined);
    const outcome = await runServerProcess({ ...h.options, activate,
      build: async () => { h.signals.emit('SIGTERM'); return built; } });
    expect(outcome).toEqual({ exitCode: 0, force: false });
    expect(activate).not.toHaveBeenCalled();
    expect(built.close).toHaveBeenCalledOnce();
  });

  // Verification: Prova della diagnostica del mancato avvio
  it('reports a failed construction once on stdout and stderr and exits with 1', async () => {
    const h = harness();
    const activate = vi.fn(async () => undefined);
    const outcome = await runServerProcess({ ...h.options, activate,
      build: async () => { throw new ProjectError('Missing environment variable AMBROGIO_HTTP_HOST'); } });
    expect(outcome).toEqual({ exitCode: 1, force: false });
    expect(activate).not.toHaveBeenCalled();
    expect(h.output.lines()).toEqual([expect.objectContaining({ level: 50, event: 'server_startup_failed',
      msg: 'Server startup failed', err: expect.objectContaining({ type: 'ProjectError',
        message: 'Missing environment variable AMBROGIO_HTTP_HOST' }) })]);
    expect(h.stderr).toEqual(['Unable to start HTTP server.\n']);
  });

  // Verification: Prova della diagnostica del mancato avvio
  it('keeps the activation failure first and the failed cleanup after it', async () => {
    const h = harness();
    const built = entryPoint([['Conversation archive could not be closed', () => { throw new Error('PRIVATE_CLEANUP'); }]]);
    const outcome = await runServerProcess({ ...h.options, build: async () => built,
      activate: () => listen({ address: { host: '127.0.0.1', port: 1 },
        server: { listen: async () => { throw new Error('PRIVATE_LISTEN'); } } }) });
    expect(outcome).toEqual({ exitCode: 1, force: false });
    const [row] = h.output.lines();
    expect(row).toMatchObject({ event: 'server_startup_failed', err: { type: 'LifecycleError',
      message: 'Server startup failed', faults: [
        { type: 'ProjectError', message: 'HTTP listener could not start' },
        { type: 'ProjectError', message: 'Conversation archive could not be closed' }] } });
    expect(h.output.lines()).toHaveLength(1);
    expect(h.output.output.join('')).not.toMatch(/PRIVATE_/);
    expect(h.stderr).toEqual(['Unable to start HTTP server.\n']);
  });

  // Verification: Prova dell'arresto ordinato e limitato del server
  it('logs a failed shutdown once with every closing fault and exits with 1', async () => {
    const h = harness();
    const order: string[] = [];
    const built = entryPoint([
      ['Agent MCP connections could not be closed', () => { order.push('agents'); throw new Error('PRIVATE_A'); }],
      ['Conversation archive could not be closed', () => { order.push('archive'); }],
      ['HTTP server could not be closed', () => { order.push('server'); throw new Error('PRIVATE_B'); }]]);
    const outcome = runServerProcess({ ...h.options, build: async () => built, activate: async () => undefined });
    await settle();
    h.signals.emit('SIGTERM');
    expect(await outcome).toEqual({ exitCode: 1, force: false });
    expect(order).toEqual(['server', 'archive', 'agents']);
    const rows = h.output.lines();
    expect(rows).toEqual([expect.objectContaining({ level: 50, event: 'server_shutdown_failed',
      msg: 'Server shutdown failed', err: expect.objectContaining({ type: 'LifecycleError', faults: [
        expect.objectContaining({ message: 'HTTP server could not be closed' }),
        expect.objectContaining({ message: 'Agent MCP connections could not be closed' })] }) })]);
    expect(h.output.output.join('')).not.toMatch(/PRIVATE_/);
  });

  // Verification: Prova dell'arresto ordinato e limitato del server
  it('at the end of the shutdown window logs the faults already observed and forces the exit with 1', async () => {
    const h = harness();
    const built = entryPoint([['Agent MCP connections could not be closed', () => new Promise(() => { /* never */ })],
      ['HTTP server could not be closed', () => { throw new Error('PRIVATE_C'); }]]);
    const outcome = runServerProcess({ ...h.options, build: async () => built, activate: async () => undefined });
    await settle();
    h.signals.emit('SIGTERM');
    await settle();
    h.signals.emit('SIGTERM');
    await settle();
    expect(h.armed).toHaveLength(1);
    h.armed[0]!.callback();
    expect(await outcome).toEqual({ exitCode: 1, force: true });
    expect(h.output.lines()).toEqual([expect.objectContaining({ level: 50, event: 'server_shutdown_timeout',
      msg: 'Server shutdown timed out', timeoutMs: 10_000,
      err: expect.objectContaining({ type: 'ProjectError', message: 'HTTP server could not be closed' }) })]);
    expect(h.output.output.join('')).not.toMatch(/PRIVATE_/);
  });

  it('logs the expiry without err when no fault was observed', async () => {
    const h = harness();
    const built = entryPoint([['Never closes', () => new Promise(() => { /* never */ })]]);
    const outcome = runServerProcess({ ...h.options, build: async () => built, activate: async () => undefined });
    await settle();
    h.signals.emit('SIGINT');
    await settle();
    h.armed[0]!.callback();
    expect(await outcome).toEqual({ exitCode: 1, force: true });
    const [row] = h.output.lines();
    expect(row).toMatchObject({ event: 'server_shutdown_timeout', timeoutMs: 10_000 });
    expect(row).not.toHaveProperty('err');
  });

  it('arms the default shutdown timer without keeping the process alive', () => {
    const unref = vi.fn();
    vi.spyOn(globalThis, 'setTimeout').mockReturnValue({ unref } as unknown as ReturnType<typeof setTimeout>);
    unrefShutdownTimer(SHUTDOWN_TIMEOUT_MS, () => undefined);
    expect(unref).toHaveBeenCalledOnce();
  });
});
