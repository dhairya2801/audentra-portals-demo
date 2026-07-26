"use client";

import type {
  AdmissionOfferSummary,
  OnboardingEmergencyContact,
  OnboardingFamilyPermission,
  OnboardingStep,
  StudentDashboard,
  StudentOnboarding,
  StudentOnboardingData,
  StudentPaymentList,
  UpdateStudentOnboardingInput,
} from "@vv/contracts";
import Link from "next/link";
import {
  type FormEvent,
  type ChangeEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { PortalMark } from "../components/portal-ui";
import {
  getApiErrorMessage,
  useApiAction,
  useApiResource,
} from "../hooks/use-api-resource";
import {
  acceptAdmissionOffer,
  completeStudentOnboarding,
  createDepositPayment,
  getStudentDashboard,
  getStudentBootstrap,
  getStudentOnboarding,
  getStudentPayments,
  updateStudentOnboarding,
} from "../lib/api-client";

const onboardingSteps: {
  key: OnboardingStep;
  label: string;
  title: string;
  subtitle: string;
  skippable?: boolean;
}[] = [
  {
    key: "offer",
    label: "Offer",
    title: "Your place at Aster",
    subtitle: "Begin by confirming the admission decision that brought you here.",
  },
  {
    key: "about_you",
    label: "About you",
    title: "Identity & home address",
    subtitle: "Add the personal details and permanent address Aster needs to prepare your student record.",
  },
  {
    key: "housing",
    label: "Housing",
    title: "One personalized story",
    subtitle: "Tell us where you imagine starting your Aster experience.",
    skippable: true,
  },
  {
    key: "campus_life",
    label: "Campus life",
    title: "Clubs, people & support",
    subtitle: "Choose the communities and support you want to hear about.",
    skippable: true,
  },
  {
    key: "emergency_contacts",
    label: "Emergency contacts",
    title: "People in your corner",
    subtitle: "Enter one or more people Aster may contact in an emergency.",
  },
  {
    key: "family_permissions",
    label: "Family permissions",
    title: "FERPA access by person",
    subtitle: "Review who may receive information about your student record.",
  },
  {
    key: "review_and_sign",
    label: "Review & sign",
    title: "Your document packet",
    subtitle: "Review your choices and provide your electronic confirmation.",
  },
  {
    key: "deposit",
    label: "Deposit",
    title: "Secure your place",
    subtitle: "Pay now, choose a later path, or skip this step and return from enrollment.",
    skippable: true,
  },
];

const campusInterestOptions = [
  ["aster_app_lab", "Aster App Lab"],
  ["women_in_business", "Women in Business"],
  ["late_night_radio", "Late Night Radio"],
  ["pixel_league", "Pixel League"],
  ["harbor_outdoor_club", "Harbor Outdoor Club"],
  ["boston_neighbors", "Boston Neighbors"],
  ["global_table", "Global Table"],
  ["first_year_council", "First-Year Council"],
  ["campus_rec_mix", "Campus Rec Mix"],
] as const;

const supportNeedOptions = [
  ["academic_coaching", "Academic coaching"],
  ["accessibility_services", "Accessibility services"],
  ["career_planning", "Career planning"],
  ["counseling_wellbeing", "Counseling & wellbeing"],
  ["financial_wellness", "Financial wellness"],
  ["first_gen_resources", "First-gen resources"],
  ["international_student_services", "International student services"],
  ["family_resources", "Family resources"],
] as const;

const firstMonthGoalOptions = [
  ["friends_in_major", "Friends in my major"],
  ["creative_outlet", "A creative outlet"],
  ["career_connections", "Career connections"],
  ["fitness_routine", "A fitness routine"],
  ["shared_culture", "Shared culture"],
  ["volunteer", "Ways to volunteer"],
  ["something_new", "Something new"],
] as const;

const ferpaScopeOptions = [
  ["academic_records", "Academic records & advising"],
  ["registration", "Registration & enrollment"],
  ["billing", "Student account & billing"],
  ["financial_aid", "Financial aid"],
  ["housing", "Housing & dining"],
  ["conduct", "Student conduct records"],
  ["accessibility", "Accessibility services"],
] as const;

/**
 * `skippedSteps` is server-managed progress metadata. It is returned with the
 * onboarding resource so the UI can label optional steps, but must never be
 * echoed back as editable step data. Keeping that boundary here prevents a
 * later optional step from being rejected after an earlier one was skipped.
 */
function editableOnboardingData(data: StudentOnboardingData) {
  const editableData = { ...data };
  delete editableData.skippedSteps;
  for (const legacyField of [
    "legalNameConfirmed",
    "contactInformationConfirmed",
    "homeAddressConfirmed",
    "emergencyContactConfirmed",
    "recordsConfirmed",
    "familyPermissionsReviewed",
    "signatureConfirmed",
    "depositAcknowledged",
  ]) {
    delete (editableData as Record<string, unknown>)[legacyField];
  }
  return editableData;
}

type OnboardingPageData = {
  onboarding: StudentOnboarding;
  dashboard: StudentDashboard;
  payments: StudentPaymentList;
};

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function OnboardingProgress({
  current,
  completed,
  skipped,
}: {
  current: OnboardingStep;
  completed: OnboardingStep[];
  skipped: OnboardingStep[];
}) {
  const currentIndex = onboardingSteps.findIndex((step) => step.key === current);

  return (
    <aside className="onboarding-progress" aria-label="Onboarding progress">
      <Link className="brand onboarding-brand" href="/onboarding">
        <PortalMark />
        <span>
          <strong>Aster</strong>
          <small>University</small>
        </span>
      </Link>
      <div className="onboarding-progress__heading">
        <p className="eyebrow">Getting started</p>
        <h2>Your path to Aster</h2>
        <p>{completed.length} of {onboardingSteps.length} steps saved</p>
      </div>
      <ol>
        {onboardingSteps.map((step, index) => {
          const isComplete = completed.includes(step.key);
          const isCurrent = step.key === current;
          const wasSkipped = skipped.includes(step.key);
          return (
            <li
              className={`${isComplete ? "onboarding-step--complete " : ""}${isCurrent ? "onboarding-step--current" : ""}`}
              aria-current={isCurrent ? "step" : undefined}
              key={step.key}
            >
              <span aria-hidden="true">{isComplete ? "✓" : index + 1}</span>
              <div>
                <strong>{step.label}</strong>
                <small>
                  {isComplete
                    ? wasSkipped
                      ? "Skipped for now"
                      : "Saved"
                    : isCurrent
                      ? "In progress"
                      : index > currentIndex
                        ? "Upcoming"
                        : "Ready"}
                </small>
              </div>
            </li>
          );
        })}
      </ol>
      <div className="onboarding-resume">
        <span aria-hidden="true">↻</span>
        <p>
          <strong>Safe to pause</strong>
          Your last server-confirmed step is saved.
        </p>
      </div>
    </aside>
  );
}

function Choice({
  name,
  value,
  label,
  defaultChecked,
  type = "checkbox",
  required,
  onChange,
}: {
  name: string;
  value: string;
  label: string;
  defaultChecked?: boolean;
  type?: "checkbox" | "radio";
  required?: boolean;
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <label className="choice-card">
      <input
        type={type}
        name={name}
        value={value}
        defaultChecked={defaultChecked}
        required={required}
        onChange={onChange}
      />
      <span aria-hidden="true" />
      <strong>{label}</strong>
    </label>
  );
}

const emptyEmergencyContact: OnboardingEmergencyContact = {
  fullName: "",
  relationship: "parent",
  mobilePhone: "",
};

const emptyFamilyPermission: OnboardingFamilyPermission = {
  fullName: "",
  relationship: "parent",
  email: "",
  scopes: [],
  purpose: "education_and_expenses",
  expires: "end_first_year",
};

function HousingFields({ data }: { data: StudentOnboardingData }) {
  const [preference, setPreference] = useState(
    data.housingPreference ?? "undecided",
  );

  return (
    <>
      <fieldset className="form-section">
        <legend>Where do you picture starting your day?</legend>
        <p>
          Choose a plan. Aster opens only the follow-up questions useful for
          that plan.
        </p>
        <div className="choice-grid">
          {[
            ["on_campus", "On campus"],
            ["off_campus", "Off campus"],
            ["commuting", "Commuting"],
            ["undecided", "I’m not sure yet"],
            ["family", "Family or dependent housing"],
          ].map(([value, label]) => (
            <Choice
              type="radio"
              name="housingPreference"
              value={value}
              label={label}
              defaultChecked={preference === value}
              required
              onChange={(event) => {
                if (event.currentTarget.checked) {
                  setPreference(
                    event.currentTarget
                      .value as NonNullable<
                        StudentOnboardingData["housingPreference"]
                      >,
                  );
                }
              }}
              key={value}
            />
          ))}
        </div>
      </fieldset>

      {preference === "on_campus" ? (
        <>
          <fieldset className="form-section">
            <legend>What kind of space feels right?</legend>
            <div className="choice-grid">
              {[
                ["single", "Single"],
                ["double", "Double"],
                ["triple", "Triple"],
                ["quad", "Quad"],
                ["suite", "Suite"],
                ["no_preference", "No preference"],
              ].map(([value, label]) => (
                <Choice
                  type="radio"
                  name="housingRoomType"
                  value={value}
                  label={label}
                  defaultChecked={data.housingRoomType === value}
                  required
                  key={value}
                />
              ))}
            </div>
            <div className="form-grid">
              <label className="field">
                <span>Bathroom preference</span>
                <select
                  name="bathroomPreference"
                  defaultValue={data.bathroomPreference ?? ""}
                  required
                >
                  <option value="" disabled>Choose one</option>
                  <option value="shared_floor">Shared floor bathroom</option>
                  <option value="suite">Suite bathroom</option>
                  <option value="private">Private bathroom</option>
                  <option value="no_preference">No preference</option>
                </select>
              </label>
              <label className="field">
                <span>Roommate matching</span>
                <select
                  name="roommateMatching"
                  defaultValue={data.roommateMatching ?? ""}
                  required
                >
                  <option value="" disabled>Choose one</option>
                  <option value="match_preferences">Match me from my preferences</option>
                  <option value="known_roommate">I know my roommate</option>
                  <option value="browse_later">Let me browse profiles later</option>
                </select>
              </label>
            </div>
          </fieldset>

          <fieldset className="form-section">
            <legend>Tell us how you actually live in a shared space</legend>
            <p>
              Honest routine preferences help Residential Life reduce
              avoidable roommate friction.
            </p>
            <div className="form-grid">
              {[
                [
                  "sleepSchedule",
                  "Sleep schedule",
                  [
                    ["early", "Early bird · before 11"],
                    ["middle", "Usually 11–1"],
                    ["night", "Night owl · after 1"],
                    ["changes", "It changes"],
                  ],
                  data.sleepSchedule,
                ],
                [
                  "studyHabits",
                  "Study habits",
                  [
                    ["room", "Mostly in my room"],
                    ["elsewhere", "Mostly library / elsewhere"],
                    ["mix", "A mix"],
                    ["late_room", "Late-night room study"],
                  ],
                  data.studyHabits,
                ],
                [
                  "roomNoise",
                  "Room noise",
                  [
                    ["quiet", "Usually quiet"],
                    ["headphones", "Music with headphones"],
                    ["background", "Background sound"],
                    ["social", "Lively and social"],
                  ],
                  data.roomNoise,
                ],
                [
                  "cleanliness",
                  "Cleanliness",
                  [
                    ["everything_in_place", "Everything in place"],
                    ["tidy", "Tidy but lived-in"],
                    ["relaxed", "Pretty relaxed"],
                  ],
                  data.cleanliness,
                ],
                [
                  "guestPreference",
                  "Guests",
                  [
                    ["rarely", "Rarely"],
                    ["notice", "Sometimes, with notice"],
                    ["active", "I like an active room"],
                  ],
                  data.guestPreference,
                ],
                [
                  "temperaturePreference",
                  "Temperature",
                  [
                    ["cool", "Cool"],
                    ["middle", "In the middle"],
                    ["warm", "Warm"],
                  ],
                  data.temperaturePreference,
                ],
                [
                  "smokeVapeCompatibility",
                  "Smoke / vape compatibility",
                  [
                    ["smoke_free", "Smoke-free roommate only"],
                    ["off_campus_only", "Okay if only off campus"],
                    ["no_preference", "No preference"],
                  ],
                  data.smokeVapeCompatibility,
                ],
              ].map(([name, label, options, defaultValue]) => (
                <label className="field" key={String(name)}>
                  <span>{String(label)}</span>
                  <select
                    name={String(name)}
                    defaultValue={String(defaultValue ?? "")}
                    required
                  >
                    <option value="" disabled>Choose one</option>
                    {(options as string[][]).map(([value, optionLabel]) => (
                      <option value={value} key={value}>{optionLabel}</option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            <div className="choice-grid choice-grid--multi">
              <Choice
                name="substanceFreeHousing"
                value="yes"
                label="Substance-free housing"
                defaultChecked={data.substanceFreeHousing}
              />
              <Choice
                name="genderInclusiveHousing"
                value="yes"
                label="Gender-inclusive housing"
                defaultChecked={data.genderInclusiveHousing}
              />
              <Choice
                name="accessibleHousingInformation"
                value="yes"
                label="Accessible housing information"
                defaultChecked={data.accessibleHousingInformation}
              />
            </div>
          </fieldset>

          <fieldset className="form-section">
            <legend>Would you like a themed residential community?</legend>
            <div className="choice-grid choice-grid--multi">
              {[
                ["first_year_launch", "First-Year Launch"],
                ["honors_house", "Honors House"],
                ["stem_innovation", "STEM + Innovation"],
                ["arts_collective", "Arts Collective"],
                ["wellbeing_commons", "Wellbeing Commons"],
                ["substance_free_living", "Substance-Free Living"],
              ].map(([value, label]) => (
                <Choice
                  name="livingLearningCommunities"
                  value={value}
                  label={label}
                  defaultChecked={data.livingLearningCommunities?.includes(value)}
                  key={value}
                />
              ))}
            </div>
          </fieldset>
        </>
      ) : null}

      {preference === "off_campus" ? (
        <>
          <fieldset className="form-section">
            <legend>Where are you in the search?</legend>
            <div className="choice-grid">
              {[
                ["lease_signed", "I signed a lease"],
                ["actively_looking", "I’m actively looking"],
                ["need_roommates", "I need roommates"],
                ["living_with_family", "I’m living with family"],
              ].map(([value, label]) => (
                <Choice
                  type="radio"
                  name="offCampusStatus"
                  value={value}
                  label={label}
                  defaultChecked={data.offCampusStatus === value}
                  required
                  key={value}
                />
              ))}
            </div>
          </fieldset>
          <fieldset className="form-section">
            <legend>What would make this easier?</legend>
            <div className="choice-grid choice-grid--multi">
              {[
                ["verified_listings", "Verified listings"],
                ["budget_planning", "Budget planning"],
                ["lease_resources", "Lease resources"],
                ["roommate_finder", "Roommate finder"],
                ["neighborhood_guide", "Neighborhood guide"],
                ["public_transit", "Public transit"],
                ["furniture_exchange", "Furniture exchange"],
              ].map(([value, label]) => (
                <Choice
                  name="offCampusResources"
                  value={value}
                  label={label}
                  defaultChecked={data.offCampusResources?.includes(value)}
                  key={value}
                />
              ))}
            </div>
          </fieldset>
        </>
      ) : null}

      {preference === "commuting" ? (
        <fieldset className="form-section">
          <legend>Build your commuter starter pack</legend>
          <div className="form-grid">
            <label className="field">
              <span>Main commute</span>
              <select
                name="commuteMode"
                defaultValue={data.commuteMode ?? ""}
                required
              >
                <option value="" disabled>Choose one</option>
                <option value="drive">Drive</option>
                <option value="public_transit">Public transit</option>
                <option value="bike_scooter">Bike / scooter</option>
                <option value="walk">Walk</option>
                <option value="carpool">Carpool</option>
              </select>
            </label>
            <label className="field">
              <span>One-way time</span>
              <select
                name="commuteDuration"
                defaultValue={data.commuteDuration ?? ""}
                required
              >
                <option value="" disabled>Choose one</option>
                <option value="under_20">Under 20 minutes</option>
                <option value="20_40">20–40 minutes</option>
                <option value="40_60">40–60 minutes</option>
                <option value="over_60">More than an hour</option>
              </select>
            </label>
          </div>
          <div className="choice-grid choice-grid--multi">
            {[
              ["parking_permit", "Parking permit"],
              ["transit_pass", "Transit pass"],
              ["bike_storage", "Bike storage"],
              ["commuter_lounge", "Commuter lounge"],
              ["day_use_lockers", "Day-use lockers"],
              ["meal_plan", "Meal plan"],
              ["safety_escort", "Safety escort"],
              ["commuter_events", "Commuter events"],
            ].map(([value, label]) => (
              <Choice
                name="commuterResources"
                value={value}
                label={label}
                defaultChecked={data.commuterResources?.includes(value)}
                key={value}
              />
            ))}
          </div>
        </fieldset>
      ) : null}

      {preference === "undecided" || preference === "family" ? (
        <div className="review-summary">
          <h3>Keep your options open</h3>
          <p>
            A housing advisor can help compare cost, timing, family needs, and
            availability. No housing deposit is required here.
          </p>
        </div>
      ) : null}
    </>
  );
}

function CampusLifeFields({ data }: { data: StudentOnboardingData }) {
  return (
    <>
      <fieldset className="form-section">
        <legend>Explore student clubs</legend>
        <p>Select anything you want Aster to place in your welcome feed.</p>
        <div className="choice-grid choice-grid--multi">
          {campusInterestOptions.map(([value, label]) => (
            <Choice
              name="campusInterests"
              value={value}
              label={label}
              defaultChecked={data.campusInterests?.includes(value)}
              key={value}
            />
          ))}
        </div>
      </fieldset>
      <fieldset className="form-section">
        <legend>Your social settings</legend>
        <label className="field">
          <span>I feel most comfortable…</span>
          <select name="socialComfort" defaultValue={data.socialComfort ?? ""}>
            <option value="">Choose later</option>
            <option value="small_groups">In small groups</option>
            <option value="big_events">At big events</option>
            <option value="mix">A mix</option>
            <option value="one_on_one">One-on-one first</option>
          </select>
        </label>
        <h3>In your first month, what would you love to find?</h3>
        <div className="choice-grid choice-grid--multi">
          {firstMonthGoalOptions.map(([value, label]) => (
            <Choice
              name="firstMonthGoals"
              value={value}
              label={label}
              defaultChecked={data.firstMonthGoals?.includes(value)}
              key={value}
            />
          ))}
        </div>
      </fieldset>
      <fieldset className="form-section">
        <legend>What support would you like to hear about?</legend>
        <div className="choice-grid choice-grid--multi">
          {supportNeedOptions.map(([value, label]) => (
            <Choice
              name="supportNeeds"
              value={value}
              label={label}
              defaultChecked={data.supportNeeds?.includes(value)}
              key={value}
            />
          ))}
        </div>
      </fieldset>
    </>
  );
}

function EmergencyContactFields({ data }: { data: StudentOnboardingData }) {
  const nextKey = useRef(1);
  const [contacts, setContacts] = useState(() =>
    (data.emergencyContacts?.length
      ? data.emergencyContacts
      : [emptyEmergencyContact]
    ).map((value, index) => ({ key: `contact-${index}`, value })),
  );

  return (
    <>
      <input type="hidden" name="emergencyContactCount" value={contacts.length} />
      {contacts.map(({ key, value }, index) => (
        <fieldset className="form-section" key={key}>
          <legend>
            {index === 0
              ? "Primary emergency contact"
              : `Additional emergency contact ${index}`}
          </legend>
          {contacts.length > 1 ? (
            <button
              className="text-button"
              type="button"
              onClick={() =>
                setContacts((current) =>
                  current.filter((contact) => contact.key !== key),
                )
              }
            >
              Remove
            </button>
          ) : null}
          <div className="form-grid">
            <label className="field">
              <span>Full name</span>
              <input
                name={`emergencyContacts.${index}.fullName`}
                defaultValue={value.fullName}
                maxLength={160}
                required
              />
            </label>
            <label className="field">
              <span>Relationship</span>
              <select
                name={`emergencyContacts.${index}.relationship`}
                defaultValue={value.relationship}
                required
              >
                <option value="parent">Parent</option>
                <option value="guardian">Guardian</option>
                <option value="partner">Partner</option>
                <option value="sibling">Sibling</option>
                <option value="relative">Relative</option>
                <option value="friend">Friend</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label className="field">
              <span>Mobile number</span>
              <input
                name={`emergencyContacts.${index}.mobilePhone`}
                defaultValue={value.mobilePhone}
                placeholder="+1 555 010 0300"
                type="tel"
                required
              />
            </label>
          </div>
        </fieldset>
      ))}
      {contacts.length < 4 ? (
        <button
          className="button button--secondary"
          type="button"
          onClick={() => {
            const key = `new-contact-${nextKey.current++}`;
            setContacts((current) => [
              ...current,
              { key, value: emptyEmergencyContact },
            ]);
          }}
        >
          + Add another emergency contact
        </button>
      ) : null}
      <div className="review-summary">
        <h3>Emergency use only</h3>
        <p>
          These contacts are not invited to your portal and cannot discuss
          your record unless you separately authorize them.
        </p>
      </div>
    </>
  );
}

function FamilyPermissionFields({ data }: { data: StudentOnboardingData }) {
  const nextKey = useRef(1);
  const [permissions, setPermissions] = useState(() =>
    (data.familyPermissions ?? []).map((value, index) => ({
      key: `permission-${index}`,
      value,
    })),
  );

  return (
    <>
      <input type="hidden" name="familyPermissionCount" value={permissions.length} />
      {permissions.length === 0 ? (
        <div className="review-summary">
          <h3>No one else has record access</h3>
          <p>
            Your record is private by default. You can continue this way or
            authorize a specific person and exact record categories.
          </p>
        </div>
      ) : null}
      {permissions.map(({ key, value }, index) => (
        <fieldset className="form-section" key={key}>
          <legend>Authorized person {index + 1}</legend>
          <button
            className="text-button"
            type="button"
            onClick={() =>
              setPermissions((current) =>
                current.filter((permission) => permission.key !== key),
              )
            }
          >
            Remove
          </button>
          <div className="form-grid">
            <label className="field">
              <span>Full name</span>
              <input
                name={`familyPermissions.${index}.fullName`}
                defaultValue={value.fullName}
                maxLength={160}
                required
              />
            </label>
            <label className="field">
              <span>Relationship</span>
              <select
                name={`familyPermissions.${index}.relationship`}
                defaultValue={value.relationship}
                required
              >
                <option value="parent">Parent</option>
                <option value="guardian">Guardian</option>
                <option value="partner">Spouse or partner</option>
                <option value="sponsor">Sponsor</option>
                <option value="other">Other trusted person</option>
              </select>
            </label>
            <label className="field">
              <span>Email</span>
              <input
                name={`familyPermissions.${index}.email`}
                defaultValue={value.email}
                type="email"
                maxLength={254}
                required
              />
            </label>
          </div>
          <h3>What may Aster discuss with this person?</h3>
          <div className="choice-grid choice-grid--multi">
            {ferpaScopeOptions.map(([scope, label]) => (
              <Choice
                name={`familyPermissions.${index}.scopes`}
                value={scope}
                label={label}
                defaultChecked={value.scopes.includes(scope)}
                key={scope}
              />
            ))}
          </div>
          <div className="form-grid">
            <label className="field">
              <span>Purpose of this disclosure</span>
              <select
                name={`familyPermissions.${index}.purpose`}
                defaultValue={value.purpose}
                required
              >
                <option value="education_and_expenses">Coordinate my education and expenses</option>
                <option value="academic_planning">Help me manage academic planning</option>
                <option value="billing_and_aid">Help me manage billing and aid</option>
                <option value="other">Another purpose stated in my signed form</option>
              </select>
            </label>
            <label className="field">
              <span>Permission ends</span>
              <select
                name={`familyPermissions.${index}.expires`}
                defaultValue={value.expires}
                required
              >
                <option value="end_first_year">End of first academic year</option>
                <option value="end_enrollment">End of my enrollment at Aster</option>
                <option value="registrar_date">On a date I provide to the Registrar</option>
              </select>
            </label>
          </div>
        </fieldset>
      ))}
      {permissions.length < 4 ? (
        <button
          className="button button--secondary"
          type="button"
          onClick={() => {
            const key = `new-permission-${nextKey.current++}`;
            setPermissions((current) => [
              ...current,
              { key, value: emptyFamilyPermission },
            ]);
          }}
        >
          + Add a parent, guardian or supporter
        </button>
      ) : null}
    </>
  );
}

function StepFields({
  step,
  data,
  offer,
  depositPaid,
}: {
  step: OnboardingStep;
  data: StudentOnboardingData;
  offer: AdmissionOfferSummary;
  depositPaid: boolean;
}) {
  switch (step) {
    case "offer":
      return (
        <>
          <div className="onboarding-offer">
            <p className="eyebrow">Admission offer</p>
            <h3>{offer.programName}</h3>
            <p>{offer.termName} · {offer.campusName}</p>
            <dl>
              <div>
                <dt>Respond by</dt>
                <dd>
                  {new Intl.DateTimeFormat("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                    timeZone: "UTC",
                  }).format(new Date(offer.responseDeadline))}
                </dd>
              </div>
              <div>
                <dt>Deposit</dt>
                <dd>{formatMoney(offer.depositAmountCents)}</dd>
              </div>
            </dl>
          </div>
          {offer.status === "offered" ? (
            <>
              <label className="confirmation-check">
                <input name="offerAccepted" type="checkbox" required />
                <span>
                  <strong>Yes—start my Aster enrollment</strong>
                  I accept my offer of admission and understand this decision
                  will be recorded in my official admissions record.
                </span>
              </label>
              <Link className="button button--secondary" href="/help">
                I’m still deciding—show me my options
              </Link>
            </>
          ) : (
            <p className="confirmed-line">
              <span aria-hidden="true">✓</span>
              Your admission offer is {offer.status}.
            </p>
          )}
        </>
      );
    case "about_you":
      return (
        <>
          <fieldset className="form-section">
            <legend>We know a lot already. Make sure it still feels like you.</legend>
            <div className="form-grid">
              <label className="field">
                <span>Legal first name</span>
                <input
                  name="firstName"
                  required
                  maxLength={120}
                  autoComplete="given-name"
                  defaultValue={data.firstName ?? ""}
                />
              </label>
              <label className="field">
                <span>Legal last name</span>
                <input
                  name="lastName"
                  required
                  maxLength={120}
                  autoComplete="family-name"
                  defaultValue={data.lastName ?? ""}
                />
              </label>
              <label className="field">
                <span>What should we call you?</span>
                <input
                  name="preferredName"
                  required
                  maxLength={120}
                  autoComplete="nickname"
                  defaultValue={data.preferredName ?? ""}
                />
              </label>
              <label className="field">
                <span>Personal email</span>
                <input
                  name="personalEmail"
                  type="email"
                  required
                  maxLength={254}
                  autoComplete="email"
                  defaultValue={data.personalEmail ?? ""}
                />
              </label>
              <label className="field">
                <span>Mobile number</span>
                <input
                  name="mobilePhone"
                  type="tel"
                  required
                  maxLength={32}
                  autoComplete="tel"
                  defaultValue={data.mobilePhone ?? ""}
                />
              </label>
              <label className="field">
                <span>Citizenship / student status</span>
                <select
                  name="citizenshipStatus"
                  defaultValue={data.citizenshipStatus ?? ""}
                  required
                >
                  <option value="" disabled>Choose one</option>
                  <option value="us_citizen">U.S. citizen</option>
                  <option value="permanent_resident">U.S. permanent resident</option>
                  <option value="eligible_noncitizen">Other eligible noncitizen / status</option>
                  <option value="international">International student · F-1 or J-1</option>
                </select>
              </label>
            </div>
          </fieldset>
          <fieldset className="form-section">
            <legend>Your permanent home address</legend>
            <p>
              This helps Aster prepare your initial tuition classification.
              Residency is determined under institutional and state policy,
              not by this address alone.
            </p>
            <div className="form-grid">
              <label className="field">
                <span>Street address</span>
                <input
                  name="streetAddress"
                  defaultValue={data.streetAddress ?? ""}
                  autoComplete="street-address"
                  maxLength={180}
                  required
                />
              </label>
              <label className="field">
                <span>Apartment, unit or building · optional</span>
                <input
                  name="addressLine2"
                  defaultValue={data.addressLine2 ?? ""}
                  maxLength={180}
                />
              </label>
              <label className="field">
                <span>City</span>
                <input
                  name="city"
                  defaultValue={data.city ?? ""}
                  autoComplete="address-level2"
                  maxLength={120}
                  required
                />
              </label>
              <label className="field">
                <span>State / province</span>
                <input
                  name="stateOrProvince"
                  defaultValue={data.stateOrProvince ?? ""}
                  autoComplete="address-level1"
                  maxLength={120}
                  required
                />
              </label>
              <label className="field">
                <span>ZIP / postal code</span>
                <input
                  name="postalCode"
                  defaultValue={data.postalCode ?? ""}
                  autoComplete="postal-code"
                  maxLength={32}
                  required
                />
              </label>
              <label className="field">
                <span>Country</span>
                <select
                  name="country"
                  defaultValue={data.country ?? ""}
                  autoComplete="country-name"
                  required
                >
                  <option value="" disabled>Choose one</option>
                  <option value="United States">United States</option>
                  <option value="Canada">Canada</option>
                  <option value="China">China</option>
                  <option value="India">India</option>
                  <option value="Mexico">Mexico</option>
                  <option value="Türkiye">Türkiye</option>
                  <option value="United Kingdom">United Kingdom</option>
                  <option value="Another country">Another country</option>
                </select>
              </label>
            </div>
          </fieldset>
        </>
      );
    case "housing":
      return <HousingFields data={data} />;
    case "campus_life":
      return <CampusLifeFields data={data} />;
    case "emergency_contacts":
      return <EmergencyContactFields data={data} />;
    case "family_permissions":
      return <FamilyPermissionFields data={data} />;
    case "review_and_sign":
      return (
        <>
          <div className="review-summary">
            <h3>Your saved choices</h3>
            <dl>
              <div>
                <dt>Residency</dt>
                <dd>{data.residencyStatus?.replace("_", " ") || "Not provided"}</dd>
              </div>
              <div>
                <dt>Housing</dt>
                <dd>{data.housingPreference?.replace("_", " ") || "Not provided"}</dd>
              </div>
              <div>
                <dt>Emergency contacts</dt>
                <dd>{data.emergencyContacts?.length || 0} entered</dd>
              </div>
              <div>
                <dt>Campus interests</dt>
                <dd>{data.campusInterests?.length || 0} selected</dd>
              </div>
            </dl>
          </div>
          <fieldset className="form-section">
            <legend>Type your full legal name once</legend>
            <p>
              Aster uses it as your electronic confirmation for this
              onboarding packet. Optional permissions remain separate.
            </p>
            <label className="field">
              <span>Full legal name</span>
              <input
                name="signatureFullName"
                defaultValue={
                  data.signatureFullName ??
                  `${data.firstName ?? ""} ${data.lastName ?? ""}`.trim()
                }
                maxLength={240}
                required
              />
            </label>
          </fieldset>
        </>
      );
    case "deposit":
      return (
        <>
          <div className="deposit-callout">
            <span>Enrollment deposit</span>
            <strong>{formatMoney(offer.depositAmountCents)}</strong>
            <p>
              {depositPaid
                ? "Payment received through Aster’s secure processor."
                : "Choose whether to pay now, pay later, or request a waiver or deferral."}
            </p>
          </div>
          <fieldset className="form-section">
            <legend>How would you like to handle it?</legend>
            <div className="choice-grid">
              <Choice
                type="radio"
                name="depositChoice"
                value="pay_now"
                label={
                  depositPaid
                    ? "Payment already received"
                    : `Pay ${formatMoney(offer.depositAmountCents)} securely now`
                }
                defaultChecked={
                  depositPaid || data.depositChoice === "pay_now"
                }
                required
              />
              {!depositPaid ? (
                <>
                  <Choice
                    type="radio"
                    name="depositChoice"
                    value="pay_later"
                    label={`Accept now, pay by ${new Intl.DateTimeFormat("en-US", {
                      month: "long",
                      day: "numeric",
                      timeZone: "UTC",
                    }).format(new Date(offer.responseDeadline))}`}
                    defaultChecked={data.depositChoice === "pay_later"}
                    required
                  />
                  <Choice
                    type="radio"
                    name="depositChoice"
                    value="waiver_or_deferral"
                    label="Request a waiver or deferral"
                    defaultChecked={
                      data.depositChoice === "waiver_or_deferral"
                    }
                    required
                  />
                </>
              ) : null}
            </div>
          </fieldset>
        </>
      );
  }
}

function optionalFormString(values: FormData, name: string) {
  const value = String(values.get(name) ?? "").trim();
  return value || undefined;
}

function normalizedPhone(values: FormData, name: string) {
  const value = String(values.get(name) ?? "")
    .trim()
    .replace(/[ ()-]/g, "");
  return value && !value.startsWith("+") ? `+${value}` : value;
}

function dataFromForm(
  step: OnboardingStep,
  form: HTMLFormElement,
  current: StudentOnboardingData,
): StudentOnboardingData {
  const values = new FormData(form);
  const next = { ...current };

  switch (step) {
    case "offer":
      return next;
    case "about_you":
      {
        const citizenshipStatus = values.get(
          "citizenshipStatus",
        ) as StudentOnboardingData["citizenshipStatus"];
      return {
        ...next,
        firstName: String(values.get("firstName") ?? "").trim(),
        lastName: String(values.get("lastName") ?? "").trim(),
        preferredName: String(values.get("preferredName") ?? "").trim(),
        personalEmail: String(values.get("personalEmail") ?? "")
          .trim()
          .toLowerCase(),
        mobilePhone: normalizedPhone(values, "mobilePhone"),
        citizenshipStatus,
        communicationPreference: next.communicationPreference ?? "email",
        residencyStatus:
          citizenshipStatus === "international"
            ? "international"
            : "domestic",
        streetAddress: String(values.get("streetAddress") ?? "").trim(),
        addressLine2: optionalFormString(values, "addressLine2"),
        city: String(values.get("city") ?? "").trim(),
        stateOrProvince: String(values.get("stateOrProvince") ?? "").trim(),
        postalCode: String(values.get("postalCode") ?? "").trim(),
        country: String(values.get("country") ?? "").trim(),
      };
      }
    case "housing":
      return {
        ...next,
        housingPreference: values.get(
          "housingPreference",
        ) as StudentOnboardingData["housingPreference"],
        housingRoomType: optionalFormString(values, "housingRoomType"),
        bathroomPreference: optionalFormString(values, "bathroomPreference"),
        roommateMatching: optionalFormString(values, "roommateMatching"),
        sleepSchedule: optionalFormString(values, "sleepSchedule"),
        studyHabits: optionalFormString(values, "studyHabits"),
        roomNoise: optionalFormString(values, "roomNoise"),
        cleanliness: optionalFormString(values, "cleanliness"),
        guestPreference: optionalFormString(values, "guestPreference"),
        temperaturePreference: optionalFormString(
          values,
          "temperaturePreference",
        ),
        smokeVapeCompatibility: optionalFormString(
          values,
          "smokeVapeCompatibility",
        ),
        substanceFreeHousing: values.get("substanceFreeHousing") === "yes",
        genderInclusiveHousing:
          values.get("genderInclusiveHousing") === "yes",
        accessibleHousingInformation:
          values.get("accessibleHousingInformation") === "yes",
        livingLearningCommunities: values
          .getAll("livingLearningCommunities")
          .map(String),
        offCampusStatus: optionalFormString(values, "offCampusStatus"),
        offCampusResources: values.getAll("offCampusResources").map(String),
        commuteMode: optionalFormString(values, "commuteMode"),
        commuteDuration: optionalFormString(values, "commuteDuration"),
        commuterResources: values.getAll("commuterResources").map(String),
      };
    case "campus_life":
      return {
        ...next,
        campusInterests: values.getAll("campusInterests").map(String),
        supportNeeds: values.getAll("supportNeeds").map(String),
        socialComfort: optionalFormString(values, "socialComfort"),
        firstMonthGoals: values.getAll("firstMonthGoals").map(String),
      };
    case "emergency_contacts":
      {
        const contactCount = Number(
          values.get("emergencyContactCount") ?? 0,
        );
      return {
        ...next,
        emergencyContacts: Array.from(
          { length: contactCount },
          (_, index) => ({
            fullName: String(
              values.get(`emergencyContacts.${index}.fullName`) ?? "",
            ).trim(),
            relationship: String(
              values.get(`emergencyContacts.${index}.relationship`) ??
                "other",
            ) as OnboardingEmergencyContact["relationship"],
            mobilePhone: normalizedPhone(
              values,
              `emergencyContacts.${index}.mobilePhone`,
            ),
          }),
        ),
      };
      }
    case "family_permissions":
      {
        const permissionCount = Number(
          values.get("familyPermissionCount") ?? 0,
        );
      return {
        ...next,
        familyPermissions: Array.from(
          { length: permissionCount },
          (_, index) => ({
            fullName: String(
              values.get(`familyPermissions.${index}.fullName`) ?? "",
            ).trim(),
            relationship: String(
              values.get(`familyPermissions.${index}.relationship`) ??
                "other",
            ) as OnboardingFamilyPermission["relationship"],
            email: String(
              values.get(`familyPermissions.${index}.email`) ?? "",
            )
              .trim()
              .toLowerCase(),
            scopes: values
              .getAll(`familyPermissions.${index}.scopes`)
              .map(String),
            purpose: String(
              values.get(`familyPermissions.${index}.purpose`) ??
                "education_and_expenses",
            ) as OnboardingFamilyPermission["purpose"],
            expires: String(
              values.get(`familyPermissions.${index}.expires`) ??
                "end_first_year",
            ) as OnboardingFamilyPermission["expires"],
          }),
        ),
      };
      }
    case "review_and_sign":
      return {
        ...next,
        signatureFullName: String(
          values.get("signatureFullName") ?? "",
        ).trim(),
      };
    case "deposit":
      return {
        ...next,
        depositChoice: values.get(
          "depositChoice",
        ) as StudentOnboardingData["depositChoice"],
      };
  }
}

function OnboardingFlow({
  initial,
  dashboard,
  initialPayments,
  reload,
}: {
  initial: StudentOnboarding;
  dashboard: StudentDashboard;
  initialPayments: StudentPaymentList;
  reload: () => void;
}) {
  const [onboarding, setOnboarding] = useState(initial);
  const [offer, setOffer] = useState(dashboard.offer);
  const [depositPaid, setDepositPaid] = useState(
    initialPayments.items.some((payment) => payment.status === "succeeded"),
  );
  const [error, setError] = useState<string | null>(null);
  const completeKey = useRef<string | null>(null);
  const offerKey = useRef<string | null>(null);
  const depositKey = useRef<string | null>(null);
  const saveAction = useCallback(
    (input: UpdateStudentOnboardingInput) => updateStudentOnboarding(input),
    [],
  );
  const save = useApiAction(saveAction);
  const completeAction = useCallback(
    (expectedVersion: number, key: string) =>
      completeStudentOnboarding({ expectedVersion }, key),
    [],
  );
  const complete = useApiAction(completeAction);
  const stepIndex = onboardingSteps.findIndex(
    (step) => step.key === onboarding.currentStep,
  );
  const step = onboardingSteps[stepIndex] || onboardingSteps[0];
  const allStepsSaved = onboardingSteps.every(({ key }) =>
    onboarding.completedSteps.includes(key),
  );
  const offerCannotAdvance =
    onboarding.currentStep === "offer" &&
    offer.status !== "offered" &&
    offer.status !== "accepted";

  useEffect(() => {
    if (onboarding.status === "completed") {
      window.location.replace("/dashboard");
    }
  }, [onboarding.status]);

  const submitStep = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    save.reset();
    const nextData = editableOnboardingData(
      dataFromForm(
        onboarding.currentStep,
        event.currentTarget,
        onboarding.data,
      ),
    );

    try {
      if (onboarding.currentStep === "offer" && offer.status === "offered") {
        const key = offerKey.current ?? (offerKey.current = crypto.randomUUID());
        await acceptAdmissionOffer(offer.id, key);
        offerKey.current = null;
        setOffer((current) => ({ ...current, status: "accepted" }));
      }
      if (
        onboarding.currentStep === "deposit" &&
        nextData.depositChoice === "pay_now" &&
        !depositPaid
      ) {
        const key =
          depositKey.current ?? (depositKey.current = crypto.randomUUID());
        await createDepositPayment({ offerId: offer.id }, key);
        depositKey.current = null;
        setDepositPaid(true);
      }
      const result = await save.run({
        expectedVersion: onboarding.version,
        currentStep: onboarding.currentStep,
        data: nextData,
      });
      setOnboarding(result);
      window.scrollTo({
        top: 0,
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
      });
    } catch (caught) {
      setError(getApiErrorMessage(caught));
    }
  };

  const finish = async () => {
    setError(null);
    complete.reset();
    const key =
      completeKey.current ?? (completeKey.current = crypto.randomUUID());
    try {
      const result = await complete.run(onboarding.version, key);
      completeKey.current = null;
      setOnboarding(result);
    } catch (caught) {
      setError(getApiErrorMessage(caught));
    }
  };

  const skipStep = async () => {
    setError(null);
    save.reset();
    try {
      const result = await save.run({
        expectedVersion: onboarding.version,
        currentStep: onboarding.currentStep,
        data: editableOnboardingData(onboarding.data),
        skip: true,
      });
      setOnboarding(result);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (caught) {
      setError(getApiErrorMessage(caught));
    }
  };

  return (
    <div className="onboarding-shell">
      <OnboardingProgress
        current={onboarding.currentStep}
        completed={onboarding.completedSteps}
        skipped={onboarding.data.skippedSteps ?? []}
      />
      <main className="onboarding-main">
        <header className="onboarding-mobile-header">
          <Link className="brand" href="/onboarding">
            <PortalMark />
            <span>
              <strong>Aster</strong>
              <small>University</small>
            </span>
          </Link>
          <span>{onboarding.completedSteps.length}/{onboardingSteps.length} saved</span>
        </header>
        <div className="onboarding-stage">
          <header className="onboarding-title">
            <div className="onboarding-title__count">
              <span>Step</span>
              <strong>{stepIndex + 1}</strong>
              <small>of {onboardingSteps.length}</small>
            </div>
            <div>
              <p className="eyebrow">{step.label}</p>
              <h1>{step.title}</h1>
              <p>{step.subtitle}</p>
            </div>
          </header>

          <form
            className="onboarding-form"
            key={`${onboarding.currentStep}-${onboarding.version}`}
            onSubmit={submitStep}
          >
            <StepFields
              step={onboarding.currentStep}
              data={onboarding.data}
              offer={offer}
              depositPaid={depositPaid}
            />
            {error || save.message || complete.message ? (
              <p className="field-error" role="alert">
                {error || save.message || complete.message}
              </p>
            ) : null}
            <div className="onboarding-actions">
              <p>
                <span aria-hidden="true">✓</span>
                Saved progress is available on any signed-in device.
              </p>
              {offerCannotAdvance ? (
                <a className="button button--primary" href="mailto:admissions@aster.edu">
                  Get help with this offer <span aria-hidden="true">→</span>
                </a>
              ) : allStepsSaved ? (
                <button
                  className="button button--primary"
                  type="button"
                  disabled={complete.status === "loading"}
                  onClick={() => void finish()}
                >
                  {complete.status === "loading"
                    ? "Finishing onboarding…"
                    : complete.status === "error"
                      ? "Retry completion"
                      : "Finish onboarding"}
                  <span aria-hidden="true">→</span>
                </button>
              ) : (
                <div className="onboarding-actions__controls">
                  {step.skippable ? (
                    <button
                      className="text-button"
                      type="button"
                      disabled={save.status === "loading"}
                      onClick={() => void skipStep()}
                    >
                      Skip for now
                    </button>
                  ) : null}
                  <button
                    className="button button--primary"
                    type="submit"
                    disabled={save.status === "loading"}
                  >
                    {save.status === "loading"
                      ? onboarding.currentStep === "offer" &&
                        offer.status === "offered"
                        ? "Accepting offer…"
                        : "Saving step…"
                      : save.status === "error"
                        ? "Retry step"
                        : onboarding.currentStep === "offer" &&
                            offer.status === "offered"
                          ? "Accept and continue"
                          : "Save and continue"}
                    <span aria-hidden="true">→</span>
                  </button>
                </div>
              )}
            </div>
            {save.status === "error" || complete.status === "error" ? (
              <button
                className="text-button"
                type="button"
                onClick={reload}
              >
                Reload latest saved progress
              </button>
            ) : null}
          </form>

          <aside className="why-card">
            <span aria-hidden="true">i</span>
            <div>
              <strong>Why we ask</strong>
              <p>
                Aster uses this information only to prepare your student record,
                personalize support, and meet university obligations. Official
                changes are always confirmed by the server.
              </p>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}

function OnboardingResource() {
  const loadOnboarding = useCallback(
    async (signal: AbortSignal): Promise<OnboardingPageData> => {
      const [onboarding, dashboard, payments] = await Promise.all([
        getStudentOnboarding(signal),
        getStudentDashboard(signal),
        getStudentPayments(signal),
      ]);
      return { onboarding, dashboard, payments };
    },
    [],
  );
  const onboarding = useApiResource(loadOnboarding);

  if (onboarding.status === "loading") {
    return (
      <main className="load-state" aria-busy="true" aria-live="polite">
        <div className="load-state__card">
          <PortalMark />
          <p className="eyebrow">Aster University</p>
          <h1>Resuming your onboarding</h1>
          <p>We’re opening your last server-confirmed step.</p>
          <span className="loader" aria-hidden="true" />
        </div>
      </main>
    );
  }

  if (onboarding.status === "error") {
    return (
      <main className="load-state">
        <div className="load-state__card" role="alert">
          <PortalMark />
          <p className="eyebrow">Aster University</p>
          <h1>Your onboarding couldn’t open</h1>
          <p>{onboarding.error}</p>
          <button
            className="button button--primary"
            type="button"
            onClick={onboarding.reload}
          >
            Try again
          </button>
          <a className="text-link" href="mailto:enrollment@aster.edu">
            Get help
          </a>
        </div>
      </main>
    );
  }

  return (
    <OnboardingFlow
      initial={onboarding.data.onboarding}
      dashboard={onboarding.data.dashboard}
      initialPayments={onboarding.data.payments}
      reload={onboarding.reload}
      key={onboarding.data.onboarding.version}
    />
  );
}

export default function OnboardingPage() {
  const loadBootstrap = useCallback(
    (signal: AbortSignal) => getStudentBootstrap(signal),
    [],
  );
  const bootstrap = useApiResource(loadBootstrap);
  const alreadyComplete =
    bootstrap.data?.onboarding.status === "completed" ||
    bootstrap.data?.onboarding.required === false;
  const needsSignIn =
    bootstrap.status === "error" &&
    (bootstrap.errorStatus === 401 || bootstrap.errorStatus === 403);

  useEffect(() => {
    if (needsSignIn) {
      window.location.replace("/sign-in");
    } else if (alreadyComplete) {
      window.location.replace("/dashboard");
    }
  }, [alreadyComplete, needsSignIn]);

  if (bootstrap.status === "loading" || needsSignIn || alreadyComplete) {
    return (
      <main className="load-state" aria-busy="true" aria-live="polite">
        <div className="load-state__card">
          <PortalMark />
          <p className="eyebrow">Aster University</p>
          <h1>Checking your onboarding</h1>
          <p>We’re opening the right place for your saved progress.</p>
          <span className="loader" aria-hidden="true" />
        </div>
      </main>
    );
  }

  if (bootstrap.status === "error") {
    return (
      <main className="load-state">
        <div className="load-state__card" role="alert">
          <PortalMark />
          <p className="eyebrow">Aster University</p>
          <h1>We couldn’t confirm your onboarding</h1>
          <p>{bootstrap.error}</p>
          <button
            className="button button--primary"
            type="button"
            onClick={bootstrap.reload}
          >
            Try again
          </button>
        </div>
      </main>
    );
  }

  return <OnboardingResource />;
}
