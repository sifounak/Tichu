# Requirements Traceability Matrix (RTM) Format

Save the RTM to `specifications/RTM-<feature-name>.md`. This is the living traceability document — update it at every milestone as code and tests are written.

## Table Format

| Requirement ID | Description | Status |
|---|---|---|
| REQ-F-XXX | Brief description | Not Started |

## Detailed Entries

Beneath each table row, list implementing and verifying files:

> **REQ-F-XXX** — Brief description — *Not Started*
> - Code:
>   - `code/MyClass.m:45-60`
>   - `code/helpers/validate.m:12`
> - Tests:
>   - `tests/MyClassTest.m:30-55`

## Status Values

| Value | Meaning |
|---|---|
| `Not Started` | Implementation not yet begun |
| `In Progress` | Code or tests written but milestone not complete |
| `Passed` | All tests for this requirement pass |
| `Failed` | Tests exist but are failing |

## Update Points

- **Step A:** Add file:line entries; set Status to `In Progress`
- **Step D:** Set Status to `Passed` or `Failed` based on test results; verify all file:line entries are accurate
