export class DomainInvariantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DomainInvariantError";
  }
}

/** Calendar dates still used by effective meetings, exceptions, or Sessions. */
export class CalendarSlotRemovalError extends DomainInvariantError {
  constructor(message: string) {
    super(message);
    this.name = "CalendarSlotRemovalError";
  }
}

export class ImmutablePublishedVersionError extends Error {
  constructor(message = "Published versions are immutable") {
    super(message);
    this.name = "ImmutablePublishedVersionError";
  }
}

export class ConcurrencyConflictError extends Error {
  constructor(message = "The record changed while this operation was in progress") {
    super(message);
    this.name = "ConcurrencyConflictError";
  }
}

export class NotFoundError extends DomainInvariantError {}
export class DuplicateLabelError extends DomainInvariantError {}

export class InstitutionNameConflictError extends DomainInvariantError {
  constructor() {
    super("An institution with this name is archived.");
    this.name = "InstitutionNameConflictError";
  }
}
