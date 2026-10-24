import { ProjectError } from '../project-error.js';

const canonicalUuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function isCanonicalUuidV4(value: unknown): value is string {
  return typeof value === 'string' && canonicalUuidV4.test(value);
}

/** The identity of a conversation: a canonical UUID v4, never interchangeable with a turn identity. */
export class ConversationId {
  readonly #value: string;

  private constructor(value: string) {
    this.#value = value;
  }

  /** Represents a received value, new or stored; it never generates an identifier. */
  static create(value: string): ConversationId {
    if (!isCanonicalUuidV4(value)) throw new ProjectError('Invalid conversation identity');
    return new ConversationId(value);
  }

  /** Whether a received value can be a conversation identity, without building it. */
  static isValid(value: unknown): value is string {
    return isCanonicalUuidV4(value);
  }

  get value(): string {
    return this.#value;
  }

  equals(other: ConversationId): boolean {
    return this.#value === other.#value;
  }
}

/** The identity of a turn: a canonical UUID v4, never interchangeable with a conversation identity. */
export class TurnId {
  readonly #value: string;

  private constructor(value: string) {
    this.#value = value;
  }

  /** Represents a received value, new or stored; it never generates an identifier. */
  static create(value: string): TurnId {
    if (!isCanonicalUuidV4(value)) throw new ProjectError('Invalid turn identity');
    return new TurnId(value);
  }

  /** Whether a received value can be a turn identity, without building it. */
  static isValid(value: unknown): value is string {
    return isCanonicalUuidV4(value);
  }

  get value(): string {
    return this.#value;
  }

  equals(other: TurnId): boolean {
    return this.#value === other.#value;
  }
}
