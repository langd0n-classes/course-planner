export class DomainInvariantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DomainInvariantError";
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
