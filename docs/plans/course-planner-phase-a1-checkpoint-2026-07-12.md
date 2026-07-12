# Course Planner Phase A.1 Checkpoint — 2026-07-12

## Outcome

Phase A.1 refreezes the redesign foundation before implementation proceeds into
the vertical slices. The schema, seed, public route inventory, DTOs, lifecycle
semantics, clone preview/apply contract, and planned-versus-delivered ownership
rules now agree with the v2.2 amendment.

The branch remains a draft checkpoint. It should not be merged or used to start
Phase B until the operator accepts the refreeze.

## Validation

Validated in `node:22-bookworm` against a clean reset of the disposable redesign
PostgreSQL database:

- both redesign migrations apply from empty;
- the generic Path A seed completes;
- TypeScript typecheck passes;
- all 81 tests pass;
- lint passes across every Phase A.1-changed application, API, contract,
  service, and seed file; and
- the Next.js production build succeeds.

The repository-wide lint command still fails in legacy client pages frozen for
later replacement. Those files are outside the Phase A.1 diff. The failures are
primarily React 19 effect-state and declaration-order rules and should be removed
with the legacy UI rather than churned immediately before replacement.

Dependency installation also reports 18 existing audit findings (1 low,
5 moderate, 11 high, and 1 critical). No automated audit fix was applied because
dependency upgrades are outside this refreeze and may introduce unrelated
breakage. This needs a separately scoped dependency review.

## Model-routing experiment

The phase tested the intended cost ladder:

1. `gpt-5.4-mini` performed a contract-audit attempt but became repetitive and
   was stopped after high token use without a usable deliverable.
2. A second mini implementation attempt likewise consumed substantial context
   without editing the repository and was stopped.
3. Claude Sonnet produced the implementation patch in two connected runs; the
   first hit its turn cap and the continued run completed successfully.
4. The frontier coordinator reviewed and corrected cross-cutting contract details
   before validation, including lifecycle concurrency, clone preview/apply
   discrimination, nullable delivered-state diffs, and typed impact DTOs.

The useful lesson is not simply that the small model failed. Broad contract work
with many authoritative documents is a poor fit for an unconstrained small-model
prompt. Small models remain appropriate for narrow mechanical tasks with bounded
file lists and executable acceptance checks.

## Launcher lesson

The first background attempt used the launch policy but bypassed its durable
launcher after user-systemd was unavailable; the fallback process was reaped.
Future delegated phases must use the `launch` skill's actual background launcher.
On this host, tmux is the durable fallback when user-systemd is unavailable. This
allows the coordinator to disconnect or do other work without waiting on the
worker process.

## Gate A.1 questions

- Accept the v2.2 schema and API refreeze as the foundation for Phase B?
- Keep the legacy lint debt isolated until the corresponding UI is replaced?
- Open a separate, non-blocking dependency-security review now, or defer it until
  after the first vertical slice?

If accepted, the next implementation phase should be launched durably and split
into narrow vertical-slice work packets, with a product and academic-lens review
at its checkpoint.
