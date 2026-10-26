import { describe, expect, it } from 'vitest';
import { ProjectError } from '@ambrogio/conversations/application/project-error';
import { capturedBaseLogger } from '../../test/support/logger-fixture.js';
import { LifecycleError } from './lifecycle.js';
import { errorView, redactSensitive } from './logger.js';

describe('base logger of the backend', () => {
  // Verification: Prova del logger minimo del backend
  it('emits one JSON line per event from level info, and derived loggers add context without changing the base', () => {
    const { log, lines } = capturedBaseLogger();
    const first = log.child({ correlationId: 'first' });
    const second = first.child({ operation: 'second' });
    log.debug({ event: 'hidden_debug' });
    log.info({ event: 'base_info' });
    log.warn({ event: 'base_event' }, 'Base');
    first.error({ event: 'first_event' });
    second.error({ event: 'second_event' });
    log.error({ event: 'base_again' });
    const rows = lines();
    expect(rows.map(row => row.event)).toEqual(['base_info', 'base_event', 'first_event', 'second_event', 'base_again']);
    expect(rows[0]).toMatchObject({ level: 30 });
    rows.shift();
    expect(rows[0]).toMatchObject({ level: 40, msg: 'Base' });
    expect(rows[0]).not.toHaveProperty('correlationId');
    expect(rows[1]).toMatchObject({ correlationId: 'first' });
    expect(rows[1]).not.toHaveProperty('operation');
    expect(rows[2]).toMatchObject({ correlationId: 'first', operation: 'second' });
    expect(rows[3]).not.toHaveProperty('correlationId');
    expect(rows[1]).not.toHaveProperty('msg');
  });

  // Verification: Prova del logger minimo del backend
  it('redacts sensitive fields and credential variables at any depth without changing the originals', () => {
    const { log, output } = capturedBaseLogger();
    const nested = { headers: { Authorization: 'Bearer PRIVATE_A' }, items: [{ apiKey: 'PRIVATE_B' }],
      config: { MISTRAL_API_KEY: 'PRIVATE_C', mcp: { auth: { token: 'PRIVATE_D', password: 'PRIVATE_E' } } } };
    const copy = structuredClone(nested);
    log.child({ client_secret: 'PRIVATE_F', correlationId: 'id' }).error({ event: 'redaction', nested,
      HA_TOKEN: 'PRIVATE_G', Cookie: 'PRIVATE_H', credentials: 'PRIVATE_I', 'api-key': 'PRIVATE_J', kept: 'visible' });
    const text = output.join('');
    expect(text).not.toMatch(/PRIVATE_/);
    expect(text).toContain('visible');
    expect(text).toContain('"correlationId":"id"');
    expect(nested).toEqual(copy);
    const row = JSON.parse(text) as Record<string, any>;
    expect(row.nested.config.mcp.auth).toEqual({ token: '[redacted]', password: '[redacted]' });
    expect(row.client_secret).toBe('[redacted]');
  });

  it('keeps errors and other objects by identity and tolerates cycles', () => {
    const error = new Error('kept');
    const cyclic: Record<string, unknown> = { name: 'cycle' };
    cyclic.self = cyclic;
    const value = redactSensitive({ err: error, cyclic, date: new Date(0) });
    expect(value.err).toBe(error);
    expect((value.cyclic as Record<string, unknown>).self).toBe(cyclic);
  });

  // Verification: Prova del campo err nel log definitivo
  it('serializes err with the controlled view and never modifies the original errors', () => {
    const { log, lines } = capturedBaseLogger();
    const cause = new Error('PRIVATE_CAUSE');
    const project = new ProjectError('Conversation archive could not be closed', { cause });
    const external = Object.assign(new TypeError('PRIVATE_MESSAGE'), { token: 'PRIVATE_PROPERTY' });
    external.stack = 'PRIVATE_STACK';
    const lifecycle = new LifecycleError('Server shutdown failed', [project, external]);
    const before = [project, external, cause].map(item => Object.getOwnPropertyDescriptors(item));
    log.error({ event: 'project', err: project });
    log.error({ event: 'external', err: external });
    log.error({ event: 'lifecycle', err: lifecycle });
    const rows = lines();
    expect(rows[0]!.err).toEqual({ type: 'ProjectError', message: project.message, stack: project.stack });
    const opaque = { type: 'Error', message: 'Unexpected backend failure', stack: '[redacted]' };
    expect(rows[1]!.err).toEqual(opaque);
    expect(rows[2]!.err).toEqual({ type: 'LifecycleError', message: 'Server shutdown failed', stack: lifecycle.stack,
      faults: [{ type: 'ProjectError', message: project.message, stack: project.stack }, opaque] });
    // Without a message, Pino does not take the message of the error.
    expect(rows[1]).not.toHaveProperty('msg');
    expect(JSON.stringify(rows)).not.toMatch(/PRIVATE_/);
    expect([project, external, cause].map(item => Object.getOwnPropertyDescriptors(item))).toEqual(before);
    expect(project.cause).toBe(cause);
    expect(errorView('a string')).toEqual(opaque);
  });
});
