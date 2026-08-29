import { describe, expect, it } from 'vitest';

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

type IncrementalLocalizedText = { en: string; fr: string };

type IncrementalGrant = {
  entitlement?: {
    status?: string;
    amountOrFormula?: IncrementalLocalizedText;
    note?: IncrementalLocalizedText;
  };
  requirements?: IncrementalLocalizedText[];
};

const asIncrementalGrant = (grant: (typeof nppGuideContent.grants)[number]) =>
  grant as typeof grant & IncrementalGrant;

const expectedAlienationExamples = [
  {
    en: 'Gifts or donations to outside individuals or organizations.',
    fr: 'Dons ou donations à des personnes ou organisations externes.',
  },
  {
    en: 'Selling NPP below fair market value.',
    fr: 'Vendre des BNP sous la juste valeur marchande.',
  },
  {
    en: 'Using NPF for a government/public responsibility.',
    fr: 'Utiliser les FNP pour une responsabilité gouvernementale ou publique.',
  },
  {
    en: 'Providing a personal benefit to an individual or restricted group.',
    fr: 'Accorder un avantage personnel à une personne ou à un groupe restreint.',
  },
  {
    en: 'Transferring NPP to the Crown without appropriate value in return.',
    fr: 'Transférer des BNP à l’État sans valeur appropriée en retour.',
  },
] as const;

const expectedEntitlementStatuses = {
  'unit-internal-npp': 'current-or-local-rate-unavailable',
  'canex-sisip-dividend': 'published-formula',
  'reserve-pfmg': 'published-amount-or-ceiling',
  'reserve-organizational': 'published-amount-or-ceiling',
  'reserve-contingency': 'published-formula',
  'band-grant': 'published-amount-or-ceiling',
  'band-uniform': 'published-amount-or-ceiling',
  'kilted-order': 'published-amount-or-ceiling',
  'ceremonial-other': 'published-amount-or-ceiling',
} as const;

const expectedEntitlementAmounts: Record<
  string,
  { en: Array<string | RegExp>; fr: Array<string | RegExp> }
> = {
  'unit-internal-npp': {
    en: ['No universal public entitlement', 'local amount unavailable'],
    fr: ['aucun droit public universel', 'montant local n’est pas disponible'],
  },
  'canex-sisip-dividend': {
    en: ['0.6%', '15%', '33%', 'Equitability Adjustment Grant'],
    fr: [/0[.,]6\s?%/, /15\s?%/, /33\s?%/, 'ajustement d’équité'],
  },
  'reserve-pfmg': {
    en: ['$5.40', '$2.80', 'average monthly strength'],
    fr: [/\$\s?5[,.]40/, /\$\s?2[,.]80/, 'effectif mensuel moyen'],
  },
  'reserve-organizational': {
    en: ['$344', '$689', '$1,034', '$1,379', '201–200'],
    fr: ['$344', '$689', /\$\s?1[ ,.\u202f]034/, /\$\s?1[ ,.\u202f]379/, '201–200'],
  },
  'reserve-contingency': {
    en: ['$20', 'preceding-fiscal-year average monthly effective strength'],
    fr: ['$20', 'effectif mensuel moyen réel de l’exercice précédent'],
  },
  'band-grant': {
    en: ['$43', '$25', 'authorized member'],
    fr: ['$43', '$25', 'membre autorisé'],
  },
  'band-uniform': {
    en: ['$211', '$42', 'capped at authorized strength'],
    fr: ['$211', '$42', 'plafonné à l’effectif autorisé'],
  },
  'kilted-order': {
    en: ['60%', '$253', '$40', 'capped at authorized strength'],
    fr: [/60\s?%/, '$253', '$40', 'plafonné à l’effectif autorisé'],
  },
  'ceremonial-other': {
    en: ['$25', '$211', '$42', 'capped at authorized strength'],
    fr: ['$25', '$211', '$42', 'plafonné à l’effectif autorisé'],
  },
} as const;

