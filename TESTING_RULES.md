# Testing Rules

## Purpose

This repository uses a **risk-based, test-driven development approach**.

The goal is **not maximum test coverage**.

The goal is:

> **Maximum confidence per test.**

Tests should protect important behavior, system boundaries, failure handling, and known regressions without creating a test suite that is larger, more brittle, or harder to maintain than the application itself.

AI makes tests cheap to generate. It does **not** make tests free to maintain.

Every test must justify its existence.

---

# Core Principles

## 1. Test behaviors, not files

Do not create tests simply because a function, hook, component, class, or module exists.

A codebase with 20 functions does not automatically require 20 test suites.

Prefer testing meaningful application behavior.

Bad:

```text
test normalizeQuery
test buildSearchParams
test getSearchFilters
test mapSearchResponse
test useSearchState
```

Better:

```text
valid search returns expected results
invalid search input is safely rejected
search API failure produces recoverable UI
```

Implementation details may change.

Behavioral requirements should remain stable.

---

## 2. Write the smallest test set that proves correctness

Apply the same discipline to tests that is applied to implementation code.

> **Write the smallest meaningful test set required to define correctness.**

Do not optimize for number of tests.

Do not optimize for coverage percentage.

Do not exhaustively enumerate scenarios without a concrete reason.

A smaller suite with strong tests is preferable to a large suite filled with redundant or speculative tests.

---

# Testing Levels

Tests should be classified into the following levels.

---

# Level 0: Contracts and Structural Safety

## Priority

**Required**

These tests protect boundaries where uncontrolled, external, or uncertain data enters trusted application logic.

Examples include:

- Zod schemas
- runtime validation
- type guards
- API response validation
- URL parameters
- authentication
- authorization
- database boundaries
- external APIs
- LLM responses
- file parsing
- serialization/deserialization
- environment configuration
- null or undefined values crossing system boundaries

Examples:

```text
malformed API response is rejected

missing required field does not reach business logic

unauthorized user cannot access protected resource

invalid route parameter produces controlled error behavior

malformed LLM output does not crash the application
```

These tests are especially important because failures at system boundaries can propagate into unrelated parts of the application.

---

## Error Containment

Critical failures must not result in uncontrolled application failure.

Where applicable, verify that failures result in:

```text
invalid input
    ↓
validation failure
    ↓
controlled application error
    ↓
fallback / retry / error UI
```

rather than:

```text
invalid input
    ↓
unexpected runtime error
    ↓
application crash
```

Prevent conditions such as:

- white-screen failures
- unrecoverable UI states
- corrupt persisted data
- unauthorized data exposure
- invalid state propagation
- uncontrolled exceptions

---

# Level 1: Core Behavior

## Priority

**Required**

Every meaningful feature should have tests proving that its primary behavior works.

Test the reason the feature exists.

Examples:

```text
search returns matching records

saving settings persists the update

login authenticates valid credentials

report generation produces a report

user can update profile information

cache is invalidated after a successful mutation
```

Manual QA is not a replacement for core behavioral tests.

Manual QA proves:

> The feature worked during one interaction.

Automated tests prove:

> This behavior must continue working after future changes.

Do not test every implementation detail involved in producing the behavior.

Test the behavior itself.

---

# Level 2: Failure and Recovery

## Priority

**Usually required**

Test expected failures where incorrect handling could materially damage the user experience or application state.

Examples:

- server errors
- failed mutations
- malformed external responses
- network failure
- timeout
- invalid user input
- missing resources
- failed authentication
- expired authorization
- unavailable dependency
- failed database operation

Examples:

```text
failed save does not update local state

network failure displays a recoverable error

malformed response does not crash the page

failed mutation can be retried

missing resource displays an appropriate not-found state
```

Do not test every theoretically possible failure.

Test failures that are realistic or high impact.

---

# Level 3: High-Risk Edge Cases

## Priority

**Selective**

Edge-case tests require justification.

Examples may include:

- stale cache
- duplicate submission
- concurrent mutations
- race conditions
- empty datasets
- pagination boundaries
- partial responses
- unusual permission transitions
- retries
- idempotency
- stale sessions
- interrupted workflows
- rapid user interaction
- multiple competing requests

Before writing an edge-case test, answer:

> **What realistic failure does this test protect against?**

If there is no strong answer, do not write the test.

A useful edge case generally has at least one of the following:

- meaningful likelihood
- high impact
- history of causing bugs
- external or untrusted input
- concurrency risk
- data-loss risk
- security implications

---

# Level 4: Regression Tests

## Priority

**Required when a real bug is discovered**

Every meaningful bug should usually produce a regression test.

Use this sequence:

```text
reproduce bug
↓
write failing test
↓
prove test is red
↓
fix bug
↓
prove test is green
↓
keep test permanently
```

