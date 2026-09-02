export type Locale = 'en' | 'fr';

export interface LocalizedText {
  en: string;
  fr: string;
}

export interface OfficialSource {
  id: string;
  title: LocalizedText;
  publisher: LocalizedText;
  urls: Partial<Record<Locale, string>>;
  checkedOn: string;
}

export type GuideAudience = 'all-members' | 'operators';
export type FundingSource = 'npp' | 'public-administered-through-npp';
export type GuideSectionListPresentation = 'bullets' | 'steps';
export type GrantEntitlementStatus =
  | 'published-amount-or-ceiling'
  | 'published-formula'
  | 'current-or-local-rate-unavailable';

export interface GrantEntitlement {
  status: GrantEntitlementStatus;
  amountOrFormula: LocalizedText;
  note: LocalizedText;
}

export interface GuideSection {
  id: string;
  heading: LocalizedText;
  audience: GuideAudience;
  paragraphs: LocalizedText[];
  bullets: LocalizedText[];
  listPresentation?: GuideSectionListPresentation;
  warnings: LocalizedText[];
  sourceIds: string[];
  examples?: LocalizedText[];
}

export interface GrantGuide {
  id: string;
  name: LocalizedText;
  fundingSource: FundingSource;
  eligibleApplicant: LocalizedText;
  purpose: LocalizedText;
  timing: LocalizedText;
  evidence: LocalizedText[];
  claimOwner: LocalizedText;
  approvalAndSubmission: LocalizedText;
  accountTreatment: LocalizedText;
  unspentBalanceRule: LocalizedText;
  sourceIds: string[];
  entitlement: GrantEntitlement;
  requirements: LocalizedText[];
}

export interface ChecklistItem {
  id: string;
  label: LocalizedText;
}

export interface NppGuideContent {
  title: LocalizedText;
  description: LocalizedText;
  disclaimer: LocalizedText;
  officialSourcesCheckedLabel: LocalizedText;
  officialSourcesCheckedOn: string;
  sections: GuideSection[];
  grants: GrantGuide[];
  checklist: ChecklistItem[];
  sources: OfficialSource[];
}

export type TaskBand = 'start-here' | 'spend-and-pay' | 'claim-and-reference';
export type TaskView = 'section' | 'checklist' | 'grants' | 'sources';
export type TaskAudienceFilter = 'all' | GuideAudience;

export interface TaskDefinition {
  id: string;
  band: TaskBand;
  title: LocalizedText;
  when: LocalizedText;
  audience: GuideAudience;
  view: TaskView;
  sectionId: string;
}
