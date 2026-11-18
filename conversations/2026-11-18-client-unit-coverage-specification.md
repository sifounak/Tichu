# Specification approval

User asked which client areas lack coverage and whether they should be tested. Investigation identified authentication, navigation, dialogs, room setup, action controls, feedback and scaling gaps; CI ran tests without coverage enforcement.

User: "That sounds good. Let's create a plan to implement your proposal."

Approved choices: unit/component gate plus page behavior tests; fix defects discovered in covered flows; 80% overall and critical modules 90% statements/80% branches.

User: "Let's remove the browser tests. That might be too deep for what we want now."

The replacement plan removes proposed browser tooling/jobs and retains Vitest/RTL, four implementation milestones and coverage gates.

User: "Implement the approved plan."