Regression tests are particularly valuable because they represent failures the system has actually experienced.

Prefer evidence from real failures over speculative test scenarios.

---

# Level 5: Exhaustive and Defensive Testing

## Priority

**Rare**

Examples include:

- exhaustive input permutations
- large compatibility matrices
- unusual browser behavior
- impossible internal states
- extremely unlikely malformed inputs
- combinatorial testing
- exhaustive boundary enumeration

Do not write these tests by default.

Use them only when the domain requires them.

Examples where exhaustive testing may be justified:

- financial calculations
- billing
- security-sensitive logic
- authentication
- permissions
- parsers
- cryptographic behavior
- safety-critical systems
- complex state machines

---

# Test Selection Rules

When evaluating a proposed test, classify it.

| Category                          | Default Decision    |
| --------------------------------- | ------------------- |
| Core requirement                  | Test                |
| Contract boundary                 | Test                |
| Catastrophic failure              | Test                |
| Realistic failure path            | Test                |
| Previous regression               | Test                |
| Complex business rule             | Test                |
| High-risk edge case               | Usually test        |
| Implementation detail             | Do not test         |
| Framework behavior                | Do not test         |
| Cosmetic behavior                 | Usually do not test |
| Hypothetical low-impact edge case | Do not test         |
| Behavior already proven elsewhere | Do not duplicate    |

---

# Do Not Test Implementation Details

Tests should remain valid when internal implementation changes but external behavior remains correct.

Avoid tests that depend on:

- private helper functions
- internal state shape
- exact internal method calls
- hook implementation details
- component internals
- temporary intermediate values
- internal variable names
- internal function ordering

Prefer:

```text
viewer cannot edit report
```

over:

```text
canEdit() returns false
```

when the former adequately proves the required behavior.

---

# Avoid Duplicate Coverage

Do not prove the same behavior repeatedly across every architectural layer.

Example architecture:

```text
Component
↓
Hook
↓
Service
↓
API
```

If a service test already proves:

```text
malformed response → InvalidResponseError
```

and an integration test proves:

```text
InvalidResponseError → user sees recoverable error UI
```

additional tests at every intermediate layer are usually unnecessary.

Each test should contribute new confidence.

---

# Prefer the Highest Useful Test Level

Use the highest-level test that can reliably prove the behavior without making the suite unnecessarily slow or brittle.

General hierarchy:

```text
E2E
↑ highest user confidence

Integration
↑ behavior-focused

Unit
↑ fastest and most precise
```

Use unit tests when:

- logic is isolated
- behavior is computational
- many boundary conditions exist
- failures need precise diagnosis

Use integration tests when:

- several modules collaborate
- application state matters
- APIs and UI behavior interact
- the behavior matters more than individual functions

Use E2E tests when:

- validating critical user flows
- validating infrastructure integration
- validating routing/auth/session behavior
- proving that the application works as experienced by a user

Do not automatically test the same behavior at all three levels.

---

# Test Budget

For an ordinary feature, use the following as a guideline:

```text
Core behavior:       1–3 tests

Failure behavior:    1–3 tests

Edge cases:          0–3 tests

Regression tests:    as needed
```

Most features should require approximately:

```text
3–8 meaningful tests
```

This is not a hard limit.

Complex features may require more.

However:

> Before adding more than 10 tests for a single feature, explain which distinct behaviors are being protected and why existing tests do not already protect them.

Do not create dozens of tests simply because they are easy to generate.

---

# Rules for AI Test Agents

The test agent MUST NOT:

- create tests solely because a function exists
- create tests solely because a file exists
- create tests solely to increase coverage
- test trivial framework behavior
- test React, Express, Zod, or other libraries themselves
- duplicate behavior already tested elsewhere
- exhaustively enumerate inputs without justification
- test private implementation details
- invent large numbers of speculative edge cases
- create snapshot tests without a specific reason
- write tests for trivial getters, setters, wrappers, or mappings
- create low-value tests merely because they are easy to generate

The test agent SHOULD:

- identify the behavior being protected before writing the test
- prioritize contracts and failure boundaries
- protect core feature behavior
- test realistic failure scenarios
- add regression tests for discovered bugs
- prefer behavior-based assertions
- prefer a smaller number of strong tests
- identify redundant tests during review

---

# Required Pre-Test Analysis

Before writing tests for a feature, identify:

## 1. Core Behavior

What must this feature successfully do?

Example:

```text
Updating profile settings saves the new values.
```

---

## 2. Contract Boundaries

What untrusted or external data enters this feature?

Example:

```text
API response
URL parameter
form input
database result
LLM response
```

---

## 3. Critical Failure Modes

What failures could:

