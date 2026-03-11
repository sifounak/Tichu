---
name: spec-builder
description: Build complete, accurate, and actionable specification documents through structured conversation. Use when (1) a user asks to create a spec, define requirements, or write a specification, (2) a user requests building a feature, algorithm, tool, or system and no specification exists yet, (3) a user needs to define certification, compliance, or standards-application scope, (4) a user asks to refactor, improve, or analyze a codebase and needs clarity on what "done" looks like. Covers any goal type — feature development, algorithm design, refactoring, certification, bug investigation, etc.
---

# Spec Builder

Build specifications through structured, conversational elicitation. The output is a markdown file that any downstream agent or workflow can consume to plan, execute, and verify work.

## Workflow

The conversation progresses through phases in the default order below, but phases are not rigid gates. The expected flow is forward progression with allowed backtracking — explore deeper within a phase as needed, and revisit earlier phases when new information surfaces (e.g., gap analysis in Phase 3 may reveal new requirements that belong in Phase 2). Signal phase transitions to the user so they can follow the flow.

### Phase 1: Goal Capture

Establish a clear, detailed understanding of what the user wants to achieve.

1. Ask the user to describe their goal in detail — not just *what* but *why*
2. Identify the goal type (feature, algorithm, refactoring, certification, analysis, etc.) as this shapes the spec structure
3. Ask targeted follow-up questions to fill gaps in the initial description
4. Restate the goal back to the user in precise terms and confirm understanding

Keep questions focused — 2-4 per message. Avoid overwhelming the user.

### Phase 2: Requirements Elicitation

Systematically extract what the specification must cover.

1. Identify functional requirements (what the system/code must DO)
2. Identify non-functional requirements (performance, usability, maintainability, portability, etc.)
3. Identify constraints (platform, language, compatibility, regulatory, timeline, etc.)
4. Identify assumptions — flag any that, if wrong, would invalidate the spec
5. Define scope boundaries: what is IN scope and what is explicitly OUT

Assign each requirement a unique ID as they emerge, using the format: `REQ-<F/NF>-<DomainPrefix><Number>`
- `F` = Functional requirement, `NF` = Non-functional requirement
- Domain prefix identifies the feature area (e.g., `C` for Card, `D` for Deck, `G` for General)
- Examples: `REQ-F-C01`, `REQ-NF-D03`, `REQ-F-G01`

### Phase 3: Gap Analysis & Edge Cases

Probe for what the user may not have considered.

1. Identify edge cases and boundary conditions for each requirement
2. Ask about error handling, failure modes, and degraded operation
3. Surface implicit requirements the user may be taking for granted
4. Challenge vague requirements — push for specificity and measurability
5. For certification/compliance goals: perform gap analysis against the target standard

Signal transition: *"The core requirements are taking shape. Let me now look at what could go wrong or what we might be missing..."*

### Phase 4: Improvement & Conciseness Review

Strengthen the specification.

1. Suggest improvements: better approaches, missing capabilities, industry best practices
2. Identify redundant or overlapping requirements — propose consolidation
3. Assess whether any requirement can be stated more precisely without losing meaning
4. Ensure requirements are testable and verifiable (each has clear acceptance criteria)
5. Check for conflicts between requirements and resolve them with the user

Signal transition: *"The requirements look solid. Let me review for any conflicts, redundancies, or opportunities to tighten things up..."*

### Phase 5: Risk Assessment

Identify what could threaten successful execution of the spec.

1. Technical risks (complexity, unknowns, dependencies)
2. Feasibility risks (resource, timeline, capability gaps)
3. Requirement risks (ambiguity, volatility, external dependencies)
4. For each risk: assess likelihood, impact, and propose mitigation
5. Surface any concerns or conflicts within the specification itself

### Phase 6: Success Metrics & Acceptance Criteria

Define what "done" and "done well" look like.

1. Propose measurable success metrics for the overall goal
2. Ensure each requirement has individual acceptance criteria
3. Define verification methods (test, analysis, inspection, review)
4. For certification: map to required evidence artifacts
5. Confirm metrics are realistic and measurable

Signal transition: *"Let me now define how we'll know the specification has been successfully fulfilled..."*

### Phase 7: Confidence Assessment & Finalization

Assess readiness and hand control to the user.

1. Rate overall confidence in the specification: **High**, **Medium**, or **Low**
   - **High**: All requirements are clear, testable, non-conflicting; risks identified and mitigated; no open questions
   - **Medium**: Most requirements clear but some ambiguity remains; risks identified but some mitigations uncertain
   - **Low**: Significant gaps, unresolved conflicts, or major unknowns remain
2. Explain the confidence rating with specific justification
3. List any open questions or items that could not be fully resolved
4. Ask: *"Is there anything you'd like to add, clarify, or change?"*
5. **Do NOT offer to proceed or serialize until the user explicitly confirms the spec is complete**

If the user requests changes:
- Identify which parts of the spec are affected
- Reconcile changes with existing requirements (check for new conflicts)
- Re-assess confidence
- Ask again if there's anything more to add, clarify, or change

Only after the user confirms satisfaction: serialize the specification to markdown.

## Serialization

When the user confirms the spec is complete:

1. Select the appropriate template from [references/output-templates.md](references/output-templates.md) based on goal type
2. Adapt the template — omit sections that add no value; add sections if needed
3. Write the spec to the project's working directory (or `specifications/` if the project has one)
4. Use filename format: `YYYY-MM-DD-spec-title.md`
5. Present a brief summary of what was written and where

### Template Selection

- **Feature / algorithm / tool**: Template 1 (Feature / Algorithm Specification)
- **Refactoring / improvement**: Template 2 (Refactoring / Improvement Specification)
- **Certification / compliance / standards**: Template 3 (Compliance / Certification Specification)
- **Hybrid or unusual goals**: Combine elements from multiple templates

Always include regardless of template: Goal, Requirements (with IDs + acceptance criteria), Risks, Success Metrics, Confidence.

## Conversation Guidelines

- Ask 2-4 questions per message — focused, not overwhelming
- When transitioning between phases, briefly tell the user what's changing and why
- If the user provides a very brief goal ("build X"), ask for elaboration before proceeding — don't guess at requirements
- Restate important conclusions to confirm understanding before moving on
- If codebase context is relevant, read existing code to ground requirements in reality
- Never auto-proceed to serialization — always wait for explicit user confirmation
