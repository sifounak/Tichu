# Specification Output Templates

Choose and adapt the template that best fits the goal's complexity and domain.

## Template 1: Feature / Algorithm Specification

```markdown
# Specification: [Title]

**Version:** [X.Y]
**Date:** [YYYY-MM-DD]
**Status:** [Draft | Review | Approved]
**Confidence:** [High | Medium | Low] — [one-line rationale]

## 1. Goal

[Clear, concise statement of what this specification aims to achieve and why.]

## 2. Context & Background

[Relevant context: existing system state, prior work, domain constraints, user environment.]

## 3. Requirements

### 3.1 Functional Requirements

| ID | Requirement | Priority | Acceptance Criteria |
|----|------------|----------|-------------------|
| REQ-F-X01 | ... | Must | ... |
| REQ-F-X02 | ... | Should | ... |

### 3.2 Non-Functional Requirements

| ID | Requirement | Category | Acceptance Criteria |
|----|------------|----------|-------------------|
| REQ-NF-X01 | ... | Performance | ... |
| REQ-NF-X02 | ... | Usability | ... |

### 3.3 Constraints

[Hard constraints: platform, language, backward compatibility, regulatory, etc.]

### 3.4 Assumptions

[Assumptions made during specification. Each should be flagged if invalidation would change the spec.]

## 4. Scope

### 4.1 In Scope

[Bulleted list of what IS covered.]

### 4.2 Out of Scope

[Bulleted list of what is explicitly NOT covered and why.]

## 5. Edge Cases & Boundary Conditions

| ID | Scenario | Expected Behavior |
|----|---------|------------------|
| EC-001 | ... | ... |

## 6. Risks & Concerns

| ID | Risk | Likelihood | Impact | Mitigation |
|----|------|-----------|--------|-----------|
| R-001 | ... | ... | ... | ... |

## 7. Success Metrics

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| ... | ... | ... |

## 8. Open Questions

[Any unresolved items, pending decisions, or areas needing future clarification.]

## 9. Glossary

[Domain-specific terms and definitions, if any.]
```

## Template 2: Refactoring / Improvement Specification

```markdown
# Specification: [Title]

**Version:** [X.Y]
**Date:** [YYYY-MM-DD]
**Status:** [Draft | Review | Approved]
**Confidence:** [High | Medium | Low] — [one-line rationale]

## 1. Goal

[What quality attribute is being improved and why.]

## 2. Current State Assessment

[Description of current codebase state, pain points, metrics if available.]

## 3. Target State

[Clear description of the desired end state after refactoring.]

## 4. Requirements

### 4.1 Transformation Requirements

| ID | Requirement | Priority | Verification |
|----|------------|----------|-------------|
| REQ-F-T01 | ... | Must | ... |

### 4.2 Preservation Requirements

[What existing behavior, interfaces, or contracts MUST NOT change.]

| ID | Invariant | Verification |
|----|----------|-------------|
| REQ-F-P01 | ... | ... |

### 4.3 Constraints

[Migration constraints, backward compatibility, rollback requirements.]

## 5. Affected Components

[List of files, modules, or subsystems affected, with brief rationale.]

## 6. Risks & Concerns

| ID | Risk | Likelihood | Impact | Mitigation |
|----|------|-----------|--------|-----------|
| R-001 | ... | ... | ... | ... |

## 7. Success Metrics

| Metric | Before | Target | Measurement |
|--------|--------|--------|-------------|
| ... | ... | ... | ... |

## 8. Open Questions

[Unresolved items.]
```

## Template 3: Compliance / Certification Specification

```markdown
# Specification: [Title]

**Version:** [X.Y]
**Date:** [YYYY-MM-DD]
**Status:** [Draft | Review | Approved]
**Confidence:** [High | Medium | Low] — [one-line rationale]
**Standard:** [e.g., DO-178C DAL-A, MISRA C:2012, ISO 26262 ASIL-D]

## 1. Goal

[Certification/compliance objective and the standard being targeted.]

## 2. Applicable Standard Summary

[Key requirements of the standard relevant to this effort. Reference specific sections/rules.]

## 3. Scope of Compliance

### 3.1 In Scope

[Codebase, components, or artifacts subject to compliance.]

### 3.2 Out of Scope

[What is excluded and justification.]

## 4. Requirements

### 4.1 Compliance Requirements

| ID | Standard Ref | Requirement | Priority | Verification Method |
|----|-------------|------------|----------|-------------------|
| REQ-F-C01 | [Section] | ... | Mandatory | [Analysis/Test/Review/Inspection] |

### 4.2 Process Requirements

[Required processes: reviews, traceability, documentation artifacts.]

### 4.3 Tool Qualification Requirements

[Any tools that must be qualified per the standard.]

## 5. Gap Analysis

| Standard Ref | Requirement | Current State | Gap | Remediation |
|-------------|------------|--------------|-----|------------|
| ... | ... | [Compliant/Partial/Non-compliant] | ... | ... |

## 6. Traceability Matrix

| Requirement ID | Design Artifact | Implementation | Test Case | Evidence |
|---------------|----------------|---------------|-----------|---------|
| REQ-F-C01 | ... | ... | ... | ... |

## 7. Risks & Concerns

| ID | Risk | Likelihood | Impact | Mitigation |
|----|------|-----------|--------|-----------|
| R-001 | ... | ... | ... | ... |

## 8. Success Criteria

[What constitutes successful certification/compliance. Auditor expectations.]

## 9. Open Questions

[Unresolved items, pending auditor feedback, interpretation questions.]
```

## Adaptation Guidelines

- **Simple goals** (single function, small feature): Use Template 1, omit sections that add no value (e.g., Glossary for a trivial feature). Keep it lean.
- **Complex goals** (multi-component system): Use Template 1 with all sections. Consider sub-specifications if scope is very large.
- **Refactoring**: Use Template 2. Emphasize preservation requirements — what must NOT change is as important as what should.
- **Certification/compliance**: Use Template 3. Traceability and gap analysis are non-negotiable.
- **Hybrid goals**: Combine elements from multiple templates. The structure serves the spec, not the other way around.

Always include: Goal, Requirements (with IDs and acceptance criteria), Risks, Success Metrics, Confidence assessment.
