import { writeFile } from 'node:fs/promises';

export async function writeConfigFile(filename: string, content: string): Promise<void> {
  await writeFile(filename, filename.endsWith('.ts') ? `export default ${content};\n` : content);
}
