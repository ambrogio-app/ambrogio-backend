import { writeFile } from 'node:fs/promises';

/** Preserve existing fixture objects while exercising the TypeScript module loader. */
export async function writeConfigFile(filename: string, content: string): Promise<void> {
  await writeFile(filename, filename.endsWith('.ts') ? `export default ${content};\n` : content);
}
