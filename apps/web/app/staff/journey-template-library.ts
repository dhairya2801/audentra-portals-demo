import type {
  JourneyRouteOperator,
  StudentRequirementFormDefinition,
} from "@vv/contracts";
import type { JourneyFlowKind, JourneyTaskType } from "./journey-flow-model";
import { formScaffoldTemplates } from "./onboarding-form-builder";

export interface JourneyTemplateTask {
  key: string;
  title: string;
  description: string;
  owner: string;
  taskType: JourneyTaskType;
  required: boolean;
  points: number;
  priority: number;
  dueOffsetDays: number | null;
  dependsOn: string[];
  form?: StudentRequirementFormDefinition;
  options?: string[];
  maximumSelections?: number;
  acceptedMimeTypes?: string[];
  documentCategories?: string[];
  activation?: {
    match: "all" | "any";
    rules: Array<{
      sourceKey: string;
      fieldId: string;
      operator: JourneyRouteOperator;
      value: string | number | boolean | string[];
    }>;
  };
}

export interface JourneyScaffoldTemplate {
  id: string;
  kind: JourneyFlowKind;
  name: string;
  description: string;
  bestFor: string;
  outcome: string;
  tasks: JourneyTemplateTask[];
}

function formTemplate(id: string) {
  const template = formScaffoldTemplates.find((candidate) => candidate.id === id);
  if (!template) throw new Error(`Missing form scaffold ${id}.`);
  return structuredClone(template.form);
}

const internationalProfile: StudentRequirementFormDefinition = {
  version: 1,
  pages: [
    {
      id: "immigration_status",
      title: "Immigration status",
      description: "Share the status the international student office should review.",
      fields: [
        { id: "visa_status", title: "Current or expected status", field_type: "single_select", required: true, options: ["F-1", "J-1", "Other status", "Not sure yet"] },
        { id: "visa_expiration", title: "Visa expiration date", field_type: "date", required: false },
        { id: "needs_i20_help", title: "I need help with my I-20 or DS-2019", field_type: "checkbox", required: false },
      ],
    },
    {
      id: "arrival_planning",
      title: "Arrival planning",
      description: "Help the university prepare the right arrival guidance.",
      fields: [
        { id: "arrival_date", title: "Expected arrival date", field_type: "date", required: false },
        { id: "arrival_support", title: "Arrival support topics", field_type: "multiple_select", required: false, options: ["Airport transportation", "Housing", "Banking", "Health insurance", "Orientation"], maximum_selections: 3 },
      ],
    },
  ],
};

const academicGoals: StudentRequirementFormDefinition = {
  version: 1,
  pages: [
    {
      id: "academic_goals",
      title: "Academic goals",
      description: "Share what you want an advisor to prioritize during transfer review.",
      fields: [
        { id: "intended_program", title: "Intended program", field_type: "text", required: true },
        { id: "transfer_priorities", title: "Transfer-credit priorities", field_type: "multiple_select", required: true, options: ["Major requirements", "General education", "Electives", "Prerequisites"], maximum_selections: 3 },
        { id: "advisor_notes", title: "Anything an advisor should know?", field_type: "text", required: false },
      ],
    },
  ],
};

const campusHousingProfile: StudentRequirementFormDefinition = {
  version: 1,
  pages: [
    {
      id: "housing_preferences",
      title: "Campus housing preferences",
      description: "Help Housing prepare the right options before room selection.",
      fields: [
        { id: "room_style", title: "Preferred room style", field_type: "single_select", required: true, options: ["Single", "Double", "Suite", "No preference"] },
        { id: "accessibility_needs", title: "I need an accessible housing conversation", field_type: "checkbox", required: false },
        { id: "housing_notes", title: "Housing preferences or questions", field_type: "text", required: false },
      ],
    },
  ],
};

const commuterProfile: StudentRequirementFormDefinition = {
  version: 1,
  pages: [
    {
      id: "commuter_preferences",
      title: "Commuter setup",
      description: "Tell Student Life what would make commuting easier.",
      fields: [
        { id: "commute_method", title: "Primary commute method", field_type: "single_select", required: true, options: ["Public transit", "Drive", "Bike or walk", "Still deciding"] },
        { id: "commuter_topics", title: "Resources to share", field_type: "multiple_select", required: false, options: ["Parking", "Transit passes", "Commuter lounge", "Meal plans", "Campus storage"], maximum_selections: 3 },
      ],
    },
  ],
};

