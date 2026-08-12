# Graph-first enrollment and onboarding studio

Date: 2026-08-10

## Outcome

The staff Journeys workspace now presents onboarding and enrollment as two
related but distinct student experiences. Staff can understand a flow from its
dependency map, switch to an ordered list for operational maintenance, and open
the same guided editor from either view.

The redesign uses an n8n-style, bounded workflow canvas backed by canonical
prerequisite IDs. System-defined screens retain their stable route contracts,
while institution-authored steps use the supported action and input types
already understood by the student portal and platform configuration.

## Workflow canvas

- Renders draggable nodes and orthogonal dependency arrows over a zoomable
  canvas.
- Adds input/output ports for publishing a prerequisite without opening the
  full editor, plus deterministic layout simplification and explicit layout
  saving.
- Shows entry steps, parallel work, branch counts, the number of prerequisites
  and successors, active/inactive state, responsible office, rewards, and task
  type.
- Includes only the selected onboarding or enrollment flow plus its recursive
  cross-journey prerequisites, avoiding one unreadable all-system graph.
- Keeps an accessible ordered-list view for drag-and-drop and keyboard-friendly
  move controls.
- Opens an add-step path from both the command bar and the map endpoint.
- Renders executable answer conditions directly on tenant-colored edges and
  marks source nodes as decisions, making Yes/No, switch/default, multi-value,
  and numeric threshold paths visible without opening every node.
- Simplification assigns longest-path ranks, performs six alternating
  barycenter sweeps to reduce edge crossings, applies fixed node spacing, and
  gives fan-in, fan-out, adjacent, and long/backward edges separate connector
  lanes. It changes only unsaved canvas coordinates, never workflow semantics.

## Journey templates

- Adds five onboarding scaffolds: decision-based student onboarding, readiness
  score pathways, international student launch, transfer student launch, and
  support-first onboarding.
- Adds four enrollment scaffolds: enrollment essentials, comprehensive
  enrollment readiness, financial-aid readiness, and document recovery.
- The comprehensive example contains fourteen nodes across academic, identity,
  financial, health, housing, orientation, support, and advising branches. Its
  review and final-clearance nodes require two to four prerequisites.
- Previews every generated node and internal dependency before publication.
- Appends steps in one version-checked publication and never replaces existing
  nodes or completed student work.
- Generates collision-safe stable IDs when a template is used more than once.
- Lets staff start the scaffold as an independent branch or attach all of its
  entry nodes after an existing step.
- The decision-based scaffold demonstrates three exclusive living-plan paths,
  convergence into shared arrival questions, and a second optional support
  meeting controlled by a Yes/No answer.
- The readiness-score scaffold demonstrates bounded numeric input and three
  non-overlapping high, medium, and intensive-support threshold ranges.

## Guided step editor

Custom steps are organized into four reviewable sections:

1. Details: stable ID, title, instructions, action type, owner, points, priority,
   and due-date offset.
2. Student experience: type-specific form, document, selection, signature, or
   scheduling controls.
3. Dependencies: prerequisite selection, cycle-safe validation, answer-driven
   all/any rules, switch cases, default paths, numeric comparison controls, and
   a summary of the steps unlocked next.
4. Publishing: required/active state, version impact, deletion, and explicit
   save-and-publish action.

Protected onboarding screens use a reduced editor that allows student-facing
copy, ownership, points, and form fields to change without permitting deletion
or mutation of the stable system key.

## Student form canvas

- Organizes forms into editable pages with stable page keys, descriptions,
  ordering, duplication, and deletion controls.
- A visual palette adds short text, email, phone, date, yes/no, single-choice,
  multiple-choice, and bounded number fields.
- Field cards expose stable keys, labels, input controls, required state,
  ordering, duplication, and deletion.
- The adjacent student-portal preview is generated from the same working field
  state and updates before publication.
- Includes five starting scaffolds: profile/contact, student support intake,
  orientation preferences, emergency contact, and simple confirmation.
- The student runtime validates one page at a time, preserves earlier answers,
  and submits the complete response only from the final page.
- Changes remain local to the editor until staff explicitly publish; cancelling
  discards the draft.

## Safety and compatibility

- The versioned `form` object is canonical and the flattened `fields` array is
  retained as a compatibility projection for older consumers.
- Page and field IDs are validated for uniqueness across the complete form.
- Existing version checks, dependency-cycle rejection, immutable system-screen
  protections, and completed-student-work reconciliation remain in force.
- Conditional rules can use only a selected prerequisite and one of its
  deterministic checkbox, required selection, or bounded number fields. Switch
  cases support equality and set membership, defaults use exclusion, and number
  fields support equality and ordered thresholds. Removing a prerequisite also
  removes its conditions; deleting a source removes downstream references.
- A non-matching branch is skipped as Not applicable. The selected branch must
  complete before a convergence node unlocks, and no response or uploaded file
  is deleted when published routing changes.
- Older published journey objects that do not yet contain `activation` are
  normalized as unconditional paths during rendering instead of crashing the
  graph or editor during a mixed-version refresh.
- Built-in first-time onboarding remains an eight-screen protected gate. Custom
  onboarding tasks run through the same requirement engine as enrollment after
  that gate, so form submission, notifications, rewards, and dependency unlocks
  use one durable implementation.
- The Edward workflow assistant is collapsed by default so it remains available
  without competing with the visual map.

## Validation

- `npm run typecheck`
- `npm run lint` (passes with the repository's existing image-element warnings)
- `npm test` - production build plus 37 passing tests
- Browser walkthrough that published the eight-node decision-based onboarding
  scaffold, verified four labeled conditional edges and the Yes-rule editor,
  answered Yes as a synthetic student, observed the campus-housing path become
  Ready and the No/Not-sure paths become Not applicable, completed the selected
  housing form, and verified safe convergence unlocked the shared arrival step.
- A browser layout audit simplified a 19-node journey to zero node overlaps and
  fourteen distinct orthogonal connector paths; the template preview also
  verified the three-tier readiness threshold scaffold.
