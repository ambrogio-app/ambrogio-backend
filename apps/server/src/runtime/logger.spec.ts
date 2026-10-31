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

  // Verification: Prova del logger minimo del backend
  it('redacts shared and circular references, arrays and class instances on copies, without invoking getters', () => {
    const { log, lines } = capturedBaseLogger();
    class Settings {
      apiKey = 'PRIVATE_K';
      visible = 'shown';
      get token(): string { throw new Error('getter invoked'); }
    }
    const shared = { password: 'PRIVATE_S', label: 'shared' };
    const cyclic: Record<string, unknown> = { secret: 'PRIVATE_C', label: 'cycle' };
    cyclic.self = cyclic;
    const settings = new Settings();
    const fields = { first: shared, second: shared, list: [shared, [{ cookie: 'PRIVATE_L' }]], cyclic, settings,
      date: new Date(0) };
    const copy = { shared: structuredClone(shared), cyclicSecret: cyclic.secret };
    log.error({ event: 'references', ...fields });
    const [row] = lines() as Record<string, any>[];
    expect(JSON.stringify(row)).not.toMatch(/PRIVATE_/);
    expect(row!.first).toEqual({ password: '[redacted]', label: 'shared' });
    expect(row!.second).toEqual({ password: '[redacted]', label: 'shared' });
    expect(row!.list[0]).toEqual({ password: '[redacted]', label: 'shared' });
    expect(row!.list[1]).toEqual([{ cookie: '[redacted]' }]);
    expect(row!.cyclic).toMatchObject({ secret: '[redacted]', label: 'cycle' });
    expect(row!.settings).toEqual({ apiKey: '[redacted]', visible: 'shown' });
    expect(row!.date).toBe(new Date(0).toISOString());
    expect(shared).toEqual(copy.shared);
    expect(cyclic.secret).toBe(copy.cyclicSecret);
    expect(cyclic.self).toBe(cyclic);
    expect(settings.apiKey).toBe('PRIVATE_K');
    const redacted = redactSensitive({ a: shared, b: shared, cyclic });
    expect(redacted.a).toBe(redacted.b);
    expect((redacted.cyclic as Record<string, unknown>).self).toBe(redacted.cyclic);
  });

  // Verification: Prova del campo err nel log definitivo
  it('gives every error at any depth and key, also in derived loggers, the controlled view', () => {
    const { log, lines } = capturedBaseLogger();
    const project = new ProjectError('Agent MCP connection could not be closed: home');
    const external = Object.assign(new Error('PRIVATE_NESTED'), { detail: 'PRIVATE_DETAIL' });
    const before = Object.getOwnPropertyDescriptors(external);
    log.child({ failure: external, context: { inner: [project] } })
      .error({ event: 'nested', reason: { deep: { error: external } }, list: [external, project] });
    const [row] = lines() as Record<string, any>[];
    const opaque = { type: 'Error', message: 'Unexpected backend failure', stack: '[redacted]' };
    const projectView = { type: 'ProjectError', message: project.message, stack: project.stack };
    expect(row!.failure).toEqual(opaque);
    expect(row!.context.inner).toEqual([projectView]);
    expect(row!.reason.deep.error).toEqual(opaque);
    expect(row!.list).toEqual([opaque, projectView]);
    expect(JSON.stringify(row)).not.toMatch(/PRIVATE_/);
    expect(Object.getOwnPropertyDescriptors(external)).toEqual(before);
  });

  // Verification: Prova del campo err nel log definitivo
  it('shows an external AggregateError with a constant description and the views of its errors', () => {
    const { log, lines } = capturedBaseLogger();
    const project = new ProjectError('Conversation archive could not be prepared');
    const aggregate = new AggregateError([project, new TypeError('PRIVATE_INNER'), 'PRIVATE_VALUE'], 'PRIVATE_OUTER');
    log.error({ event: 'aggregate', err: aggregate, nested: { aggregate } });
    const [row] = lines() as Record<string, any>[];
    const opaque = { type: 'Error', message: 'Unexpected backend failure', stack: '[redacted]' };
    const view = { type: 'AggregateError', message: 'Unexpected backend failure', stack: '[redacted]',
      errors: [{ type: 'ProjectError', message: project.message, stack: project.stack }, opaque, opaque] };
    expect(row!.err).toEqual(view);
    expect(row!.nested.aggregate).toEqual(view);
    expect(JSON.stringify(row)).not.toMatch(/PRIVATE_/);
    expect(aggregate.message).toBe('PRIVATE_OUTER');
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
