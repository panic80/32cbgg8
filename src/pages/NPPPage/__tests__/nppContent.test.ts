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

const getSection = (id: string) => nppGuideContent.sections.find((section) => section.id === id);

const sectionCopy = (id: string, locale: 'en' | 'fr') => {
  const section = getSection(id);

  return [...(section?.paragraphs ?? []), ...(section?.bullets ?? []), ...(section?.warnings ?? [])]
    .map((entry) => entry[locale])
    .join(' ');
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

  it('records the required Unit Fund spending controls in both languages', () => {
    const requiredEnglishControls = [
      'collective authorized NPP benefit',
      'approved annual Unit Fund capital or operating budget',
      'Unit Fund Committee approved the expense',
      'unit minute book or Record of Decision',
      'meeting minutes are approved by the responsible CO or designate',
      'current delegated NPP authorities govern commitment, contract, and payment',
    ];
    const requiredFrenchControls = [
      'avantage collectif autorisé des BNP',
      'budget annuel approuvé de fonctionnement ou d’immobilisations du Fonds de l’unité',
      'comité du Fonds de l’unité a approuvé la dépense',
      'registre des procès-verbaux ou relevé de décision',
      'procès-verbaux de la réunion sont approuvés par le cmdt responsable ou son délégué',
      'pouvoirs délégués actuels en matière de BNP régissent l’engagement, le contrat et le paiement',
    ];

    for (const sectionId of ['before-spending', 'spending-npf']) {
      const englishCopy = sectionCopy(sectionId, 'en');
      const frenchCopy = sectionCopy(sectionId, 'fr');

      requiredEnglishControls.forEach((control) => expect(englishCopy).toContain(control));
      requiredFrenchControls.forEach((control) => expect(frenchCopy).toContain(control));
    }
  });

  it('separates ordered workflows from explanatory bullet lists', () => {
    const presentation = (id: string) =>
      (getSection(id) as { listPresentation?: string } | undefined)?.listPresentation;

    expect(presentation('npp-and-npf')).toBe('bullets');
    expect(presentation('before-spending')).toBe('bullets');
    expect(presentation('spending-npf')).toBe('steps');
    expect(presentation('existing-vendor')).toBe('steps');
    expect(presentation('alienation-of-funds')).toBe('steps');
  });

  it('provides a source-traceable, bilingual alienation route without treating it as ordinary purchasing', () => {
    const sectionIds = nppGuideContent.sections.map((section) => section.id);
    expect(sectionIds).toEqual(
      expect.arrayContaining(['spending-npf', 'alienation-of-funds', 'grants']),
    );
    expect(sectionIds.indexOf('alienation-of-funds')).toBe(sectionIds.indexOf('spending-npf') + 1);

    const alienation = getSection('alienation-of-funds');
    const englishCopy = sectionCopy('alienation-of-funds', 'en');
    const frenchCopy = sectionCopy('alienation-of-funds', 'fr');

    expect(alienation?.sourceIds).toEqual(
      expect.arrayContaining([
        'cds-npp-delegation',
        'alienation-request-sop',
        'alienation-request-form',
        'alienation-faq',
      ]),
    );
    [
      'not routine purchasing',
      'transfer of ownership or value',
      'no longer NPP',
      'below-market sale',
      'gift or donation',
      'personal or restricted-group benefit',
      'public responsibility',
      'subsidy or value to a non-NPP beneficiary',
      'stop and seek NPP finance/PSP advice before committing',
      'confirm the public routing with the supporting NPP team',
      'Draft v2.0',
    ].forEach((requirement) => expect(englishCopy).toContain(requirement));
    [
      'pas un achat courant',
      'transfert de propriété ou de valeur',
      'n’est plus un BNP',
      'vente sous la juste valeur marchande',
      'don',
      'avantage personnel ou à un groupe restreint',
      'responsabilité publique',
      'subvention ou valeur à un bénéficiaire non admissible aux BNP',
      'arrêtez le processus et demandez conseil à l’équipe des finances BNP/PSP avant tout engagement',
      'confirmez le cheminement public auprès de l’équipe de soutien des BNP',
      'ébauche v2.0',
    ].forEach((requirement) => expect(frenchCopy).toContain(requirement));
  });

  it('registers the current official sources needed for Unit Fund budgeting and alienation', () => {
    const sources = new Map(nppGuideContent.sources.map((source) => [source.id, source]));
    const requiredSources = {
      'cfmws-budgeting-faq':
        'https://cfmws.ca/about-us/policies-and-publications/frequently-asked-questions/budgeting',
      'psp-policy-manual-reserve-unit-funds':
        'https://cfmws.ca/CFMWS/media/images/documents/8.0%20About%20Us/Resources%20for%20Messes/English/PSP-Policy-Manual-EN-7-Nov-2022.pdf',
      'alienation-request-sop':
        'https://cfmws.ca/CFMWS/media/images/documents/8.0%20About%20Us/8.4%20Policies%20and%20Publications/8.4.5/Policies/Alienation-Request-Form-SOP-with-maps-_e-Final.pdf',
      'alienation-request-form':
        'https://cfmws.ca/CFMWS/media/images/documents/8.0%20About%20Us/8.4%20Policies%20and%20Publications/8.4.5/Policies/ALIENATION-OF-NPP-REQUEST-FORM-(Template-English).pdf',
      'alienation-faq':
        'https://cfmws.ca/about-us/policies-and-publications/frequently-asked-questions/alienation-of-non-public-property-(npp)',
    };

    Object.entries(requiredSources).forEach(([id, url]) => {
      const source = sources.get(id);
      expect(source?.urls.en).toBe(url);
      expect(source?.urls.fr).toBeUndefined();
      expect(source?.checkedOn).toBe('2026-08-28');
      expectLocalized(source?.title as { en: string; fr: string });
      expectLocalized(source?.publisher as { en: string; fr: string });
    });
  });
});
