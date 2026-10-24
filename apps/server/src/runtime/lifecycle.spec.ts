import { describe, expect, it } from 'vitest';
import { ProjectError } from '@ambrogio/conversations/application/project-error';
import { collectFaults, createResourceStack, LifecycleError, startupWithCleanup } from './lifecycle.js';

// Verification: Prova dell'arresto ordinato e limitato del server
describe('closing stack of a composition root', () => {
  it('closes each resource once, in reverse order of acquisition, and shares repeated closings', async () => {
    const order: string[] = [];
    const stack = createResourceStack();
    for (const name of ['agents', 'archive', 'speech', 'server']) stack.defer(`${name} failed`, () => { order.push(name); });
    await Promise.all([stack.close(), stack.close()]);
    await stack.close();
    expect(order).toEqual(['server', 'speech', 'archive', 'agents']);
    expect(() => stack.defer('late', () => undefined)).toThrow(ProjectError);
  });

  it('attempts every closing and keeps a single fault, named by its resource, with the original as cause', async () => {
    const order: string[] = [];
    const original = new Error('private driver fault');
    const stack = createResourceStack();
    stack.defer('First could not be closed', () => { order.push('first'); });
    stack.defer('Second could not be closed', async () => { order.push('second'); throw original; });
    stack.defer('Third could not be closed', () => { order.push('third'); });
    const failure = await stack.close().then(() => undefined, (error: unknown) => error);
    expect(order).toEqual(['third', 'second', 'first']);
    expect(failure).toBeInstanceOf(ProjectError);
    expect(failure).not.toBeInstanceOf(LifecycleError);
    expect((failure as Error).message).toBe('Second could not be closed');
    expect((failure as Error).cause).toBe(original);
    expect(stack.faults).toEqual([failure]);
  });

  it('collects several faults in order, by identity, without making one the cause of another', async () => {
    const own = new ProjectError('Agent MCP connection could not be closed: home');
    const external = new Error('private fault');
    const stack = createResourceStack('Server shutdown failed');
    stack.defer('Agents could not be closed', () => { throw own; });
    stack.defer('Archive could not be closed', () => { throw external; });
    const failure = await stack.close().then(() => undefined, (error: unknown) => error) as LifecycleError;
    expect(failure).toBeInstanceOf(LifecycleError);
    expect(failure.message).toBe('Server shutdown failed');
    expect(failure.cause).toBeUndefined();
    expect(failure.faults).toHaveLength(2);
    expect((failure.faults[0] as Error).cause).toBe(external);
    // A project error already names what failed and is kept by identity.
    expect(failure.faults[1]).toBe(own);
  });

  it('exposes the faults observed while a closing is still pending', async () => {
    const stack = createResourceStack();
    stack.defer('Never closes', () => new Promise(() => { /* never */ }));
    stack.defer('Fails first', () => { throw new Error('private'); });
    void stack.close();
    await new Promise(resolve => setImmediate(resolve));
    expect(stack.faults.map(fault => (fault as Error).message)).toEqual(['Fails first']);
  });

  it('keeps a startup failure first and alone when the cleanup succeeds', () => {
    const startup = new Error('startup');
    const cleanup = new Error('cleanup');
    expect(startupWithCleanup('Server startup failed', startup, [])).toBe(startup);
    const both = startupWithCleanup('Server startup failed', startup, [cleanup]) as LifecycleError;
    expect(both.faults).toEqual([startup, cleanup]);
    expect(both.cause).toBeUndefined();
    expect(collectFaults('x', [startup])).toBe(startup);
  });
});
