import { nppGuideContent } from '../nppContent';

const requiredGrantIds = [
  'unit-internal-npp',
  'canex-sisip-dividend',
  'reserve-pfmg',
  'reserve-organizational',
  'reserve-contingency',
  'band-grant',
  'band-uniform',
  'kilted-order',
  'ceremonial-other',
];

const expectLocalized = (value: { en: string; fr: string }) => {
  expect(value.en.trim()).not.toBe('');
  expect(value.fr.trim()).not.toBe('');
};

describe('nppGuideContent', () => {
  it('keeps the guide content bilingual and source-traceable', () => {
    expect(nppGuideContent.title).toEqual({
      en: 'NPP / NPF Guide',
      fr: 'Guide des BNP / FNP',
    });
    expect(nppGuideContent.description).toEqual({
      en: 'Guidance for 32 CBG members on Non-Public Property and Non-Public Funds.',
      fr: 'Guide à l’intention des membres du 32 GBC sur les biens non publics et les fonds non publics.',
    });
    expect(nppGuideContent.officialSourcesCheckedOn).toBe('2026-08-28');
    expect(nppGuideContent.checklist).toHaveLength(15);
    expect(new Set(nppGuideContent.grants.map((grant) => grant.id))).toEqual(
      new Set(requiredGrantIds),
    );

    expectLocalized(nppGuideContent.disclaimer);
    expectLocalized(nppGuideContent.officialSourcesCheckedLabel);

    nppGuideContent.sections.forEach((section) => {
      expectLocalized(section.heading);
      section.paragraphs.forEach(expectLocalized);
      section.bullets.forEach(expectLocalized);
      section.warnings.forEach(expectLocalized);
      expect(section.sourceIds).not.toHaveLength(0);
    });

    nppGuideContent.grants.forEach((grant) => {
      expectLocalized(grant.name);
      expectLocalized(grant.eligibleApplicant);
      expectLocalized(grant.purpose);
      expectLocalized(grant.timing);
      grant.evidence.forEach(expectLocalized);
      expectLocalized(grant.claimOwner);
      expectLocalized(grant.approvalAndSubmission);
      expectLocalized(grant.accountTreatment);
      expectLocalized(grant.unspentBalanceRule);
      expect(grant.sourceIds).not.toHaveLength(0);
    });

    nppGuideContent.checklist.forEach((item) => expectLocalized(item.label));
    nppGuideContent.sources.forEach((source) => {
      expectLocalized(source.title);
      expectLocalized(source.publisher);
      expect(Object.keys(source.urls).length).toBeGreaterThan(0);
    });
  });

  it('references only registered official sources', () => {
    const sourceIds = new Set(nppGuideContent.sources.map((source) => source.id));

    nppGuideContent.sections.forEach((section) => {
      section.sourceIds.forEach((sourceId) => expect(sourceIds).toContain(sourceId));
    });
    nppGuideContent.grants.forEach((grant) => {
      grant.sourceIds.forEach((sourceId) => expect(sourceIds).toContain(sourceId));
    });
  });

  it('publishes verified French URLs for bilingual official sources', () => {
    const sources = new Map(nppGuideContent.sources.map((source) => [source.id, source]));

    const currentBilingualDelegationUrl =
      'https://cfmws.ca/CFMWS/media/images/documents/8.0%20About%20Us/8.4%20Policies%20and%20Publications/8.4.5/Policies/DelegationofAuthorities_e-18Jun26.pdf';

    expect(sources.get('cds-npp-delegation')?.urls.en).toBe(currentBilingualDelegationUrl);
    expect(sources.get('cds-npp-delegation')?.urls.fr).toBe(currentBilingualDelegationUrl);
    expect(sources.get('npp-contracting-policy')?.urls.fr).toBe(
      'https://sbmfc.ca/a-propos/politiques-et-publications/approvisionnement-et-passation-de-marches/politique-de-passation-de-marches-des-biens-non-publics',
    );
    expect(sources.get('contract-for-services')?.urls.fr).toBe(
      'https://sbmfc.ca/a-propos/politiques-et-publications/approvisionnement-et-passation-de-marches/contrats-de-services',
    );
  });
});
