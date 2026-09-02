import type { LocalizedText, NppGuideContent } from './types';

const checkedOn = '2026-08-28';

const localDocumentation: LocalizedText = {
  en: 'Local 32 CBG documentation is not available on this public page. Obtain the current local form and submission route from the supporting NPP office.',
  fr: 'La documentation locale du 32 GBC n’est pas accessible sur cette page publique. Obtenez le formulaire local actuel et la voie de présentation auprès du bureau de soutien des BNP.',
};

const currentGrantInstructions: LocalizedText = {
  en: 'Confirm the current grant-specific instruction, eligibility, and request or claim timing before proceeding.',
  fr: 'Confirmez les directives propres à la subvention, l’admissibilité et le calendrier de demande ou de réclamation avant de procéder.',
};

const grantEvidence: LocalizedText[] = [
  {
    en: 'Keep the approved purpose, authorization, invoices or receipts, proof of payment when required, and acceptance evidence required by the current grant instruction.',
    fr: 'Conservez la preuve de l’objet approuvé, l’autorisation, les factures ou reçus, la preuve de paiement lorsque requise et la preuve d’acceptation exigées par les directives actuelles de la subvention.',
  },
];

const grantClaimOwner: LocalizedText = {
  en: 'The authorized organization representative identified by the current grant instruction and supporting NPP office.',
  fr: 'Le représentant autorisé de l’organisation désigné par les directives actuelles de la subvention et le bureau de soutien des BNP.',
};

const grantApprovalAndSubmission: LocalizedText = {
  en: 'Use the current official grant instruction and the local form and route supplied by the supporting NPP office; no local form, deadline, coding string, email address, or approval chain is published here.',
  fr: 'Utilisez les directives officielles actuelles de la subvention ainsi que le formulaire et la voie locale fournis par le bureau de soutien des BNP; aucun formulaire local, délai, code, courriel ou circuit d’approbation n’est publié ici.',
};

const grantAccountTreatment: LocalizedText = {
  en: 'Confirm the correct NPP budget, grant, or trust-account treatment with the supporting NPP office before recording or spending funds.',
  fr: 'Confirmez le traitement approprié dans le budget BNP, la subvention ou le compte fiduciaire auprès du bureau de soutien des BNP avant d’inscrire ou de dépenser des fonds.',
};

const grantUnspentBalanceRule: LocalizedText = {
  en: 'Follow the current grant-specific rule for unspent balances. Do not repurpose, transfer, or retain a balance without confirmation from the supporting NPP office.',
  fr: 'Suivez la règle actuelle propre à la subvention pour les soldes non dépensés. Ne réaffectez, ne transférez ni ne conservez un solde sans confirmation du bureau de soutien des BNP.',
};

const publicGrantEvidence: LocalizedText[] = [
  {
    en: 'Keep the approved authorization, CF 52 where the grant instruction requires it, approved paid invoices or receipts, proof of payment, and supporting eligibility and acceptance evidence.',
    fr: 'Conservez l’autorisation approuvée, le CF 52 lorsque les directives de la subvention l’exigent, les factures payées ou reçus approuvés, la preuve de paiement et les preuves d’admissibilité et d’acceptation.',
  },
];

const publicGrantApprovalAndSubmission: LocalizedText = {
  en: 'At the beginning of the public fiscal year, the Unit Admin O prepares the required claim or documentation and passes it to the NPPAM. The NPPAM verifies it and forwards claims to the Public Funds Accounting Officer for processing and cheque issue; use the current grant-specific route for anything additional.',
  fr: 'Au début de l’exercice financier public, l’Admin O de l’unité prépare la demande ou les documents requis et les transmet au gestionnaire de la comptabilité des BNP (GC BNP). Le GC BNP les vérifie et transmet les demandes à l’Officier comptable des fonds publics pour le traitement et l’émission du chèque; utilisez la voie actuelle propre à la subvention pour toute exigence additionnelle.',
};

const publicGrantAccountTreatment: LocalizedText = {
  en: 'Maintain a separate Unit Fund trust account for each public grant; maintain separate accounts when an initial and an annual maintenance grant are both received. Charge eligible expenditures directly to that trust and do not exceed its unexpended balance; the NPPAM ensures invoices are approved.',
  fr: 'Tenez un compte fiduciaire distinct du Fonds de l’unité pour chaque subvention publique; tenez des comptes distincts lorsqu’une subvention initiale et une subvention annuelle d’entretien sont toutes deux reçues. Imputez directement les dépenses admissibles à cette fiducie et ne dépassez pas son solde non dépensé; le GC BNP veille à l’approbation des factures.',
};

const publicGrantUnspentBalanceRule: LocalizedText = {
  en: 'The annual grant is generally reduced by the prior year-end unexpended trust balance. After a change of status, refund any unexpended grant balance to the Receiver General for Canada through CFCF as directed.',
  fr: 'La subvention annuelle est généralement réduite du solde non dépensé de la fiducie à la fin de l’exercice précédent. Après un changement de statut, remboursez tout solde de subvention non dépensé au receveur général du Canada par l’intermédiaire du FCFC selon les directives.',
};

