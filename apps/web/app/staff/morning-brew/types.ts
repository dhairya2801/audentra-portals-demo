export type MorningBrewTopicId =
  | "enrollment_admissions"
  | "financial_aid"
  | "student_operations"
  | "executive_performance"
  | "industry_policy";

export type MorningBrewConnectorId = "outlook" | "calendar" | "student_crm";
export type MorningBrewSignalSource = "workspace" | "modeled" | "connected_demo";

export type MorningBrewDestination =
  | "outreach"
  | "tasks"
  | "students"
  | "messages"
  | "campus_life"
  | "academics";

export interface MorningBrewTopic {
  id: MorningBrewTopicId;
  title: string;
  description: string;
  icon: string;
  accent: "purple" | "blue" | "teal" | "navy" | "slate";
}

export interface MorningBrewConnector {
  id: MorningBrewConnectorId;
  title: string;
  description: string;
  icon: string;
  optional: boolean;
}

export interface MorningBrewPreferences {
  version: 2;
  topics: MorningBrewTopicId[];
  connectors: Record<MorningBrewConnectorId, boolean>;
  onboardingComplete: boolean;
  updatedAt: string;
}

export interface MorningBrewStory {
  id: string;
  topic: MorningBrewTopicId;
  label: string;
  title: string;
  summary: string;
  takeaway: string;
  tone: "positive" | "watch" | "urgent" | "neutral";
  source: MorningBrewSignalSource;
  destination?: MorningBrewDestination;
}

export interface MorningBrewMetric {
  id: string;
  topic: MorningBrewTopicId;
  label: string;
  value: string;
  delta: string;
  comparison: string;
  direction: "up" | "down" | "flat";
  favorable: boolean;
  points: number[];
  source: MorningBrewSignalSource;
}

export interface MorningBrewChange {
  id: string;
  topic: MorningBrewTopicId;
  time: string;
  title: string;
  detail: string;
  tone: "positive" | "watch" | "neutral";
  source: MorningBrewSignalSource;
}

export interface MorningBrewAttentionItem {
  id: string;
  topic: MorningBrewTopicId;
  count: string;
  label: string;
  detail: string;
  urgency: "today" | "this_week" | "monitor";
  source: MorningBrewSignalSource;
  destination?: MorningBrewDestination;
}

export interface MorningBrewMeeting {
  id: string;
  time: string;
  duration: string;
  title: string;
  detail: string;
  priority: "high" | "normal";
  attendees: string[];
}

export interface MorningBrewEmail {
  id: string;
  time: string;
  sender: string;
  subject: string;
  summary: string;
  priority: "high" | "normal";
}

export interface MorningBrewNewsItem {
  id: string;
  category: "Industry" | "Government & policy";
  sourceName: string;
  published: string;
  headline: string;
  relevance: string;
}

export interface MorningBrewBriefing {
  headline: string;
  deck: string;
  readTimeMinutes: number;
  updatedAt: string;
  stories: MorningBrewStory[];
  metrics: MorningBrewMetric[];
  changes: MorningBrewChange[];
  attention: MorningBrewAttentionItem[];
  meetings: MorningBrewMeeting[];
  emails: MorningBrewEmail[];
  news: MorningBrewNewsItem[];
}

export interface EdwardAnswer {
  question: string;
  answer: string;
  bullets?: string[];
  followUp?: string;
}
