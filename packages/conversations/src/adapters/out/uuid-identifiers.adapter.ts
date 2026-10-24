import { randomUUID } from 'node:crypto';
import type { NewIdentifier } from '../../application/turn-capabilities.port.js';

export class UuidIdentifiers implements NewIdentifier {
  next(): string {
    return randomUUID();
  }
}