const expectedRequirementSnippets = {
  'unit-internal-npp': {
    en: ['approved Unit Fund budget', 'local allocation'],
    fr: ['budget du Fonds de l’unité', 'allocation locale'],
  },
  'canex-sisip-dividend': {
    en: ['local allocation', 'Equitability Adjustment Grant'],
    fr: ['allocation locale', 'ajustement d’équité'],
  },
  'reserve-pfmg': {
    en: [
      'activity equipment',
      'operating equipment',
      'rentals, fees, memberships',
      'quarterly CF 52',
      'paid-invoice',
      'previous quarter in the same fiscal year',
      'entitlement unclaimed at fiscal year-end lapses',
      'change-of-status',
    ],
    fr: [
      'matériel d’activité',
      'matériel d’exploitation',
      'locations, frais, adhésions',
      'CF 52 trimestriel',
      'facture payée',
      'trimestre précédent du même exercice',
      'droit non réclamé à la fin de l’exercice devient périmé',
      'changement de statut',
    ],
  },
  'reserve-organizational': {
    en: ['eligibility events', 'CDS approval'],
    fr: ['événements d’admissibilité', 'approbation du CEMD'],
  },
  'reserve-contingency': {
    en: ['effective strength', 'deductions', 'unspent-balance reduction'],
    fr: ['effectif réel', 'déductions', 'réduction liée au solde non dépensé'],
  },
  'band-grant': {
    en: ['authorized band', 'public uses', 'CFAO 210-19'],
    fr: ['musique autorisée', 'usages publics', 'CFAO 210-19'],
  },
  'band-uniform': {
    en: ['ceremonial dress', 'public expense', 'CFAO 210-18'],
    fr: ['tenue cérémonielle', 'frais publics', 'CFAO 210-18'],
  },
  'kilted-order': {
    en: ['kilt, sporran, hose, and balmoral', 'CF 52', 'public-provision'],
    fr: ['kilt, sporran, bas et balmoral', 'CF 52', 'fourniture publique'],
  },
  'ceremonial-other': {
    en: ['Regular Force', 'not a 32 CBG entitlement', 'public-provision'],
    fr: ['Force régulière', 'ne constitue pas un droit du 32 GBC', 'fourniture publique'],
  },
} as const;

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

  it('preserves the general controls required for every NPF transaction in both languages', () => {
    const requiredEnglishControls = [
      'authorized beneficiaries',
      'correct NPP entity',
      'budget or grant/trust',
      'available and unencumbered funds',
      'current delegated authority',
    ];
    const requiredFrenchControls = [
      'bénéficiaires autorisés',
      'entité BNP appropriée',
      'budget, la subvention ou la fiducie',
      'fonds disponibles et non grevés',
      'pouvoir délégué actuel',
    ];

    for (const sectionId of ['before-spending', 'spending-npf']) {
      const englishCopy = sectionCopy(sectionId, 'en');
      const frenchCopy = sectionCopy(sectionId, 'fr');

      requiredEnglishControls.forEach((control) => expect(englishCopy).toContain(control));
      requiredFrenchControls.forEach((control) => expect(frenchCopy).toContain(control));
    }
  });

  it('scopes Unit Fund committee and minute controls to Unit Fund money in both languages', () => {
    const requiredEnglishControls = [
      'If the funding source is Unit Fund money',
      'approved annual Unit Fund capital or operating budget',
      'Unit Fund Committee approved the expense',
      'unit minute book or Record of Decision',
      'meeting minutes are approved by the responsible CO or designate',
      'current delegated NPP authorities govern commitment, contract, and payment',
    ];
    const requiredFrenchControls = [
      'Si la source de financement est le Fonds de l’unité',
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
      expect(englishCopy).toContain('These Unit Fund controls do not govern other NPP entities');
      expect(frenchCopy).toContain(
        'Ces contrôles du Fonds de l’unité ne régissent pas les autres entités BNP',
      );
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
      'cfmws-budgeting-faq': {
        en: 'https://cfmws.ca/about-us/policies-and-publications/frequently-asked-questions/budgeting',
        fr: 'https://sbmfc.ca/a-propos/politiques-et-publications/foire-aux-questions/budgetisation',
      },
      'psp-policy-manual-reserve-unit-funds': {
        en: 'https://cfmws.ca/CFMWS/media/images/documents/8.0%20About%20Us/Resources%20for%20Messes/English/PSP-Policy-Manual-EN-7-Nov-2022.pdf',
      },
      'alienation-request-sop': {
        en: 'https://cfmws.ca/CFMWS/media/images/documents/8.0%20About%20Us/8.4%20Policies%20and%20Publications/8.4.5/Policies/Alienation-Request-Form-SOP-with-maps-_e-Final.pdf',
      },
      'alienation-request-form': {
        en: 'https://cfmws.ca/CFMWS/media/images/documents/8.0%20About%20Us/8.4%20Policies%20and%20Publications/8.4.5/Policies/ALIENATION-OF-NPP-REQUEST-FORM-(Template-English).pdf',
      },
      'alienation-faq': {
        en: 'https://cfmws.ca/about-us/policies-and-publications/frequently-asked-questions/alienation-of-non-public-property-(npp)',
        fr: 'https://sbmfc.ca/a-propos/politiques-et-publications/foire-aux-questions/alienation-of-non-public-property-(npp)',
      },
    };

    Object.entries(requiredSources).forEach(([id, urls]) => {
      const source = sources.get(id);
      expect(source?.urls).toEqual(urls);
      expect(source?.checkedOn).toBe('2026-08-28');
      expectLocalized(source?.title as { en: string; fr: string });
      expectLocalized(source?.publisher as { en: string; fr: string });
    });
  });

  it('publishes five distinct bilingual alienation examples without treating them as exhaustive', () => {
    const alienation = getSection('alienation-of-funds') as
      | (ReturnType<typeof getSection> & { examples?: IncrementalLocalizedText[] })
      | undefined;

    expect(alienation?.examples).toBeDefined();
    if (!alienation?.examples) return;

    expect(alienation.examples).toHaveLength(5);
    expect(alienation.examples).toEqual(expectedAlienationExamples);
  });

  it('adds a bilingual entitlement and a concise requirements list to every grant', () => {
    nppGuideContent.grants.forEach((grant) => {
      const incremental = asIncrementalGrant(grant);

      expect(incremental.entitlement, `${grant.id} entitlement`).toBeDefined();
      expect(incremental.requirements, `${grant.id} requirements`).toBeDefined();

      if (!incremental.entitlement || !incremental.requirements) return;

      expect([
        'published-amount-or-ceiling',
        'published-formula',
        'current-or-local-rate-unavailable',
      ]).toContain(incremental.entitlement.status);
      expectLocalized(incremental.entitlement.amountOrFormula);
      expectLocalized(incremental.entitlement.note);
      expect(incremental.requirements.length).toBeGreaterThanOrEqual(3);
      expect(incremental.requirements.length).toBeLessThanOrEqual(5);
      incremental.requirements.forEach(expectLocalized);
    });
  });

  it('keeps the approved grant statuses, amounts, formulas, and unavailable-rate labels bilingual', () => {
    const unavailableLabelByLocale = {
      en: ['unavailable', 'not publicly available'],
      fr: ['indisponible', 'pas disponible publiquement'],
    } as const;

    for (const grant of nppGuideContent.grants) {
      const incremental = asIncrementalGrant(grant);
      const expectedStatus =
        expectedEntitlementStatuses[grant.id as keyof typeof expectedEntitlementStatuses];

      expect(incremental.entitlement, `${grant.id} entitlement`).toBeDefined();
      expect(incremental.entitlement?.status).toBe(expectedStatus);

      if (!incremental.entitlement?.amountOrFormula || !incremental.entitlement.note) continue;

      for (const locale of ['en', 'fr'] as const) {
        const amountOrFormula = incremental.entitlement.amountOrFormula[locale];
        const note = incremental.entitlement.note[locale];
        const amountCopy = amountOrFormula.toLocaleLowerCase(locale === 'fr' ? 'fr-CA' : 'en-CA');
        const entitlementCopy = `${amountOrFormula} ${note}`.toLocaleLowerCase(
          locale === 'fr' ? 'fr-CA' : 'en-CA',
        );

        for (const fragment of expectedEntitlementAmounts[grant.id][locale]) {
          if (fragment instanceof RegExp) {
            expect(amountCopy).toMatch(fragment);
          } else {
            expect(amountCopy).toContain(fragment.toLocaleLowerCase(locale));
          }
        }

        if (incremental.entitlement.status === 'current-or-local-rate-unavailable') {
          expect(
            unavailableLabelByLocale[locale].some((label) => entitlementCopy.includes(label)),
          ).toBe(true);
        }
      }
    }
  });

  it('covers each approved grant requirement family in both languages', () => {
    for (const [grantId, snippets] of Object.entries(expectedRequirementSnippets)) {
      const grant = nppGuideContent.grants.find((candidate) => candidate.id === grantId);
      const requirements = grant ? asIncrementalGrant(grant).requirements : undefined;

      expect(requirements, `${grantId} requirements`).toBeDefined();
      if (!requirements) continue;

      for (const locale of ['en', 'fr'] as const) {
        const copy = requirements
          .map((requirement) => requirement[locale])
          .join(' ')
          .toLocaleLowerCase(locale === 'fr' ? 'fr-CA' : 'en-CA');

        for (const snippet of snippets[locale]) {
          expect(copy).toContain(snippet.toLocaleLowerCase(locale));
        }
      }
    }
  });

  it('points Reserve PFMG readers to the operational Chapter 10-6 source', () => {
    const pfmg = nppGuideContent.grants.find((grant) => grant.id === 'reserve-pfmg');

    expect(pfmg?.sourceIds).toContain('psp-policy-manual-pfmg');
    expect(
      nppGuideContent.sources.find((source) => source.id === 'psp-policy-manual-pfmg'),
    ).toEqual(
      expect.objectContaining({
        title: expect.objectContaining({
          en: expect.stringContaining('Chapter 10-6'),
          fr: expect.stringContaining('chapitre 10-6'),
        }),
      }),
    );
  });
});
