/**
 * @file Defines shared, custom error types for the Academy application.
 */

export class PermanentRecordError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PermanentRecordError";
  }
}

export class InvalidStateTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidStateTransitionError";
  }
}