const arrivalPlan: StudentRequirementFormDefinition = {
  version: 1,
  pages: [
    {
      id: "arrival_details",
      title: "Arrival plan",
      description: "Confirm the details every student needs after the housing path rejoins.",
      fields: [
        { id: "arrival_date", title: "Expected campus arrival date", field_type: "date", required: true },
        { id: "arrival_topics", title: "Arrival topics", field_type: "multiple_select", required: false, options: ["Orientation", "Transportation", "Technology", "Dining", "Campus navigation"], maximum_selections: 3 },
      ],
    },
  ],
};

const comprehensiveEnrollmentIntent: StudentRequirementFormDefinition = {
  version: 1,
  pages: [
    {
      id: "enrollment_direction",
      title: "Enrollment direction",
      description: "Confirm the academic path staff should prepare for final review.",
      fields: [
        { id: "intended_program", title: "Intended program", field_type: "text", required: true },
        { id: "starting_term", title: "Starting term", field_type: "single_select", required: true, options: ["Fall", "Spring", "Summer"] },
        { id: "attendance_plan", title: "Attendance plan", field_type: "single_select", required: true, options: ["Full time", "Part time", "Not sure yet"] },
      ],
    },
    {
      id: "readiness_context",
      title: "Readiness context",
      description: "Identify anything that may require coordinated support before enrollment is finalized.",
      fields: [
        { id: "readiness_topics", title: "Topics where support may help", field_type: "multiple_select", required: false, options: ["Academic planning", "Financial aid", "Housing", "Accessibility", "International student support", "Technology"], maximum_selections: 4 },
        { id: "first_generation", title: "I would like first-generation student resources", field_type: "checkbox", required: false },
        { id: "enrollment_notes", title: "Anything staff should know before review?", field_type: "text", required: false },
      ],
    },
  ],
};

const comprehensiveAcademicPlan: StudentRequirementFormDefinition = {
  version: 1,
  pages: [
    {
      id: "academic_interests",
      title: "Academic interests",
      description: "Help the Registrar and advising team prepare the correct evaluation.",
      fields: [
        { id: "primary_major", title: "Primary major", field_type: "text", required: true },
        { id: "alternate_major", title: "Alternate major", field_type: "text", required: false },
        { id: "academic_priorities", title: "Planning priorities", field_type: "multiple_select", required: true, options: ["Major requirements", "General education", "Transfer credit", "Pre-professional track", "Study abroad", "Graduation timeline"], maximum_selections: 3 },
      ],
    },
    {
      id: "advisor_context",
      title: "Advisor context",
      description: "Share the constraints an advisor should consider in the first-term plan.",
      fields: [
        { id: "credit_load", title: "Preferred first-term credit load", field_type: "single_select", required: true, options: ["12–14 credits", "15–16 credits", "17 or more credits", "I need advice"] },
        { id: "schedule_constraints", title: "Schedule constraints", field_type: "text", required: false },
        { id: "advisor_follow_up", title: "I would like an advisor follow-up", field_type: "checkbox", required: false },
      ],
    },
  ],
};

const comprehensiveFinancialReadiness: StudentRequirementFormDefinition = {
  version: 1,
  pages: [
    {
      id: "aid_status",
      title: "Financial-aid status",
      description: "Tell Student Accounts which records and decisions are still in progress.",
      fields: [
        { id: "aid_application_status", title: "Financial-aid application status", field_type: "single_select", required: true, options: ["Submitted", "In progress", "Not applying", "I need help"] },
        { id: "outside_funding", title: "Outside scholarship or sponsorship expected", field_type: "checkbox", required: false },
        { id: "funding_notes", title: "Funding details or questions", field_type: "text", required: false },
      ],
    },
    {
      id: "payment_planning",
      title: "Payment planning",
      description: "Choose the information that would make the next financial conversation useful.",
      fields: [
        { id: "payment_topics", title: "Topics to review", field_type: "multiple_select", required: false, options: ["Payment plan", "Deposit", "Billing schedule", "Loans", "Work-study", "Refunds"], maximum_selections: 3 },
        { id: "preferred_financial_channel", title: "Preferred follow-up channel", field_type: "single_select", required: true, options: ["Portal message", "Email", "Phone call"] },
      ],
    },
  ],
};