- crash the application
- corrupt state
- corrupt persisted data
- create an unrecoverable experience
- expose unauthorized information
- silently produce incorrect results

---

## 4. High-Risk Edge Cases

Which unusual scenarios are realistic enough or dangerous enough to justify testing?

Do not invent edge cases solely to increase test count.

---

# TDD Workflow

Use the following workflow.

```text
Baseline
↓
Plan
↓
Spec
↓
Select Tests
↓
Prove Red
↓
Build
↓
Verify
↓
Review
```

---

## Baseline

Before changing code:

- run relevant existing tests
- confirm the current application state
- determine whether failures already exist

Do not attribute existing failures to new work.

---

## Plan

Define:

- intended behavior
- affected boundaries
- known failure modes
- expected scope

Do not write implementation code yet.

---

## Spec

Identify:

```text
core behavior

contract boundaries

critical failure modes

high-risk edge cases
```

Separate:

```text
required tests
```

from:

```text
optional risk-based tests
```

---

## Select Tests

Choose the smallest set of tests that meaningfully defines correctness.

Do not start by generating every conceivable test.

Prioritize:

```text
core behavior
+
contract safety
+
critical failure handling
```

Then add justified edge cases.

---

## Prove Red

Write the tests before implementation.

Confirm that new tests fail for the expected reason.

A failing test is only useful if it fails because the required behavior is missing.

Do not accept failures caused by:

- broken fixtures
- incorrect mocks
- syntax errors
- unrelated setup problems
- invalid assumptions

---

## Build

Implement the smallest correct change needed to make the tests pass.

Do not expand scope merely because additional improvements are possible.

---

## Verify

Run:

- new tests
- relevant existing tests
- broader suite when warranted

Confirm:

```text
new behavior passes

existing behavior remains intact

no unrelated failures were introduced
```

---

## Review

Review both application code and test code.

Ask:

```text
Are important behaviors untested?

Are critical boundaries protected?

Are failure modes handled?

Are tests coupled to implementation?

Are multiple tests proving the same thing?

Are speculative edge cases adding unnecessary maintenance?

Can any test be deleted without reducing meaningful confidence?
```

Deleting unnecessary tests is a valid and desirable review outcome.

---

# Test Deletion Is Allowed

Tests are production code.

They create maintenance cost.

A test should be removed when it:

- duplicates stronger coverage
- tests implementation rather than behavior
- protects a behavior that no longer exists
- creates significant brittleness without meaningful confidence
- validates framework functionality
- represents an unrealistic scenario with negligible impact

Do not preserve a low-value test merely because it already exists.

---

# Coverage Policy

Coverage is a diagnostic tool.

It is **not the objective**.

Do not write tests purely to reach:

```text
80%

90%

100%
```

A line being executed during a test does not mean meaningful behavior is protected.

A lower-coverage suite with strong behavioral guarantees may be better than a high-coverage suite filled with shallow assertions.

Use uncovered code to ask:

> Is there important behavior here that is not protected?

Do not assume the answer is automatically yes.

---

# Assertion Quality

Prefer assertions about observable outcomes.

Good:

```text
user receives validation error

database record remains unchanged

request is rejected

expected result is returned

error fallback is displayed

cache no longer contains stale data
```

Avoid assertions primarily about internal mechanics:

```text
helper called exactly once

internal state equals temporary value

private method executed

implementation-specific callback order
```

Unless those mechanics are themselves contractual requirements.

---

# Mocking Rules

Mock external boundaries when useful.

Examples:

- network calls
- external services
- payment providers
- LLM APIs
- time
- third-party infrastructure

Avoid excessive mocking of internal modules.

If every internal dependency is mocked, the test may only prove that the mocks were configured correctly.

Prefer real collaboration between internal modules when inexpensive.

---

# Critical Flows

Important user flows may receive broader integration or E2E coverage.

Examples:

```text
authentication

authorization

checkout

payment

account deletion

critical data mutation

onboarding

important report generation

critical search workflows
```

These flows should usually test the primary happy path and the most important failure path.

Do not create an E2E test for every UI interaction.

---

# Final Decision Rule

Before creating any test, answer:

> **What failure would this test catch that matters?**

If there is no clear answer, do not write the test.

Before keeping any test, answer:

> **Does this test provide meaningful confidence that is not already provided elsewhere?**

If not, delete it.

---

# Summary

The repository's testing philosophy is:

```text
Protect contracts.

Protect core behavior.

Protect critical failures.

Test realistic high-risk edge cases.

Turn real bugs into regression tests.

Avoid implementation-detail testing.

Avoid duplicate coverage.

Avoid speculative test explosions.

Prefer the smallest test suite that provides strong confidence.
```

The objective is not:

> More tests.

The objective is:

> **More confidence with less test maintenance.**
