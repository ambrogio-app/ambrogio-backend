/** An error created by Ambrogio code whose diagnostic stack may be logged. */
export class ProjectError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'ProjectError';
  }
}
