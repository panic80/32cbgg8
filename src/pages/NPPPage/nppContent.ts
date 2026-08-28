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
      timing: currentGrantInstructions,
      evidence: grantEvidence,
      claimOwner: grantClaimOwner,
      approvalAndSubmission: grantApprovalAndSubmission,
      accountTreatment: grantAccountTreatment,
      unspentBalanceRule: grantUnspentBalanceRule,
      sourceIds: ['cds-npp-delegation', 'afn105-grants'],
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
      timing: currentGrantInstructions,
      evidence: grantEvidence,
      claimOwner: grantClaimOwner,
      approvalAndSubmission: grantApprovalAndSubmission,
      accountTreatment: grantAccountTreatment,
      unspentBalanceRule: grantUnspentBalanceRule,
      sourceIds: ['afn105-grants', 'daod-9003-1'],
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
      timing: currentGrantInstructions,
      evidence: grantEvidence,
      claimOwner: grantClaimOwner,
      approvalAndSubmission: grantApprovalAndSubmission,
      accountTreatment: grantAccountTreatment,
      unspentBalanceRule: grantUnspentBalanceRule,
      sourceIds: ['afn105-grants'],
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
      timing: currentGrantInstructions,
      evidence: grantEvidence,
      claimOwner: grantClaimOwner,
      approvalAndSubmission: grantApprovalAndSubmission,
      accountTreatment: grantAccountTreatment,
      unspentBalanceRule: grantUnspentBalanceRule,
      sourceIds: ['afn105-grants'],
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
      timing: currentGrantInstructions,
      evidence: grantEvidence,
      claimOwner: grantClaimOwner,
      approvalAndSubmission: grantApprovalAndSubmission,
      accountTreatment: grantAccountTreatment,
      unspentBalanceRule: grantUnspentBalanceRule,
      sourceIds: ['afn105-grants'],
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
      timing: currentGrantInstructions,
      evidence: grantEvidence,
      claimOwner: grantClaimOwner,
      approvalAndSubmission: grantApprovalAndSubmission,
      accountTreatment: grantAccountTreatment,
      unspentBalanceRule: grantUnspentBalanceRule,
      sourceIds: ['afn105-grants'],
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
      timing: currentGrantInstructions,
      evidence: grantEvidence,
      claimOwner: grantClaimOwner,
      approvalAndSubmission: grantApprovalAndSubmission,
      accountTreatment: grantAccountTreatment,
      unspentBalanceRule: grantUnspentBalanceRule,
      sourceIds: ['afn105-grants'],
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
      timing: currentGrantInstructions,
      evidence: grantEvidence,
      claimOwner: grantClaimOwner,
      approvalAndSubmission: grantApprovalAndSubmission,
      accountTreatment: grantAccountTreatment,
      unspentBalanceRule: grantUnspentBalanceRule,
      sourceIds: ['afn105-grants'],
    },
    {
      id: 'ceremonial-other',
      name: {
        en: 'Other applicable ceremonial grant',
        fr: 'Autre subvention cérémonielle applicable',
      },
      fundingSource: 'public-administered-through-npp',
      eligibleApplicant: {
        en: 'An eligible organization confirmed in the current grant instruction.',
        fr: 'Une organisation admissible confirmée dans les directives actuelles de la subvention.',
      },
      purpose: {
        en: 'The ceremonial purpose authorized by the current grant instruction.',
        fr: 'L’objet cérémoniel autorisé par les directives actuelles de la subvention.',
      },
      timing: currentGrantInstructions,
      evidence: grantEvidence,
      claimOwner: grantClaimOwner,
      approvalAndSubmission: grantApprovalAndSubmission,
      accountTreatment: grantAccountTreatment,
      unspentBalanceRule: grantUnspentBalanceRule,
      sourceIds: ['afn105-grants'],
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
