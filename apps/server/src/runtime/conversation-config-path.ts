import { ProjectError } from '@ambrogio/conversations/application/project-error';
/** Read only the conversation JSON location from the process environment. */
export function conversationConfigPath(environment: NodeJS.ProcessEnv = process.env): string {
  const filename = environment.AMBROGIO_CONVERSATIONS_CONFIG_PATH;
  if (!filename?.trim()) throw new ProjectError('Missing conversation configuration path');
  return filename;
}
