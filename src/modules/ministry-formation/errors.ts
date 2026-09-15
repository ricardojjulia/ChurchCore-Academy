export class PermanentRecordError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PermanentRecordError';
  }
}
