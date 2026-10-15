/** Read only the conversation JSON location from the process environment. */
export function conversationConfigPath(environment: NodeJS.ProcessEnv = process.env): string {
  const filename = environment.AMBROGIO_CONVERSATIONS_CONFIG_PATH;
  if (!filename?.trim()) throw new Error('Missing conversation configuration path');
  return filename;
}