export const nppGuideContent: NppGuideContent = {
  title: { en: 'NPP / NPF Guide', fr: 'Guide des BNP / FNP' },
  description: {
    en: 'Guidance for 32 CBG members on Non-Public Property and Non-Public Funds.',
    fr: 'Guide à l’intention des membres du 32 GBC sur les biens non publics et les fonds non publics.',
  },
  disclaimer: {
    en: 'This page is a plain-language aid, not financial authority or approval. Current legislation, CDS delegations, CFMWS policy, grant-specific instructions, and local NPP Accounting direction prevail.',
    fr: 'Cette page est un outil en langage clair; elle ne constitue ni une autorité financière ni une approbation. Les lois en vigueur, les délégations du CEMD, les politiques des SBMFC, les directives propres aux subventions et les directives comptables locales des BNP ont préséance.',
  },
  officialSourcesCheckedLabel: {
    en: 'Official sources checked',
    fr: 'Sources officielles vérifiées',
  },
  officialSourcesCheckedOn: checkedOn,
  sections: [
    {
      id: 'npp-and-npf',
      heading: {
        en: 'What NPP and NPF are—and are not',
        fr: 'Ce que sont les BNP et les FNP — et ce qu’ils ne sont pas',
      },
      audience: 'all-members',
      paragraphs: [
        {
          en: 'Non-Public Property (NPP) is a distinct class of Crown property established under the National Defence Act. Non-Public Funds (NPF) are only the money component of NPP; NPF is not an organization or legal entity.',
          fr: 'Les biens non publics (BNP) constituent une catégorie distincte de biens de l’État établie en vertu de la Loi sur la défense nationale. Les fonds non publics (FNP) ne sont que la composante monétaire des BNP; les FNP ne sont ni une organisation ni une entité juridique.',
        },
        {
          en: 'NPP primarily supports authorized CAF beneficiaries collectively. Money received for a stated purpose must remain dedicated to that purpose.',
          fr: 'Les BNP servent principalement l’intérêt collectif des bénéficiaires autorisés des FAC. Les fonds reçus pour un objet déterminé doivent demeurer affectés à cet objet.',
        },
      ],
      bullets: [
        {
          en: 'Public-fund and NPP authorities are separate and are not interchangeable.',
          fr: 'Les pouvoirs liés aux fonds publics et aux BNP sont distincts et ne sont pas interchangeables.',
        },
        {
          en: 'Confirm whether a requirement is NPP, public, or mixed-funded before action is taken.',
          fr: 'Confirmez si le besoin relève des BNP, des fonds publics ou d’un financement mixte avant d’agir.',
        },
      ],
      listPresentation: 'bullets',
      warnings: [
        {
          en: 'NPF is not a discretionary slush fund, personal benefit, gift fund, or automatic substitute for a public responsibility.',
          fr: 'Les FNP ne sont pas une caisse discrétionnaire, un avantage personnel, un fonds de cadeaux ni un substitut automatique à une responsabilité publique.',
        },
      ],
      sourceIds: ['national-defence-act', 'daod-9003-1', 'cds-npp-delegation'],
    },
    {
      id: 'before-spending',
      trackable: true,
      heading: { en: 'Before spending', fr: 'Avant de dépenser' },
      audience: 'all-members',
      paragraphs: [
        {
          en: 'Before committing any NPF, complete the general controls below. They apply to every NPF transaction and do not replace the current CFMWS, CDS, or supporting NPP finance direction that applies to the transaction.',
          fr: 'Avant d’engager des FNP, appliquez les contrôles généraux ci-dessous. Ils s’appliquent à chaque opération de FNP et ne remplacent pas les directives actuelles des SBMFC, du CEMD ou de l’équipe de soutien des finances BNP applicables à l’opération.',
        },
        {
          en: 'If the funding source is Unit Fund money, also confirm the expense is within the approved annual Unit Fund capital or operating budget; the Unit Fund Committee approved the expense and recorded its decision in the unit minute book or Record of Decision; the meeting minutes are approved by the responsible CO or designate; and current delegated NPP authorities govern commitment, contract, and payment. These Unit Fund controls do not govern other NPP entities.',
          fr: 'Si la source de financement est le Fonds de l’unité, confirmez aussi que la dépense figure dans le budget annuel approuvé de fonctionnement ou d’immobilisations du Fonds de l’unité; que le comité du Fonds de l’unité a approuvé la dépense et consigné sa décision dans le registre des procès-verbaux ou relevé de décision de l’unité; que les procès-verbaux de la réunion sont approuvés par le cmdt responsable ou son délégué; et que les pouvoirs délégués actuels en matière de BNP régissent l’engagement, le contrat et le paiement. Ces contrôles du Fonds de l’unité ne régissent pas les autres entités BNP.',
        },
      ],
      bullets: [
        {
          en: 'Confirm the activity provides a collective authorized NPP benefit to authorized beneficiaries.',
          fr: 'Confirmez que l’activité procure un avantage collectif autorisé des BNP aux bénéficiaires autorisés.',
        },
        {
          en: 'Confirm the correct NPP entity.',
          fr: 'Confirmez l’entité BNP appropriée.',
        },
        {
          en: 'Confirm the correct budget or grant/trust.',
          fr: 'Confirmez le budget, la subvention ou la fiducie appropriés.',
        },
        {
          en: 'Confirm available and unencumbered funds.',
          fr: 'Confirmez les fonds disponibles et non grevés.',
        },
        {
          en: 'Confirm the current delegated authority.',
          fr: 'Confirmez le pouvoir délégué actuel.',
        },
        {
          en: 'Identify hospitality, alcohol, travel, IM/IT, fixed assets, fundraising, gifts or alienation, and mixed funding for policy-specific review.',
          fr: 'Soumettez l’accueil, l’alcool, les déplacements, la GI/TI, les immobilisations, les collectes de fonds, les cadeaux ou l’aliénation et le financement mixte à l’examen requis par la politique pertinente.',
        },
      ],
      listPresentation: 'bullets',
      warnings: [
        {
          en: 'Do not self-approve, split transactions, create a personal benefit, bypass a conflict of interest, or make an unauthorized commitment.',
          fr: 'N’approuvez pas vos propres dépenses, ne fractionnez pas les opérations, ne créez pas d’avantage personnel, ne contournez pas un conflit d’intérêts et ne prenez pas d’engagement non autorisé.',
        },
      ],
      sourceIds: [
        'cfmws-budgeting-faq',
        'psp-policy-manual-reserve-unit-funds',
        'cds-npp-delegation',
        'npp-contracting-policy',
      ],
    },
    {
      id: 'spending-npf',
      trackable: true,
      heading: { en: 'How to spend NPF', fr: 'Comment dépenser les FNP' },
      audience: 'operators',
      paragraphs: [
        {
          en: 'Use the current official procurement and contracting direction for every purchase. The sequence below is a practical guide, not a delegation or approval. Complete the general NPF controls before moving to procurement.',
          fr: 'Utilisez les directives officielles actuelles sur l’approvisionnement et la passation de marchés pour chaque achat. La séquence ci-dessous est un guide pratique et ne constitue ni une délégation ni une approbation. Appliquez les contrôles généraux des FNP avant de passer à l’approvisionnement.',
        },
        {
          en: 'If the funding source is Unit Fund money, also confirm the expense is within the approved annual Unit Fund capital or operating budget; the Unit Fund Committee approved the expense and recorded its decision in the unit minute book or Record of Decision; the meeting minutes are approved by the responsible CO or designate; and current delegated NPP authorities govern commitment, contract, and payment. These Unit Fund controls do not govern other NPP entities.',
          fr: 'Si la source de financement est le Fonds de l’unité, confirmez aussi que la dépense figure dans le budget annuel approuvé de fonctionnement ou d’immobilisations du Fonds de l’unité; que le comité du Fonds de l’unité a approuvé la dépense et consigné sa décision dans le registre des procès-verbaux ou relevé de décision de l’unité; que les procès-verbaux de la réunion sont approuvés par le cmdt responsable ou son délégué; et que les pouvoirs délégués actuels en matière de BNP régissent l’engagement, le contrat et le paiement. Ces contrôles du Fonds de l’unité ne régissent pas les autres entités BNP.',
        },
      ],
      bullets: [
        {
          en: 'Confirm the activity provides a collective authorized NPP benefit to authorized beneficiaries.',
          fr: 'Confirmez que l’activité procure un avantage collectif autorisé des BNP aux bénéficiaires autorisés.',
        },
        {
          en: 'Confirm the correct NPP entity.',
          fr: 'Confirmez l’entité BNP appropriée.',
        },
        {
          en: 'Confirm the correct budget or grant/trust.',
          fr: 'Confirmez le budget, la subvention ou la fiducie appropriés.',
        },
        {
          en: 'Confirm available and unencumbered funds.',
          fr: 'Confirmez les fonds disponibles et non grevés.',
        },
        {
          en: 'Confirm the current delegated authority.',
          fr: 'Confirmez le pouvoir délégué actuel.',
        },
        {
          en: 'Confirm the requirement and funding source.',
          fr: 'Confirmez le besoin et la source de financement.',
        },
        { en: 'Obtain advance approval.', fr: 'Obtenez l’approbation préalable.' },
        {
          en: 'Follow the current procurement or quote rule through the live official source.',
          fr: 'Suivez la règle actuelle d’approvisionnement ou de soumissions au moyen de la source officielle en direct.',
        },
        {
          en: 'Execute any required contract before work starts.',
          fr: 'Signez tout contrat requis avant le début des travaux.',
        },
        {
          en: 'Use the NPP corporate credit card when feasible.',
          fr: 'Utilisez la carte de crédit d’entreprise des BNP lorsque cela est réalisable.',
        },
        { en: 'Confirm delivery and acceptance.', fr: 'Confirmez la livraison et l’acceptation.' },
        {
          en: 'Match the invoice with the approval, contract or purchase record, and delivered goods or services.',
          fr: 'Rapprochez la facture de l’approbation, du contrat ou du dossier d’achat et des biens ou services livrés.',
        },
        {
          en: 'Obtain independent payment approval and submit the complete package through the approved NPP Accounting channel.',
          fr: 'Obtenez une approbation de paiement indépendante et soumettez le dossier complet par la voie comptable approuvée des BNP.',
        },
      ],
      listPresentation: 'steps',
      warnings: [
        {
          en: 'Current rules and delegated authorities prevail; use the live official source rather than a remembered threshold.',
          fr: 'Les règles et les pouvoirs délégués en vigueur ont préséance; utilisez la source officielle en direct plutôt qu’un seuil mémorisé.',
        },
      ],
      sourceIds: [
        'cfmws-budgeting-faq',
        'psp-policy-manual-reserve-unit-funds',
        'cds-npp-delegation',
        'npp-contracting-policy',
        'contract-for-services',
        'afn105-accounts-payable',
        'afn105-credit-cards',
      ],
    },
    {
      id: 'alienation-of-funds',
      trackable: true,
      heading: {
        en: 'Alienation of NPP: a separate approval path',
        fr: 'Aliénation des BNP : une voie d’approbation distincte',
      },
      audience: 'operators',
      paragraphs: [
        {
          en: 'Alienation is not routine purchasing. It is a transfer of ownership or value from NPP to another party so the property is no longer NPP.',
          fr: 'L’aliénation n’est pas un achat courant. Il s’agit du transfert de propriété ou de valeur de BNP à une autre partie, de sorte que le bien n’est plus un BNP.',
        },
      ],
      bullets: [
        {
          en: 'Pause when a proposal involves a below-market sale, gift or donation, personal or restricted-group benefit, public responsibility, or subsidy or value to a non-NPP beneficiary.',
          fr: 'Faites une pause lorsqu’une proposition comporte une vente sous la juste valeur marchande, un don, un avantage personnel ou à un groupe restreint, une responsabilité publique, ou une subvention ou valeur à un bénéficiaire non admissible aux BNP.',
        },
        {
          en: 'Do not use the normal purchasing approval: stop and seek NPP finance/PSP advice before committing.',
          fr: 'N’utilisez pas le processus d’approbation des achats ordinaires : arrêtez le processus et demandez conseil à l’équipe des finances BNP/PSP avant tout engagement.',
        },
        {
          en: 'Use the current Alienation of NPP Request Form to document the proposed purpose, cost, and supporting facts. The publicly posted Reserve SOP describes a route through the Entity Manager, Reserve PSP Advisor, Senior Manager, Reserves Accounting Services, Unit CO, CFO, and MD NPP.',
          fr: 'Utilisez le formulaire actuel de demande d’aliénation des BNP pour consigner l’objet proposé, le coût et les faits justificatifs. La SOP publique de la Réserve décrit un cheminement passant par le gestionnaire de l’entité, le conseiller PSP Réserve, le gestionnaire supérieur des Services comptables de la Réserve, le cmdt de l’unité, le CSF et le DG BNP.',
        },
        {
          en: 'The publicly posted SOP is marked Draft v2.0; confirm the public routing with the supporting NPP team before submitting.',
          fr: 'La SOP publiée est marquée ébauche v2.0; confirmez le cheminement public auprès de l’équipe de soutien des BNP avant de présenter une demande.',
        },
      ],
      listPresentation: 'steps',
      warnings: [
        {
          en: 'A committee decision, budget line, or ordinary payment process does not replace the separate authority required for an alienation request.',
          fr: 'Une décision de comité, une ligne budgétaire ou le processus de paiement ordinaire ne remplace pas le pouvoir distinct requis pour une demande d’aliénation.',
        },
      ],
      examples: [
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
      ],
      sourceIds: [
        'cds-npp-delegation',
        'alienation-request-sop',
        'alienation-request-form',
        'alienation-faq',
      ],
    },
    {
      id: 'grants',
      heading: { en: 'Grant explorer', fr: 'Répertoire des subventions' },
      audience: 'operators',
      paragraphs: [
        {
          en: 'NPP funding is distinct from public grants that are accounted for through NPP. The entries below identify the funding category and the information that must be confirmed before a request or claim.',
          fr: 'Le financement BNP est distinct des subventions publiques comptabilisées par l’entremise des BNP. Les entrées ci-dessous indiquent la catégorie de financement et les renseignements à confirmer avant une demande ou une réclamation.',
        },
      ],
      bullets: [localDocumentation, currentGrantInstructions],
      listPresentation: 'bullets',
      warnings: [
        {
          en: 'Do not assume eligibility, a deadline, a trust-account treatment, or an unspent-balance rule from a prior grant cycle.',
          fr: 'Ne présumez pas de l’admissibilité, d’une échéance, du traitement d’un compte fiduciaire ou d’une règle concernant les soldes non dépensés d’après un cycle de subvention antérieur.',
        },
      ],
      sourceIds: ['afn105-grants', 'cds-npp-delegation'],
    },
    {
      id: 'existing-vendor',
      trackable: true,
      heading: { en: 'Pay an existing vendor', fr: 'Payer un fournisseur existant' },
      audience: 'operators',
      paragraphs: [
        {
          en: 'Use the approved NPP Accounting route only after the requirement is approved and funding is available.',
          fr: 'Utilisez la voie comptable approuvée des BNP seulement après l’approbation du besoin et la confirmation des fonds disponibles.',
        },
      ],
      bullets: [
        {
          en: 'Retain the procurement or quote record and any required contract or purchase document.',
          fr: 'Conservez le dossier d’approvisionnement ou de soumissions ainsi que tout contrat ou document d’achat requis.',
        },
        {
          en: 'Provide a complete itemized invoice and receipt and acceptance confirmation.',
          fr: 'Fournissez une facture détaillée complète ainsi que la confirmation de réception et d’acceptation.',
        },
        {
          en: 'Identify the correct NPP entity, grant or trust, and accounting allocation.',
          fr: 'Identifiez l’entité BNP, la subvention ou la fiducie et l’imputation comptable appropriées.',
        },
        {
          en: 'Obtain independent payment approval and use the existing supplier record for secure NPP Accounting submission.',
          fr: 'Obtenez une approbation de paiement indépendante et utilisez le dossier fournisseur existant pour une présentation sécurisée à la comptabilité des BNP.',
        },
        {
          en: 'For an internal NPP-to-NPP payment, confirm whether a transfer is required instead of an ordinary vendor payment.',
          fr: 'Pour un paiement interne entre entités BNP, confirmez si un transfert est requis plutôt qu’un paiement fournisseur ordinaire.',
        },
      ],
      listPresentation: 'steps',
      warnings: [
        {
          en: 'Do not send invoice or supplier information through an unapproved channel.',
          fr: 'N’envoyez pas de renseignements sur la facture ou le fournisseur par une voie non approuvée.',
        },
      ],
      sourceIds: ['afn105-accounts-payable', 'npp-contracting-policy'],
    },
    {
      id: 'create-vendor',
      heading: { en: 'Create a vendor', fr: 'Créer un fournisseur' },
      audience: 'operators',
      paragraphs: [
        {
          en: 'Supplier creation is needed when there is no suitable existing supplier record. The supporting NPP office will identify the current setup package and secure submission route.',
          fr: 'La création d’un fournisseur est nécessaire lorsqu’il n’existe aucun dossier fournisseur approprié. Le bureau de soutien des BNP indiquera le dossier de création actuel et la voie de présentation sécurisée.',
        },
        {
          en: 'This site does not collect supplier or payment information.',
          fr: 'Ce site ne recueille aucun renseignement sur les fournisseurs ni sur les paiements.',
        },
      ],
      bullets: [
        {
          en: 'Typical setup categories include legal name, contact and address, supplier classification, terms and currency, applicable tax identifiers, payment method, EFT or banking documents, invoice, and contract.',
          fr: 'Les catégories habituellement demandées comprennent la dénomination sociale, les coordonnées et l’adresse, la catégorie de fournisseur, les modalités et la devise, les identifiants fiscaux applicables, le mode de paiement, les documents de TEF ou bancaires, la facture et le contrat.',
        },
        {
          en: 'Completed supplier and EFT documents may contain protected financial or tax information and must use the approved secure channel.',
          fr: 'Les documents remplis relatifs au fournisseur et au TEF peuvent contenir des renseignements financiers ou fiscaux protégés et doivent être transmis par la voie sécurisée approuvée.',
        },
      ],
      listPresentation: 'bullets',
      warnings: [
        {
          en: 'Do not enter tax identifiers, banking details, or supplier records on this public guide.',
          fr: 'N’inscrivez aucun identifiant fiscal, renseignement bancaire ou dossier fournisseur dans ce guide public.',
        },
      ],
      sourceIds: ['afn105-accounts-payable'],
    },
    {
      id: 'pay-individual',
      trackable: true,
      heading: { en: 'Pay an individual', fr: 'Payer une personne' },
      audience: 'operators',
      paragraphs: [
        {
          en: 'Start with the routing question: did the individual purchase something from a third party, or did the individual personally provide goods or services?',
          fr: 'Commencez par la question d’acheminement : la personne a-t-elle acheté quelque chose auprès d’un tiers ou a-t-elle elle-même fourni des biens ou des services?',
        },
      ],
      bullets: [
        {
          en: 'For a contractor, confirm a genuine independent business relationship. Stop and escalate an uncertain worker classification, complete the service contract before work, retain approval and procurement evidence, and route tax and banking data securely.',
          fr: 'Pour un entrepreneur, confirmez l’existence d’une véritable relation d’affaires indépendante. Arrêtez le processus et soumettez à l’échelon supérieur toute classification de travailleur incertaine, concluez le contrat de services avant les travaux, conservez les preuves d’approbation et d’approvisionnement, et acheminez les données fiscales et bancaires de façon sécurisée.',
        },
        {
          en: 'Honoraria are not a substitute for ordinary compensation.',
          fr: 'Les honoraires ne remplacent pas une rémunération ordinaire.',
        },
        {
          en: 'For a reimbursement, limit the claim to a pre-authorized third-party purchase, identify the NPP purpose and funding source, retain source documents and acceptance, and obtain independent approval.',
          fr: 'Pour un remboursement, limitez la réclamation à un achat auprès d’un tiers préautorisé, identifiez l’objet BNP et la source de financement, conservez les pièces justificatives et la preuve d’acceptation, et obtenez une approbation indépendante.',
        },
      ],
      listPresentation: 'bullets',
      warnings: [
        {
          en: 'Do not use a reimbursement path to pay for services personally provided by an individual.',
          fr: 'N’utilisez pas la voie du remboursement pour payer des services fournis personnellement par une personne.',
        },
      ],
      sourceIds: [
        'contract-for-services',
        'afn105-non-employer-payments',
        'npp-contracting-policy',
      ],
    },
    {
      id: 'reimbursement-checklist',
      heading: { en: 'Reimbursement checklist', fr: 'Liste de contrôle pour le remboursement' },
      audience: 'all-members',
      paragraphs: [
        {
          en: 'Use this anonymous checklist to prepare a reimbursement package. Completion is not approval, proof of submission, or a guarantee of reimbursement.',
          fr: 'Utilisez cette liste de contrôle anonyme pour préparer un dossier de remboursement. Son achèvement ne constitue ni une approbation, ni une preuve de présentation, ni une garantie de remboursement.',
        },
      ],
      bullets: [localDocumentation],
      listPresentation: 'bullets',
      warnings: [
        {
          en: 'Checklist state is not retained when the page is refreshed or closed.',
          fr: 'L’état de la liste de contrôle n’est pas conservé lorsque la page est actualisée ou fermée.',
        },
      ],
      sourceIds: ['afn105-accounts-payable', 'afn105-non-employer-payments'],
    },
    {
      id: 'sources-help',
      heading: { en: 'Sources and help', fr: 'Sources et aide' },
      audience: 'all-members',
      paragraphs: [
        {
          en: 'Use the official sources below for current direction. Local 32 CBG forms and routing will be added only after approved documents are supplied.',
          fr: 'Utilisez les sources officielles ci-dessous pour obtenir les directives en vigueur. Les formulaires et les voies d’acheminement locaux du 32 GBC seront ajoutés seulement après la fourniture de documents approuvés.',
        },
        {
          en: 'Report a broken link through the site’s existing public contact mechanism.',
          fr: 'Signalez un lien brisé au moyen du mécanisme de contact public existant du site.',
        },
      ],
      bullets: [
        {
          en: 'Some sources are available only in English; their language availability is shown accurately in the source list.',
          fr: 'Certaines sources sont offertes seulement en anglais; leur disponibilité linguistique est indiquée avec exactitude dans la liste des sources.',
        },
      ],
      listPresentation: 'bullets',
      warnings: [
        {
          en: 'When sources conflict or a value is uncertain, obtain current confirmation rather than relying on this guide.',
          fr: 'Lorsque les sources sont contradictoires ou qu’une valeur est incertaine, obtenez une confirmation à jour plutôt que de vous fier à ce guide.',
        },
      ],
      sourceIds: [
        'national-defence-act',
        'daod-9003-1',
        'cds-npp-delegation',
        'npp-contracting-policy',
      ],
    },
  ],
  grants: [
    {
      id: 'unit-internal-npp',
      name: { en: 'Unit internal NPP funding', fr: 'Financement interne BNP de l’unité' },
      fundingSource: 'npp',
      eligibleApplicant: {
        en: 'The unit or an authorized NPP activity, as confirmed by the supporting NPP office.',
        fr: 'L’unité ou une activité BNP autorisée, selon la confirmation du bureau de soutien des BNP.',
      },
      purpose: {
        en: 'An approved collective morale and welfare purpose within the authorized NPP activity.',
        fr: 'Un objet collectif approuvé de bien-être et de maintien du moral dans le cadre de l’activité BNP autorisée.',
      },
      entitlement: {
        status: 'current-or-local-rate-unavailable',
        amountOrFormula: {
          en: 'No universal public entitlement. The available amount is limited by the approved Unit Fund budget and current local allocation; local amount unavailable publicly.',
          fr: 'Il n’existe aucun droit public universel. Le montant disponible est limité par le budget du Fonds de l’unité approuvé et l’allocation locale actuelle; le montant local n’est pas disponible publiquement.',
        },
        note: {
          en: 'This public guide does not publish a 32 CBG local allocation; confirm the current local amount and authority before committing funds.',
          fr: 'Ce guide public ne publie pas d’allocation locale du 32 GBC; confirmez le montant local et le pouvoir actuels avant d’engager des fonds.',
        },
      },
      requirements: [
        {
          en: 'Stay within the approved Unit Fund budget for the approved capital or operating purpose.',
          fr: 'Respectez le budget du Fonds de l’unité approuvé pour l’objet d’immobilisations ou de fonctionnement approuvé.',
        },
        {
          en: 'Confirm the current local allocation and available unencumbered balance with the supporting NPP office.',
          fr: 'Confirmez l’allocation locale actuelle et le solde disponible non grevé auprès du bureau de soutien des BNP.',
        },
        {
          en: 'Obtain the applicable Unit Fund and delegated NPP approvals before commitment.',
          fr: 'Obtenez les approbations applicables du Fonds de l’unité et les pouvoirs délégués des BNP avant l’engagement.',
        },
      ],
      timing: currentGrantInstructions,
      evidence: grantEvidence,
      claimOwner: grantClaimOwner,
      approvalAndSubmission: grantApprovalAndSubmission,
      accountTreatment: grantAccountTreatment,
      unspentBalanceRule: grantUnspentBalanceRule,
      sourceIds: [
        'cfmws-budgeting-faq',
        'psp-policy-manual-reserve-unit-funds',
        'cds-npp-delegation',
        'afn105-grants',
      ],
    },
    {
      id: 'canex-sisip-dividend',
      name: {
        en: 'CANEX/SISIP dividend distribution',
        fr: 'Distribution de dividendes CANEX/SISIP',
      },
      fundingSource: 'npp',
      eligibleApplicant: {
        en: 'The unit or NPP organization identified in the current dividend distribution direction.',
        fr: 'L’unité ou l’organisation BNP désignée dans les directives actuelles sur la distribution des dividendes.',
      },
      purpose: {
        en: 'The collective morale and welfare purpose authorized for the distribution.',
        fr: 'L’objet collectif de bien-être et de maintien du moral autorisé pour la distribution.',
      },
      entitlement: {
        status: 'published-formula',
        amountOrFormula: {
          en: 'Current Base/Wing model: 0.6% of local CANEX sales, 15% of net local concession revenue, Community Recreation like costs funded at 33%, and an Equitability Adjustment Grant using geography/size multipliers.',
          fr: 'Modèle actuel des bases et escadres : 0,6 % des ventes locales CANEX, 15 % du revenu net des concessions locales, coûts comparables des loisirs communautaires financés à 33 %, et Subvention d’ajustement d’équité fondée sur des multiplicateurs de géographie et de taille.',
        },
        note: {
          en: 'There is no universal 32 CBG amount. The current local allocation and the Equitability Adjustment Grant baseline dollar value are not publicly available.',
          fr: 'Il n’existe pas de montant universel pour le 32 GBC. L’allocation locale actuelle et la valeur monétaire de base de la Subvention d’ajustement d’équité ne sont pas disponibles publiquement.',
        },
      },
      requirements: [
        {
          en: 'Confirm the current local allocation rather than deriving a 32 CBG amount from the published Base/Wing model.',
          fr: 'Confirmez l’allocation locale actuelle plutôt que de calculer un montant du 32 GBC à partir du modèle publié des bases et escadres.',
        },
        {
          en: 'Apply the current Community Recreation assessment and program direction where the allocation is for community recreation.',
          fr: 'Appliquez l’évaluation actuelle des loisirs communautaires et les directives de programme lorsque l’allocation vise les loisirs communautaires.',
        },
        {
          en: 'Confirm the applicable Equitability Adjustment Grant geography/size categorization and current direction with the supporting office.',
          fr: 'Confirmez la catégorisation applicable de géographie et de taille de la Subvention d’ajustement d’équité et les directives actuelles auprès du bureau de soutien.',
        },
      ],
      timing: currentGrantInstructions,
      evidence: grantEvidence,
      claimOwner: grantClaimOwner,
      approvalAndSubmission: grantApprovalAndSubmission,
      accountTreatment: grantAccountTreatment,
      unspentBalanceRule: grantUnspentBalanceRule,
      sourceIds: ['afn105-grants', 'afn105-grants-annex-e', 'daod-9003-1'],
    },
    {
      id: 'reserve-pfmg',
      name: { en: 'Reserve PFMG', fr: 'PFMG de la Réserve' },
      fundingSource: 'public-administered-through-npp',
      eligibleApplicant: {
        en: 'An eligible Reserve organization confirmed in the current grant instruction.',
        fr: 'Une organisation de la Réserve admissible confirmée dans les directives actuelles de la subvention.',
      },
      purpose: {
        en: 'The purpose authorized by the current Reserve PFMG instruction.',
        fr: 'L’objet autorisé par les directives actuelles relatives au PFMG de la Réserve.',
      },
      entitlement: {
        status: 'published-amount-or-ceiling',
        amountOrFormula: {
          en: 'Statutory base: initial or supplementary $5.40 per authorized officer or NCM; maintenance ceiling $2.80 per member, based on average monthly strength.',
          fr: 'Base réglementaire : subvention initiale ou supplémentaire de $5,40 par officier ou MR autorisé; plafond d’entretien de $2,80 par membre, fondé sur l’effectif mensuel moyen.',
        },
        note: {
          en: 'These statutory base figures are annually CPI-adjusted by CDS. They are not the current 2026–27 payable rate; the current rate is unavailable publicly and must come from the current DFit/Command notice.',
          fr: 'Ces chiffres de base réglementaires sont rajustés annuellement selon l’IPC par le CEMD. Ils ne constituent pas le taux payable actuel de 2026-2027; le taux actuel est indisponible publiquement et doit provenir de l’avis actuel du DFit ou du commandement.',
        },
      },
      requirements: [
        {
          en: 'Use the grant only for activity equipment (apparatus and consumables for authorized fitness and sports programs) and operating equipment (easily movable apparatus with a substantial life span); confirm the current local/Command public O&M direction before committing.',
          fr: 'Utilisez la subvention uniquement pour le matériel d’activité (appareils et consommables pour les programmes autorisés de conditionnement physique et de sports) et le matériel d’exploitation (appareils facilement déplaçables ayant une durée de vie appréciable); confirmez les directives publiques locales ou du commandement sur le fonctionnement et l’entretien avant l’engagement.',
        },
        {
          en: 'Do not use PFMG for rentals, fees, memberships or admissions; games-room equipment; furniture or entertainment appliances; prizes, awards, trophies or gifts; facilities, renovations or facility maintenance; or installed equipment.',
          fr: 'N’utilisez pas le PFMG pour les locations, frais, adhésions ou droits d’entrée; le matériel de salle de jeux; le mobilier ou les appareils de divertissement; les prix, récompenses, trophées ou cadeaux; les installations, rénovations ou l’entretien des installations; ni le matériel installé.',
        },
        {
          en: 'Submit the quarterly CF 52 with paid-invoice evidence and the current supporting documentation.',
          fr: 'Présentez le CF 52 trimestriel avec la facture payée et les pièces justificatives actuelles.',
        },
        {
          en: 'Carry an unclaimed amount forward only from a previous quarter in the same fiscal year; any entitlement unclaimed at fiscal year-end lapses.',
          fr: 'Reportez un montant non réclamé uniquement d’un trimestre précédent du même exercice; tout droit non réclamé à la fin de l’exercice devient périmé.',
        },
        {
          en: 'On a change-of-status, follow the current refund and settlement direction for any remaining balance.',
          fr: 'Lors d’un changement de statut, suivez les directives actuelles de remboursement et de règlement pour tout solde restant.',
        },
      ],
      timing: currentGrantInstructions,
      evidence: publicGrantEvidence,
      claimOwner: grantClaimOwner,
      approvalAndSubmission: publicGrantApprovalAndSubmission,
      accountTreatment: publicGrantAccountTreatment,
      unspentBalanceRule: publicGrantUnspentBalanceRule,
      sourceIds: ['qro-chapter-210', 'afn105-grants-annex-g', 'psp-policy-manual-pfmg'],
    },
    {
      id: 'reserve-organizational',
      name: {
        en: 'Reserve Organizational Grant',
        fr: 'Subvention organisationnelle de la Réserve',
      },
      fundingSource: 'public-administered-through-npp',
      eligibleApplicant: {
        en: 'An eligible Reserve organization confirmed in the current grant instruction.',
        fr: 'Une organisation de la Réserve admissible confirmée dans les directives actuelles de la subvention.',
      },
      purpose: {
        en: 'The organizational purpose authorized by the current grant instruction.',
        fr: 'L’objet organisationnel autorisé par les directives actuelles de la subvention.',
      },
      entitlement: {
        status: 'published-amount-or-ceiling',
        amountOrFormula: {
          en: 'Official ceiling table: 1–100: $344; 101–200: $689; 201–200: $1,034; 301–400: $1,379. The official table literally says 201–200; flag this apparent source typo and confirm the applicable range. No public tier above 400 is shown.',
          fr: 'Tableau officiel des plafonds : 1–100 : $344; 101–200 : $689; 201–200 : $1,034; 301–400 : $1,379. Le tableau officiel indique littéralement 201–200; signalez cette apparente erreur de source et confirmez la tranche applicable. Aucun niveau public au-delà de 400 n’est indiqué.',
        },
        note: {
          en: 'These are official reimbursement ceilings, not a standing local allocation or an authorization to correct the published range.',
          fr: 'Il s’agit de plafonds officiels de remboursement, et non d’une allocation locale permanente ni d’une autorisation de corriger la tranche publiée.',
        },
      },
      requirements: [
        {
          en: 'Eligibility events are limited to initial organization, authorized reorganization after at least one year dormant, or reorganization involving a location change.',
          fr: 'Les événements d’admissibilité se limitent à l’organisation initiale, à une réorganisation autorisée après au moins un an d’inactivité, ou à une réorganisation comportant un changement de lieu.',
        },
        {
          en: 'Obtain CDS approval before reimbursement and confirm the applicable table range without silently correcting it.',
          fr: 'Obtenez l’approbation du CEMD avant le remboursement et confirmez la tranche applicable sans la corriger silencieusement.',
        },
        {
          en: 'Keep the event, expenses, and current official instruction available for verification.',
          fr: 'Conservez la preuve de l’événement, des dépenses et des directives officielles actuelles aux fins de vérification.',
        },
      ],
      timing: currentGrantInstructions,
      evidence: publicGrantEvidence,
      claimOwner: grantClaimOwner,
      approvalAndSubmission: publicGrantApprovalAndSubmission,
      accountTreatment: publicGrantAccountTreatment,
      unspentBalanceRule: publicGrantUnspentBalanceRule,
      sourceIds: ['qro-chapter-210', 'afn105-grants-annex-g'],
    },
    {
      id: 'reserve-contingency',
      name: { en: 'Reserve Contingency Grant', fr: 'Subvention pour imprévus de la Réserve' },
      fundingSource: 'public-administered-through-npp',
      eligibleApplicant: {
        en: 'An eligible Reserve organization confirmed in the current grant instruction.',
        fr: 'Une organisation de la Réserve admissible confirmée dans les directives actuelles de la subvention.',
      },
      purpose: {
        en: 'The contingency purpose authorized by the current grant instruction.',
        fr: 'L’objet imprévu autorisé par les directives actuelles de la subvention.',
      },
      entitlement: {
        status: 'published-formula',
        amountOrFormula: {
          en: 'Annual formula: not exceeding $20 × preceding-fiscal-year average monthly effective strength.',
          fr: 'Formule annuelle : ne dépassant pas $20 × l’effectif mensuel moyen réel de l’exercice précédent.',
        },
        note: {
          en: 'Effective strength is CDS-defined, not ordinary headcount. The formula remains subject to CDS limits, deductions, and the prior-year unspent balance.',
          fr: 'L’effectif réel est défini par le CEMD et ne correspond pas à un simple effectif nominal. La formule demeure assujettie aux limites, aux déductions et au solde non dépensé de l’exercice précédent.',
        },
      },
      requirements: [
        {
          en: 'Use CDS-defined effective strength, not ordinary headcount, when confirming the preceding-fiscal-year average.',
          fr: 'Utilisez l’effectif réel défini par le CEMD, et non un simple effectif nominal, pour confirmer la moyenne de l’exercice précédent.',
        },
        {
          en: 'Apply all CDS limits and deductions, including deductions for unit liabilities or public-property damage or deficiencies where directed.',
          fr: 'Appliquez toutes les limites et déductions du CEMD, y compris les déductions liées aux obligations de l’unité ou aux dommages ou déficits de biens publics lorsqu’elles sont ordonnées.',
        },
        {
          en: 'Apply the required unspent-balance reduction before treating a calculated amount as available.',
          fr: 'Appliquez la réduction liée au solde non dépensé avant de considérer un montant calculé comme disponible.',
        },
      ],
      timing: currentGrantInstructions,
      evidence: publicGrantEvidence,
      claimOwner: grantClaimOwner,
      approvalAndSubmission: publicGrantApprovalAndSubmission,
      accountTreatment: publicGrantAccountTreatment,
      unspentBalanceRule: publicGrantUnspentBalanceRule,
      sourceIds: ['qro-chapter-210', 'afn105-grants-annex-g'],
    },
    {
      id: 'band-grant',
      name: { en: 'Band Grant', fr: 'Subvention aux musiques' },
      fundingSource: 'public-administered-through-npp',
      eligibleApplicant: {
        en: 'An eligible military band or organization confirmed in the current grant instruction.',
        fr: 'Une musique militaire ou une organisation admissible confirmée dans les directives actuelles de la subvention.',
      },
      purpose: {
        en: 'The band purpose authorized by the current grant instruction.',
        fr: 'L’objet lié à la musique autorisé par les directives actuelles de la subvention.',
      },
      entitlement: {
        status: 'published-amount-or-ceiling',
        amountOrFormula: {
          en: 'CDS-determined annual ceiling: up to $43 per authorized member for brass-reed or brass bands, and up to $25 per authorized member for pipe, piston-bugle, or fife-and-drum bands.',
          fr: 'Plafond annuel déterminé par le CEMD : jusqu’à $43 par membre autorisé pour les harmonies ou cuivres, et jusqu’à $25 par membre autorisé pour les cornemuses, trompettes à piston ou fifres et tambours.',
        },
        note: {
          en: 'The QR&O figures are maximums determined by the CDS, not an automatic local payment amount.',
          fr: 'Les montants des ORFC sont des maximums déterminés par le CEMD et non un montant de paiement local automatique.',
        },
      },
      requirements: [
        {
          en: 'Confirm that the organization is an authorized band and that the applicable CDS direction permits the claim.',
          fr: 'Confirmez que l’organisation est une musique autorisée et que les directives applicables du CEMD permettent la demande.',
        },
        {
          en: 'Use the grant only for public uses: music, minor instrument repair and maintenance, and other permitted miscellaneous band expenses.',
          fr: 'Utilisez la subvention uniquement pour les usages publics : musique, réparations mineures et entretien des instruments, ainsi que les autres dépenses diverses de musique permises.',
        },
        {
          en: 'Confirm the current DWAN-only CFAO 210-19 process before claiming or accounting for the grant.',
          fr: 'Confirmez le processus actuel de la CFAO 210-19 (OAFC 210-19), accessible seulement sur le RED, avant de demander ou de comptabiliser la subvention.',
        },
      ],
      timing: currentGrantInstructions,
      evidence: publicGrantEvidence,
      claimOwner: grantClaimOwner,
      approvalAndSubmission: publicGrantApprovalAndSubmission,
      accountTreatment: publicGrantAccountTreatment,
      unspentBalanceRule: publicGrantUnspentBalanceRule,
      sourceIds: ['qro-chapter-210', 'afn105-grants-annex-g', 'caf-music-instructions'],
    },
    {
      id: 'band-uniform',
      name: { en: 'Band Uniform Grant', fr: 'Subvention pour les uniformes de musique' },
      fundingSource: 'public-administered-through-npp',
      eligibleApplicant: {
        en: 'An eligible military band or organization confirmed in the current grant instruction.',
        fr: 'Une musique militaire ou une organisation admissible confirmée dans les directives actuelles de la subvention.',
      },
      purpose: {
        en: 'The band-uniform purpose authorized by the current grant instruction.',
        fr: 'L’objet lié aux uniformes de musique autorisé par les directives actuelles de la subvention.',
      },
      entitlement: {
        status: 'published-amount-or-ceiling',
        amountOrFormula: {
          en: '$211 initial plus $42 annual maintenance per member on strength, capped at authorized strength.',
          fr: 'Subvention initiale de $211 plus entretien annuel de $42 par membre à l’effectif, plafonné à l’effectif autorisé.',
        },
        note: {
          en: 'The grant is not payable where ceremonial dress is otherwise provided and maintained at public expense.',
          fr: 'La subvention n’est pas payable lorsque la tenue cérémonielle est déjà fournie et entretenue aux frais publics.',
        },
      },
      requirements: [
        {
          en: 'Confirm that the claimant is an authorized band and that the claim is for eligible ceremonial dress.',
          fr: 'Confirmez que le demandeur est une musique autorisée et que la demande vise une tenue cérémonielle admissible.',
        },
        {
          en: 'Do not claim where ceremonial dress is already provided and maintained at public expense.',
          fr: 'Ne présentez pas de demande lorsque la tenue cérémonielle est déjà fournie et entretenue aux frais publics.',
        },
        {
          en: 'Confirm the current DWAN-only CFAO 210-18 process before requesting or accounting for the grant.',
          fr: 'Confirmez le processus actuel de la CFAO 210-18 (OAFC 210-18), accessible seulement sur le RED, avant de demander ou de comptabiliser la subvention.',
        },
      ],
      timing: currentGrantInstructions,
      evidence: publicGrantEvidence,
      claimOwner: grantClaimOwner,
      approvalAndSubmission: publicGrantApprovalAndSubmission,
      accountTreatment: publicGrantAccountTreatment,
      unspentBalanceRule: publicGrantUnspentBalanceRule,
      sourceIds: ['qro-chapter-210', 'afn105-grants-annex-g', 'caf-music-instructions'],
    },
    {
      id: 'kilted-order',
      name: { en: 'Kilted Order Grant', fr: 'Subvention pour la tenue écossaise' },
      fundingSource: 'public-administered-through-npp',
      eligibleApplicant: {
        en: 'An eligible organization confirmed in the current grant instruction.',
        fr: 'Une organisation admissible confirmée dans les directives actuelles de la subvention.',
      },
      purpose: {
        en: 'The kilted-order purpose authorized by the current grant instruction.',
        fr: 'L’objet lié à la tenue écossaise autorisé par les directives actuelles de la subvention.',
      },
      entitlement: {
        status: 'published-amount-or-ceiling',
        amountOrFormula: {
          en: 'Initial or supplementary purchase: 60% of prescribed-item cost, maximum $253 per eligible member; annual maintenance $40 per member on strength, capped at authorized strength.',
          fr: 'Achat initial ou supplémentaire : 60 % du coût des articles prescrits, maximum de $253 par membre admissible; entretien annuel de $40 par membre à l’effectif, plafonné à l’effectif autorisé.',
        },
        note: {
          en: 'These are QR&O ceilings for an authorized Reserve Force kilted unit, not a general dress benefit.',
          fr: 'Il s’agit de plafonds des ORFC pour une unité de la Force de réserve autorisée à porter la tenue écossaise, et non d’un avantage général lié à la tenue.',
        },
      },
      requirements: [
        {
          en: 'Confirm the applicant is an authorized Reserve Force kilted unit and limit the grant to the kilt, sporran, hose, and balmoral.',
          fr: 'Confirmez que le demandeur est une unité de la Force de réserve autorisée à porter la tenue écossaise et limitez la subvention au kilt, sporran, bas et balmoral.',
        },
        {
          en: 'Use the current timing and CF 52 requirements for initial, supplementary, and maintenance claims.',
          fr: 'Utilisez le calendrier actuel et les exigences du CF 52 pour les demandes initiales, supplémentaires et d’entretien.',
        },
        {
          en: 'Do not claim when the clothing is already supplied and maintained at public expense; public-provision exclusions also apply to band dress.',
          fr: 'Ne présentez pas de demande lorsque les vêtements sont déjà fournis et entretenus aux frais publics; les exclusions liées à la fourniture publique s’appliquent aussi à la tenue de musique.',
        },
        {
          en: 'On change of status, settle the account and refund any unexpended balance as directed.',
          fr: 'Lors d’un changement de statut, réglez le compte et remboursez tout solde non dépensé selon les directives.',
        },
      ],
      timing: currentGrantInstructions,
      evidence: publicGrantEvidence,
      claimOwner: grantClaimOwner,
      approvalAndSubmission: publicGrantApprovalAndSubmission,
      accountTreatment: publicGrantAccountTreatment,
      unspentBalanceRule: publicGrantUnspentBalanceRule,
      sourceIds: ['qro-chapter-210', 'afn105-grants-annex-g', 'caf-dress-instructions'],
    },
    {
      id: 'ceremonial-other',
      name: {
        en: 'Alternate voluntary ceremonial sub-unit grants — Regular Force context (not a 32 CBG entitlement)',
        fr: 'Subventions aux sous-unités de cérémonie bénévoles de remplacement — contexte de la Force régulière (ne constitue pas un droit du 32 GBC)',
      },
      fundingSource: 'public-administered-through-npp',
      eligibleApplicant: {
        en: 'An eligible organization confirmed in the current grant instruction.',
        fr: 'Une organisation admissible confirmée dans les directives actuelles de la subvention.',
      },
      purpose: {
        en: 'Regular Force alternate voluntary ceremonial sub-unit equipment and ceremonial-dress context; it is not a 32 CBG entitlement.',
        fr: 'Contexte de l’équipement et de la tenue cérémonielle des sous-unités de cérémonie bénévoles de remplacement de la Force régulière; ne constitue pas un droit du 32 GBC.',
      },
      entitlement: {
        status: 'published-amount-or-ceiling',
        amountOrFormula: {
          en: 'Regular Force context: annual equipment ceiling $25 per member, plus $211 initial and $42 annual ceremonial-uniform maintenance per member, capped at authorized strength.',
          fr: 'Contexte de la Force régulière : plafond annuel d’équipement de $25 par membre, plus $211 initial et $42 d’entretien annuel de l’uniforme cérémoniel par membre, plafonné à l’effectif autorisé.',
        },
        note: {
          en: 'QR&O articles 210.35 and 210.354 apply to alternate voluntary ceremonial sub-units of the Regular Force, not a 32 CBG entitlement.',
          fr: 'Les articles 210.35 et 210.354 des ORFC visent les sous-unités de cérémonie bénévoles de remplacement de la Force régulière et ne constituent pas un droit du 32 GBC.',
        },
      },
      requirements: [
        {
          en: 'This is Regular Force context only; it is not a 32 CBG entitlement.',
          fr: 'Il s’agit uniquement d’un contexte de la Force régulière et cela ne constitue pas un droit du 32 GBC.',
        },
        {
          en: 'Confirm the sub-unit is authorized and apply the equipment and ceremonial-dress ceilings only to actual strength capped at authorized strength.',
          fr: 'Confirmez que la sous-unité est autorisée et appliquez les plafonds d’équipement et de tenue cérémonielle uniquement à l’effectif réel, plafonné à l’effectif autorisé.',
        },
        {
          en: 'Do not claim a ceremonial-uniform grant where clothing is already provided and maintained at public expense; public-provision exclusions apply.',
          fr: 'Ne présentez pas de demande de subvention pour un uniforme cérémoniel lorsque les vêtements sont déjà fournis et entretenus aux frais publics; les exclusions liées à la fourniture publique s’appliquent.',
        },
      ],
      timing: currentGrantInstructions,
      evidence: publicGrantEvidence,
      claimOwner: grantClaimOwner,
      approvalAndSubmission: publicGrantApprovalAndSubmission,
      accountTreatment: publicGrantAccountTreatment,
      unspentBalanceRule: publicGrantUnspentBalanceRule,
      sourceIds: ['qro-chapter-210', 'afn105-grants-annex-g'],
    },
  ],
  checklist: [
    {
      id: 'approval-before-purchase',
      label: {
        en: 'I received approval before purchasing.',
        fr: 'J’ai reçu l’approbation avant d’effectuer l’achat.',
      },
    },
    {
      id: 'authorized-purpose',
      label: {
        en: 'The expense supports an authorized NPP purpose and beneficiaries.',
        fr: 'La dépense appuie un objet et des bénéficiaires BNP autorisés.',
      },
    },
    {
      id: 'correct-funding',
      label: {
        en: 'The correct entity, budget, grant, or trust was identified.',
        fr: 'L’entité, le budget, la subvention ou la fiducie appropriés ont été identifiés.',
      },
    },
    {
      id: 'corporate-card-unavailable',
      label: {
        en: 'The NPP corporate card was unavailable or infeasible.',
        fr: 'La carte de crédit d’entreprise des BNP était indisponible ou non réalisable.',
      },
    },
    {
      id: 'itemized-receipt',
      label: {
        en: 'I have an itemized invoice or receipt.',
        fr: 'J’ai une facture ou un reçu détaillé.',
      },
    },
    {
      id: 'proof-of-payment',
      label: {
        en: 'I have proof of payment if required.',
        fr: 'J’ai une preuve de paiement, si elle est requise.',
      },
    },
    {
      id: 'acceptance',
      label: {
        en: 'The goods or services were received and accepted.',
        fr: 'Les biens ou les services ont été reçus et acceptés.',
      },
    },
    {
      id: 'declaration',
      label: {
        en: 'I completed a signed declaration if the receipt was genuinely unobtainable.',
        fr: 'J’ai rempli une déclaration signée si le reçu était réellement impossible à obtenir.',
      },
    },
    {
      id: 'payment-form',
      label: {
        en: 'I completed the current reimbursement/payment form.',
        fr: 'J’ai rempli le formulaire actuel de remboursement ou de paiement.',
      },
    },
    {
      id: 'supplier-record',
      label: {
        en: 'My supplier/payee record exists, or I completed the current setup package.',
        fr: 'Mon dossier de fournisseur ou de bénéficiaire existe, ou j’ai rempli le dossier de création actuel.',
      },
    },
    {
      id: 'eft-secure-channel',
      label: {
        en: 'EFT information was provided through the approved secure channel, if required.',
        fr: 'Les renseignements de TEF ont été fournis par la voie sécurisée approuvée, s’ils sont requis.',
      },
    },
    {
      id: 'independent-approval',
      label: {
        en: 'A separate delegated authority approved the claim.',
        fr: 'Un pouvoir délégué distinct a approuvé la réclamation.',
      },
    },
    {
      id: 'no-self-approval',
      label: {
        en: 'I did not approve my own reimbursement.',
        fr: 'Je n’ai pas approuvé mon propre remboursement.',
      },
    },
    {
      id: 'approved-submission-route',
      label: {
        en: 'I am using the approved NPP Accounting submission route.',
        fr: 'J’utilise la voie de présentation approuvée de la comptabilité des BNP.',
      },
    },
    {
      id: 'masked-payment-cards',
      label: {
        en: 'Full payment-card numbers were removed or masked.',
        fr: 'Les numéros complets de cartes de paiement ont été supprimés ou masqués.',
      },
    },
  ],
  sources: [
    {
      id: 'national-defence-act',
      title: {
        en: 'National Defence Act, sections 38–41',
        fr: 'Loi sur la défense nationale, articles 38 à 41',
      },
      publisher: { en: 'Justice Laws Website', fr: 'Site Web de la législation (Justice)' },
      urls: {
        en: 'https://laws-lois.justice.gc.ca/eng/acts/N-5/page-4.html',
        fr: 'https://laws-lois.justice.gc.ca/fra/lois/n-5/page-4.html',
      },
      checkedOn,
    },
    {
      id: 'daod-9003-1',
      title: { en: 'DAOD 9003-1, Non-Public Property', fr: 'DOAD 9003-1, Biens non publics' },
      publisher: { en: 'National Defence', fr: 'Défense nationale' },
      urls: {
        en: 'https://www.canada.ca/en/department-national-defence/corporate/policies-standards/defence-administrative-orders-directives/9000-series/9003/9003-1-non-public-property.html',
        fr: 'https://www.canada.ca/fr/ministere-defense-nationale/organisation/politiques-normes/directives-ordonnances-administratives-defense/serie-9000/9003/9003-1-biens-non-publics.html',
      },
      checkedOn,
    },
    {
      id: 'cds-npp-delegation',
      title: {
        en: 'CDS Delegation of Authorities for Financial Administration of NPP',
        fr: 'Délégation des pouvoirs du CEMD pour l’administration financière des BNP',
      },
      publisher: {
        en: 'Canadian Forces Morale and Welfare Services',
        fr: 'Services de bien-être et moral des Forces canadiennes',
      },
      urls: {
        en: 'https://cfmws.ca/CFMWS/media/images/documents/8.0%20About%20Us/8.4%20Policies%20and%20Publications/8.4.5/Policies/DelegationofAuthorities_e-18Jun26.pdf',
        fr: 'https://cfmws.ca/CFMWS/media/images/documents/8.0%20About%20Us/8.4%20Policies%20and%20Publications/8.4.5/Policies/DelegationofAuthorities_e-18Jun26.pdf',
      },
      checkedOn,
    },
    {
      id: 'cfmws-budgeting-faq',
      title: {
        en: 'CFMWS Budgeting FAQ',
        fr: 'FAQ des SBMFC sur la budgétisation',
      },
      publisher: {
        en: 'Canadian Forces Morale and Welfare Services',
        fr: 'Services de bien-être et moral des Forces canadiennes',
      },
      urls: {
        en: 'https://cfmws.ca/about-us/policies-and-publications/frequently-asked-questions/budgeting',
        fr: 'https://sbmfc.ca/a-propos/politiques-et-publications/foire-aux-questions/budgetisation',
      },
      checkedOn,
    },
    {
      id: 'psp-policy-manual-reserve-unit-funds',
      title: {
        en: 'PSP Policy Manual, Chapter 10-3: Unit Funds – Reserve Force',
        fr: 'Manuel des politiques des PSP, chapitre 10-3 : Fonds des unités – Force de réserve',
      },
      publisher: {
        en: 'Canadian Forces Morale and Welfare Services',
        fr: 'Services de bien-être et moral des Forces canadiennes',
      },
      urls: {
        en: 'https://cfmws.ca/CFMWS/media/images/documents/8.0%20About%20Us/Resources%20for%20Messes/English/PSP-Policy-Manual-EN-7-Nov-2022.pdf',
      },
      checkedOn,
    },
    {
      id: 'psp-policy-manual-pfmg',
      title: {
        en: 'PSP Policy Manual, Chapter 10-6: Grants for Provision and Maintenance of Physical Fitness Equipment',
        fr: 'Manuel des politiques des PSP, chapitre 10-6 : Subventions pour l’acquisition et l’entretien du matériel d’éducation physique',
      },
      publisher: {
        en: 'Canadian Forces Morale and Welfare Services',
        fr: 'Services de bien-être et moral des Forces canadiennes',
      },
      urls: {
        en: 'https://cfmws.ca/CFMWS/media/images/documents/8.0%20About%20Us/Resources%20for%20Messes/English/PSP-Policy-Manual-EN-7-Nov-2022.pdf',
      },
      checkedOn,
    },
    {
      id: 'alienation-request-sop',
      title: {
        en: 'Alienation of NPP Request Form SOP (publicly posted Draft v2.0)',
        fr: 'SOP du formulaire de demande d’aliénation des BNP (ébauche v2.0 publiée)',
      },
      publisher: {
        en: 'Canadian Forces Morale and Welfare Services',
        fr: 'Services de bien-être et moral des Forces canadiennes',
      },
      urls: {
        en: 'https://cfmws.ca/CFMWS/media/images/documents/8.0%20About%20Us/8.4%20Policies%20and%20Publications/8.4.5/Policies/Alienation-Request-Form-SOP-with-maps-_e-Final.pdf',
      },
      checkedOn,
    },
    {
      id: 'alienation-request-form',
      title: {
        en: 'Alienation of NPP Request Form',
        fr: 'Formulaire de demande d’aliénation des BNP',
      },
      publisher: {
        en: 'Canadian Forces Morale and Welfare Services',
        fr: 'Services de bien-être et moral des Forces canadiennes',
      },
      urls: {
        en: 'https://cfmws.ca/CFMWS/media/images/documents/8.0%20About%20Us/8.4%20Policies%20and%20Publications/8.4.5/Policies/ALIENATION-OF-NPP-REQUEST-FORM-(Template-English).pdf',
      },
      checkedOn,
    },
    {
      id: 'alienation-faq',
      title: {
        en: 'Alienation of Non-Public Property (NPP) FAQ',
        fr: 'FAQ sur l’aliénation des biens non publics (BNP)',
      },
      publisher: {
        en: 'Canadian Forces Morale and Welfare Services',
        fr: 'Services de bien-être et moral des Forces canadiennes',
      },
      urls: {
        en: 'https://cfmws.ca/about-us/policies-and-publications/frequently-asked-questions/alienation-of-non-public-property-(npp)',
        fr: 'https://sbmfc.ca/a-propos/politiques-et-publications/foire-aux-questions/alienation-of-non-public-property-(npp)',
      },
      checkedOn,
    },
    {
      id: 'afn105-grants',
      title: { en: 'A-FN-105 Chapter 10, Grants', fr: 'A-FN-105, chapitre 10, Subventions' },
      publisher: {
        en: 'Canadian Forces Morale and Welfare Services',
        fr: 'Services de bien-être et moral des Forces canadiennes',
      },
      urls: {
        en: 'https://cfmws.ca/CFMWS/media/images/documents/8.0%20About%20Us/8.4%20Policies%20and%20Publications/8.4.5/Policies/AF-N-105/Chap10_e.pdf',
      },
      checkedOn,
    },
    {
      id: 'qro-chapter-210',
      title: {
        en: 'QR&O Volume III, Chapter 210: Miscellaneous Entitlements and Grants',
        fr: 'ORFC volume III, chapitre 210 : Prestations et subventions diverses',
      },
      publisher: { en: 'National Defence', fr: 'Défense nationale' },
      urls: {
        en: 'https://www.canada.ca/en/department-national-defence/corporate/policies-standards/queens-regulations-orders/vol-3-financial/ch-210-miscellaneous-entitlements-grants.html',
        fr: 'https://www.canada.ca/fr/ministere-defense-nationale/organisation/politiques-normes/ordonnances-reglements-royaux/vol-3-finances/chapitre-210-prestations-subventions-diverses.html',
      },
      checkedOn,
    },
    {
      id: 'afn105-grants-annex-e',
      title: {
        en: 'A-FN-105 Chapter 10, Annex E: CANEX/SISIP Dividend Procedures',
        fr: 'A-FN-105, chapitre 10, annexe E : Procédures relatives au dividende CANEX/SISIP',
      },
      publisher: {
        en: 'Canadian Forces Morale and Welfare Services',
        fr: 'Services de bien-être et moral des Forces canadiennes',
      },
      urls: {
        en: 'https://cfmws.ca/CFMWS/media/images/documents/8.0%20About%20Us/8.4%20Policies%20and%20Publications/8.4.5/Policies/AF-N-105%20EN/Chap10E_e.pdf',
      },
      checkedOn,
    },
    {
      id: 'afn105-grants-annex-g',
      title: {
        en: 'A-FN-105 Chapter 10, Annex G: Other Public Fund Grants',
        fr: 'A-FN-105, chapitre 10, annexe G : Autres subventions de fonds publics',
      },
      publisher: {
        en: 'Canadian Forces Morale and Welfare Services',
        fr: 'Services de bien-être et moral des Forces canadiennes',
      },
      urls: {
        en: 'https://cfmws.ca/CFMWS/media/images/documents/8.0%20About%20Us/8.4%20Policies%20and%20Publications/8.4.5/Policies/AF-N-105%20EN/Chap10G_e.pdf',
      },
      checkedOn,
    },
    {
      id: 'caf-music-instructions',
      title: {
        en: 'Canadian Armed Forces Music Instructions, Volume 1',
        fr: 'Instructions de musique des Forces armées canadiennes, volume 1',
      },
      publisher: { en: 'National Defence', fr: 'Défense nationale' },
      urls: {
        en: 'https://www.canada.ca/content/dam/themes/defence/caf/showcasing/music/canadian-armed-forces-music-instructions-volume-1.pdf',
      },
      checkedOn,
    },
    {
      id: 'caf-dress-instructions',
      title: {
        en: 'CAF Dress Instructions, Chapter 5: Orders of Dress',
        fr: 'Instructions sur la tenue des FAC, chapitre 5 : Ordres de tenue',
      },
      publisher: { en: 'National Defence', fr: 'Défense nationale' },
      urls: {
        en: 'https://www.canada.ca/en/services/defence/caf/military-identity-system/dress-manual/chapter-5.html',
      },
      checkedOn,
    },
    {
      id: 'afn105-accounts-payable',
      title: {
        en: 'A-FN-105 Chapter 19, Accounts Payable',
        fr: 'A-FN-105, chapitre 19, Comptes créditeurs',
      },
      publisher: {
        en: 'Canadian Forces Morale and Welfare Services',
        fr: 'Services de bien-être et moral des Forces canadiennes',
      },
      urls: {
        en: 'https://cfmws.ca/CFMWS/media/images/documents/8.0%20About%20Us/8.4%20Policies%20and%20Publications/8.4.5/Policies/AF-N-105/Chap19_e.pdf',
      },
      checkedOn,
    },
    {
      id: 'afn105-non-employer-payments',
      title: {
        en: 'A-FN-105 Chapter 32, Non-employer Payments',
        fr: 'A-FN-105, chapitre 32, Paiements à des non-employés',
      },
      publisher: {
        en: 'Canadian Forces Morale and Welfare Services',
        fr: 'Services de bien-être et moral des Forces canadiennes',
      },
      urls: {
        en: 'https://cfmws.ca/CFMWS/media/images/documents/8.0%20About%20Us/8.4%20Policies%20and%20Publications/8.4.5/Policies/AF-N-105/chap32_e.pdf',
      },
      checkedOn,
    },
    {
      id: 'npp-contracting-policy',
      title: {
        en: 'Current Non-Public Property Contracting Policy',
        fr: 'Politique actuelle de passation des marchés des biens non publics',
      },
      publisher: {
        en: 'Canadian Forces Morale and Welfare Services',
        fr: 'Services de bien-être et moral des Forces canadiennes',
      },
      urls: {
        en: 'https://cfmws.ca/about-us/policies-and-publications/procurement-and-contracting/non-public-property-contracting-policy',
        fr: 'https://sbmfc.ca/a-propos/politiques-et-publications/approvisionnement-et-passation-de-marches/politique-de-passation-de-marches-des-biens-non-publics',
      },
      checkedOn,
    },
    {
      id: 'contract-for-services',
      title: {
        en: 'Current Contract for Services operational page',
        fr: 'Page opérationnelle actuelle sur le contrat de services',
      },
      publisher: {
        en: 'Canadian Forces Morale and Welfare Services',
        fr: 'Services de bien-être et moral des Forces canadiennes',
      },
      urls: {
        en: 'https://cfmws.ca/about-us/policies-and-publications/procurement-and-contracting/contract-for-services',
        fr: 'https://sbmfc.ca/a-propos/politiques-et-publications/approvisionnement-et-passation-de-marches/contrats-de-services',
      },
      checkedOn,
    },
    {
      id: 'afn105-credit-cards',
      title: {
        en: 'A-FN-105 Chapter 12, Credit Cards',
        fr: 'A-FN-105, chapitre 12, Cartes de crédit',
      },
      publisher: {
        en: 'Canadian Forces Morale and Welfare Services',
        fr: 'Services de bien-être et moral des Forces canadiennes',
      },
      urls: {
        en: 'https://cfmws.ca/CFMWS/media/images/documents/8.0%20About%20Us/8.4%20Policies%20and%20Publications/8.4.5/Policies/AF-N-105/Chap12_e.pdf',
      },
      checkedOn,
    },
  ],
};
