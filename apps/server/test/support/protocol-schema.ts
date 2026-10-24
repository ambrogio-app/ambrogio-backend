import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import Ajv2020Module from 'ajv/dist/2020.js';

/** Independent Ajv view of the published ambrogio.v1 schema for test assertions. */
const Ajv2020 = Ajv2020Module.default ?? Ajv2020Module;
const schemaPath = fileURLToPath(new URL('../../../../protocol/ambrogio-v1.schema.json', import.meta.url));
export const protocolSchema: Record<string, unknown> = JSON.parse(readFileSync(schemaPath, 'utf8'));

const ajv = new Ajv2020({ strict: true, allErrors: true, coerceTypes: false,
  useDefaults: false, removeAdditional: false });
ajv.addSchema(protocolSchema);

const clientMessage = ajv.getSchema(`${protocolSchema.$id}#/$defs/clientMessage`)!;
const serverMessage = ajv.getSchema(`${protocolSchema.$id}#/$defs/serverMessage`)!;

export function isClientMessage(value: unknown): boolean { return clientMessage(value) === true; }
export function isServerMessage(value: unknown): boolean { return serverMessage(value) === true; }
