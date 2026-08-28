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

export interface GuideSection {
  id: string;
  heading: LocalizedText;
  audience: GuideAudience;
  paragraphs: LocalizedText[];
  bullets: LocalizedText[];
  listPresentation?: GuideSectionListPresentation;
  warnings: LocalizedText[];
  sourceIds: string[];
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