const onboardingReadinessAssessment: StudentRequirementFormDefinition = {
  version: 1,
  pages: [
    {
      id: "readiness_review",
      title: "Readiness review",
      description: "Record the readiness score and the support area that should shape the next path.",
      fields: [
        {
          id: "readiness_score",
          title: "Student readiness score",
          field_type: "number",
          required: true,
          minimum: 0,
          maximum: 100,
          step: 1,
        },
        {
          id: "priority_area",
          title: "Primary support area",
          field_type: "single_select",
          required: true,
          options: ["Academic planning", "Financial planning", "Campus transition", "No additional support"],
        },
      ],
    },
  ],
};

export const journeyScaffoldTemplates: JourneyScaffoldTemplate[] = [
  {
    id: "onboarding_conditional_paths",
    kind: "onboarding",
    name: "Decision-based student onboarding",
    description: "Ask a Yes/No-style question, send students down the applicable housing path, merge the paths, and offer a second optional support detour.",
    bestFor: "Onboarding that changes with student answers",
    outcome: "A working conditional graph with three housing routes, safe convergence, and an optional advisor branch.",
    tasks: [
      { key: "living_decision", title: "Choose your living plan", description: "Choose a living arrangement so the journey can route each student through the relevant next steps.", owner: "Housing & Residence Life", taskType: "single_select", required: true, points: 20, priority: 100, dueOffsetDays: 3, dependsOn: [], options: ["On campus", "Off campus", "With family", "Not sure yet"] },
      { key: "campus_housing_profile", title: "Share campus housing preferences", description: "Complete the housing questions that apply to students living on campus.", owner: "Housing & Residence Life", taskType: "form", required: true, points: 35, priority: 90, dueOffsetDays: 7, dependsOn: ["living_decision"], form: campusHousingProfile, activation: { match: "all", rules: [{ sourceKey: "living_decision", fieldId: "$answer", operator: "equals", value: "On campus" }] } },
      { key: "commuter_profile", title: "Set up your commuter experience", description: "Choose the resources that apply when you will live away from campus.", owner: "Student Life", taskType: "form", required: true, points: 35, priority: 90, dueOffsetDays: 7, dependsOn: ["living_decision"], form: commuterProfile, activation: { match: "all", rules: [{ sourceKey: "living_decision", fieldId: "$answer", operator: "one_of", value: ["Off campus", "With family"] }] } },
      { key: "housing_guidance", title: "Meet with a housing advisor", description: "This default route catches any living-plan answer not handled by the named cases.", owner: "Housing & Residence Life", taskType: "scheduling", required: true, points: 20, priority: 90, dueOffsetDays: 7, dependsOn: ["living_decision"], activation: { match: "all", rules: [{ sourceKey: "living_decision", fieldId: "$answer", operator: "none_of", value: ["On campus", "Off campus", "With family"] }] } },
      { key: "arrival_plan", title: "Confirm your arrival plan", description: "Continue with the shared arrival questions after your applicable living path is complete.", owner: "Student Life", taskType: "form", required: true, points: 30, priority: 75, dueOffsetDays: 12, dependsOn: ["living_decision", "campus_housing_profile", "commuter_profile", "housing_guidance"], form: arrivalPlan },
      { key: "support_decision", title: "Would you like an onboarding check-in?", description: "Choose whether you want a staff member to review your remaining onboarding questions.", owner: "Dean of Students Office", taskType: "single_select", required: true, points: 10, priority: 60, dueOffsetDays: 14, dependsOn: ["arrival_plan"], options: ["Yes", "No"] },
      { key: "support_meeting", title: "Schedule your onboarding check-in", description: "Choose a time with the student support team.", owner: "Dean of Students Office", taskType: "scheduling", required: false, points: 15, priority: 55, dueOffsetDays: 17, dependsOn: ["support_decision"], activation: { match: "all", rules: [{ sourceKey: "support_decision", fieldId: "$answer", operator: "equals", value: "Yes" }] } },
      { key: "onboarding_confirmation", title: "Confirm onboarding completion", description: "Review the applicable path and confirm that you are ready for the next stage.", owner: "Enrollment Services", taskType: "approval", required: true, points: 25, priority: 45, dueOffsetDays: 20, dependsOn: ["support_decision", "support_meeting"] },
    ],
  },
  {
    id: "onboarding_readiness_thresholds",
    kind: "onboarding",
    name: "Readiness score pathways",
    description: "Route students into high, medium, or intensive support paths from a numeric score, then converge safely.",
    bestFor: "Threshold-driven onboarding and risk tiers",
    outcome: "A working three-tier threshold graph with no gaps or overlapping score ranges.",
    tasks: [
      { key: "readiness_assessment", title: "Complete readiness assessment", description: "Collect a 0-100 readiness score and the student's primary support area.", owner: "Enrollment Services", taskType: "form", required: true, points: 20, priority: 100, dueOffsetDays: 3, dependsOn: [], form: onboardingReadinessAssessment },
      { key: "accelerated_path", title: "Review accelerated onboarding", description: "Give highly prepared students a concise self-service readiness review.", owner: "Enrollment Services", taskType: "information", required: true, points: 20, priority: 85, dueOffsetDays: 6, dependsOn: ["readiness_assessment"], activation: { match: "all", rules: [{ sourceKey: "readiness_assessment", fieldId: "readiness_score", operator: "greater_than_or_equal", value: 80 }] } },
      { key: "guided_path", title: "Complete guided onboarding plan", description: "Give students in the middle tier a structured planning form and targeted resources.", owner: "Academic Advising", taskType: "form", required: true, points: 35, priority: 85, dueOffsetDays: 8, dependsOn: ["readiness_assessment"], form: formTemplate("student_support"), activation: { match: "all", rules: [{ sourceKey: "readiness_assessment", fieldId: "readiness_score", operator: "greater_than_or_equal", value: 50 }, { sourceKey: "readiness_assessment", fieldId: "readiness_score", operator: "less_than", value: 80 }] } },
      { key: "intensive_path", title: "Schedule intensive support check-in", description: "Connect students below the readiness threshold with a staff member before they continue.", owner: "Dean of Students Office", taskType: "scheduling", required: true, points: 35, priority: 90, dueOffsetDays: 5, dependsOn: ["readiness_assessment"], activation: { match: "all", rules: [{ sourceKey: "readiness_assessment", fieldId: "readiness_score", operator: "less_than", value: 50 }] } },
      { key: "readiness_convergence", title: "Confirm onboarding readiness", description: "Continue after the one applicable readiness path has been completed.", owner: "Enrollment Services", taskType: "approval", required: true, points: 30, priority: 60, dueOffsetDays: 12, dependsOn: ["accelerated_path", "guided_path", "intensive_path"] },
    ],
  },
  {
    id: "onboarding_international",
    kind: "onboarding",
    name: "International student launch",
    description: "Collect status and arrival details, receive protected documents, then schedule guidance.",
    bestFor: "International student onboarding",
    outcome: "A complete, advisor-ready international student intake.",
    tasks: [
      { key: "international_profile", title: "Share international student details", description: "Tell the international student office about your status and arrival plans.", owner: "Admissions", taskType: "form", required: true, points: 40, priority: 80, dueOffsetDays: 7, dependsOn: [], form: internationalProfile },
      { key: "immigration_documents", title: "Upload immigration documents", description: "Upload the available passport, visa, I-20, or DS-2019 pages for secure staff review.", owner: "Admissions", taskType: "upload_file", required: true, points: 60, priority: 85, dueOffsetDays: 10, dependsOn: ["international_profile"], acceptedMimeTypes: ["application/pdf", "image/jpeg", "image/png"], documentCategories: ["identity", "immigration"] },
      { key: "international_advising", title: "Meet your international student advisor", description: "Choose an available appointment to review arrival and compliance questions.", owner: "Academic Advising", taskType: "scheduling", required: false, points: 25, priority: 50, dueOffsetDays: 14, dependsOn: ["international_profile", "immigration_documents"] },
    ],
  },
  {
    id: "onboarding_transfer",
    kind: "onboarding",
    name: "Transfer student launch",
    description: "Gather the transcript first, capture academic goals, and prepare an advising handoff.",
    bestFor: "Transfer onboarding",
    outcome: "A transfer record with documents and advising priorities linked in order.",
    tasks: [
      { key: "transfer_transcript", title: "Upload transfer transcript", description: "Upload every available transcript page so prior coursework can be reviewed.", owner: "Registrar", taskType: "upload_file", required: true, points: 80, priority: 90, dueOffsetDays: 5, dependsOn: [], acceptedMimeTypes: ["application/pdf", "image/jpeg", "image/png"], documentCategories: ["transcript"] },
      { key: "transfer_goals", title: "Share transfer-credit priorities", description: "Tell an advisor what should be considered first during your transfer review.", owner: "Academic Advising", taskType: "form", required: true, points: 35, priority: 70, dueOffsetDays: 8, dependsOn: ["transfer_transcript"], form: academicGoals },
      { key: "transfer_advising", title: "Schedule transfer advising", description: "Choose a time to review credit evaluation and your first-term plan.", owner: "Academic Advising", taskType: "scheduling", required: true, points: 30, priority: 60, dueOffsetDays: 14, dependsOn: ["transfer_goals"] },
    ],
  },
  {
    id: "onboarding_support",
    kind: "onboarding",
    name: "Support-first onboarding",
    description: "Collect essential contact details, ask what support is needed, then offer a meeting.",
    bestFor: "High-touch student populations",
    outcome: "A concise student profile and an actionable support handoff.",
    tasks: [
      { key: "contact_profile", title: "Confirm contact details", description: "Review the contact information staff should use throughout onboarding.", owner: "Enrollment Services", taskType: "form", required: true, points: 30, priority: 80, dueOffsetDays: 3, dependsOn: [], form: formTemplate("profile_contact") },
      { key: "support_intake", title: "Tell us how we can support you", description: "Share your topic, urgency, and preferred follow-up channel.", owner: "Dean of Students Office", taskType: "form", required: false, points: 25, priority: 65, dueOffsetDays: 7, dependsOn: ["contact_profile"], form: formTemplate("student_support") },
      { key: "support_meeting", title: "Schedule a support check-in", description: "Choose an optional check-in with a student support advisor.", owner: "Dean of Students Office", taskType: "scheduling", required: false, points: 15, priority: 40, dueOffsetDays: 14, dependsOn: ["support_intake"] },
    ],
  },
  {
    id: "enrollment_essentials",
    kind: "enrollment",
    name: "Enrollment essentials",
    description: "Run transcript and health-document collection in parallel, then unlock orientation and signing.",
    bestFor: "Standard enrollment checklist",
    outcome: "A clear parallel document path that converges before final confirmation.",
    tasks: [
      { key: "official_transcript", title: "Submit official transcript", description: "Upload the complete official transcript for parsing and Registrar review.", owner: "Registrar", taskType: "upload_file", required: true, points: 80, priority: 95, dueOffsetDays: 7, dependsOn: [], acceptedMimeTypes: ["application/pdf", "image/jpeg", "image/png"], documentCategories: ["transcript"] },
      { key: "health_records", title: "Provide health records", description: "Upload the immunization or health-clearance documents required before arrival.", owner: "Health Services", taskType: "upload_file", required: true, points: 60, priority: 85, dueOffsetDays: 10, dependsOn: [], acceptedMimeTypes: ["application/pdf", "image/jpeg", "image/png"], documentCategories: ["immunization"] },
      { key: "orientation_preferences", title: "Choose orientation preferences", description: "Select an orientation format, preferred date, and topics of interest.", owner: "Student Life", taskType: "form", required: true, points: 40, priority: 65, dueOffsetDays: 14, dependsOn: ["official_transcript", "health_records"], form: formTemplate("orientation_preferences") },
      { key: "enrollment_confirmation", title: "Confirm enrollment responsibilities", description: "Review and acknowledge the final enrollment responsibilities.", owner: "Enrollment Services", taskType: "signature", required: true, points: 25, priority: 50, dueOffsetDays: 18, dependsOn: ["orientation_preferences"] },
    ],
  },
  {
    id: "enrollment_comprehensive",
    kind: "enrollment",
    name: "Comprehensive enrollment readiness",
    description: "Coordinate academic, identity, finance, health, housing, orientation, and advising work through parallel branches that converge at final clearance.",
    bestFor: "Complex multi-office enrollment",
    outcome: "A complete enrollment graph with parallel evidence collection, multi-prerequisite reviews, optional support, and one final clearance gate.",
    tasks: [
      { key: "enrollment_intent", title: "Confirm enrollment direction", description: "Confirm the program, starting term, attendance plan, and support context staff should use throughout enrollment.", owner: "Enrollment Services", taskType: "form", required: true, points: 35, priority: 100, dueOffsetDays: 3, dependsOn: [], form: comprehensiveEnrollmentIntent },
      { key: "identity_verification", title: "Provide identity documentation", description: "Upload a passport, government ID, or other accepted identity evidence for protected staff review.", owner: "Admissions", taskType: "upload_file", required: true, points: 50, priority: 95, dueOffsetDays: 7, dependsOn: ["enrollment_intent"], acceptedMimeTypes: ["application/pdf", "image/jpeg", "image/png"], documentCategories: ["identity"] },
      { key: "academic_plan", title: "Build your academic plan", description: "Share academic interests, first-term priorities, and constraints for advising and Registrar review.", owner: "Academic Advising", taskType: "form", required: true, points: 40, priority: 90, dueOffsetDays: 7, dependsOn: ["enrollment_intent"], form: comprehensiveAcademicPlan },
      { key: "official_transcript", title: "Submit official transcript", description: "Upload every transcript page for automated extraction and Registrar review.", owner: "Registrar", taskType: "upload_file", required: true, points: 80, priority: 98, dueOffsetDays: 7, dependsOn: ["enrollment_intent"], acceptedMimeTypes: ["application/pdf", "image/jpeg", "image/png"], documentCategories: ["transcript"] },
      { key: "financial_readiness", title: "Share financial readiness", description: "Confirm financial-aid status, funding questions, and preferred follow-up channel.", owner: "Financial Aid", taskType: "form", required: true, points: 35, priority: 88, dueOffsetDays: 8, dependsOn: ["enrollment_intent"], form: comprehensiveFinancialReadiness },
      { key: "financial_documents", title: "Provide financial-aid documents", description: "Upload requested verification, scholarship, or sponsorship evidence for secure review.", owner: "Financial Aid", taskType: "upload_file", required: true, points: 55, priority: 92, dueOffsetDays: 12, dependsOn: ["financial_readiness"], acceptedMimeTypes: ["application/pdf", "image/jpeg", "image/png"], documentCategories: ["financial_aid"] },
      { key: "health_clearance", title: "Provide health clearance", description: "Upload immunization or health-clearance records required before campus arrival.", owner: "Health Services", taskType: "upload_file", required: true, points: 55, priority: 86, dueOffsetDays: 12, dependsOn: ["enrollment_intent"], acceptedMimeTypes: ["application/pdf", "image/jpeg", "image/png"], documentCategories: ["immunization"] },
      { key: "housing_plan", title: "Choose housing and arrival needs", description: "Select the housing and arrival topics the university should prepare for.", owner: "Housing & Residence Life", taskType: "multiple_select", required: true, points: 30, priority: 72, dueOffsetDays: 10, dependsOn: ["enrollment_intent"], options: ["On-campus housing", "Off-campus resources", "Commuter support", "Family housing", "Move-in assistance", "I am undecided"], maximumSelections: 3 },
      { key: "academic_evaluation", title: "Review academic evaluation", description: "Review the program plan after both academic preferences and transcript evidence are available.", owner: "Registrar", taskType: "approval", required: true, points: 30, priority: 78, dueOffsetDays: 16, dependsOn: ["academic_plan", "official_transcript"] },
      { key: "financial_clearance", title: "Review financial clearance", description: "Confirm that identity, aid status, and requested financial evidence are ready for enrollment.", owner: "Student Accounts", taskType: "approval", required: true, points: 30, priority: 80, dueOffsetDays: 18, dependsOn: ["identity_verification", "financial_readiness", "financial_documents"] },
      { key: "orientation_registration", title: "Register for orientation", description: "Choose orientation preferences after identity, health, and arrival plans are available.", owner: "Student Life", taskType: "form", required: true, points: 35, priority: 68, dueOffsetDays: 18, dependsOn: ["identity_verification", "health_clearance", "housing_plan"], form: formTemplate("orientation_preferences") },
      { key: "support_checkin", title: "Schedule an enrollment support check-in", description: "Choose an optional appointment if financial or housing questions would benefit from coordinated support.", owner: "Dean of Students Office", taskType: "scheduling", required: false, points: 15, priority: 45, dueOffsetDays: 20, dependsOn: ["financial_readiness", "housing_plan"] },
      { key: "advisor_planning", title: "Schedule final academic planning", description: "Meet with an advisor after both the academic evaluation and financial clearance are available.", owner: "Academic Advising", taskType: "scheduling", required: true, points: 25, priority: 62, dueOffsetDays: 22, dependsOn: ["academic_evaluation", "financial_clearance"] },
      { key: "final_enrollment_clearance", title: "Sign final enrollment clearance", description: "Review the completed academic, financial, orientation, and advising record and sign the final enrollment acknowledgement.", owner: "Enrollment Services", taskType: "signature", required: true, points: 75, priority: 55, dueOffsetDays: 28, dependsOn: ["academic_evaluation", "financial_clearance", "orientation_registration", "advisor_planning"] },
    ],
  },
  {
    id: "enrollment_financial_aid",
    kind: "enrollment",
    name: "Financial-aid readiness",
    description: "Collect student questions, record package review, and close with an acknowledgement.",
    bestFor: "Financial-aid completion",
    outcome: "A staff-ready intake followed by a traceable student confirmation.",
    tasks: [
      { key: "aid_questions", title: "Share financial-aid questions", description: "Tell Financial Aid which part of the package needs clarification.", owner: "Financial Aid", taskType: "form", required: false, points: 20, priority: 75, dueOffsetDays: 5, dependsOn: [], form: formTemplate("student_support") },
      { key: "package_review", title: "Review financial-aid package", description: "Review the current package and confirm that you understand the next action.", owner: "Financial Aid", taskType: "approval", required: true, points: 30, priority: 85, dueOffsetDays: 10, dependsOn: ["aid_questions"] },
      { key: "aid_acknowledgement", title: "Acknowledge financial-aid responsibilities", description: "Sign the acknowledgement after questions and package details are resolved.", owner: "Financial Aid", taskType: "signature", required: true, points: 25, priority: 60, dueOffsetDays: 14, dependsOn: ["package_review"] },
    ],
  },
  {
    id: "enrollment_document_recovery",
    kind: "enrollment",
    name: "Document recovery path",
    description: "Explain accepted evidence, collect a replacement, then offer optional staff review.",
    bestFor: "Missing or rejected documents",
    outcome: "A simple recovery sequence without pretending automated review always succeeds.",
    tasks: [
      { key: "document_guidance", title: "Review document guidance", description: "Review accepted formats and examples before uploading a replacement.", owner: "Enrollment Services", taskType: "information", required: true, points: 10, priority: 85, dueOffsetDays: 2, dependsOn: [] },
      { key: "replacement_document", title: "Upload replacement document", description: "Upload a clear PDF, JPEG, or PNG for secure staff review.", owner: "Enrollment Services", taskType: "upload_file", required: true, points: 40, priority: 90, dueOffsetDays: 5, dependsOn: ["document_guidance"], acceptedMimeTypes: ["application/pdf", "image/jpeg", "image/png"], documentCategories: ["enrollment_support"] },
      { key: "review_appointment", title: "Schedule document review", description: "Choose an optional appointment if you need help confirming acceptable evidence.", owner: "Enrollment Services", taskType: "scheduling", required: false, points: 10, priority: 45, dueOffsetDays: 8, dependsOn: ["replacement_document"] },
    ],
  },
];
