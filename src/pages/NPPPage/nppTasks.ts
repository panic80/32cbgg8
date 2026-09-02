import type { TaskDefinition } from './types';

// "Nine" and "twenty" below mirror nppGuideContent.grants.length / .sources.length today.
// Update this copy (and its FR translation) if either list's size changes.
export const nppTasks: TaskDefinition[] = [
  {
    id: 't-understand',
    band: 'start-here',
    title: { en: 'Understand NPP and NPF', fr: 'Comprendre les BNP et les FNP' },
    when: {
      en: 'You need to know what NPF is, and what it can never pay for.',
      fr: 'Vous devez savoir ce que sont les FNP et ce qu’ils ne peuvent jamais payer.',
    },
    audience: 'all-members',
    view: 'section',
    sectionId: 'npp-and-npf',
  },
  {
    id: 't-before',
    band: 'start-here',
    title: { en: 'Check before you spend', fr: 'Vérifiez avant de dépenser' },
    when: {
      en: 'You have a purchase in mind and need the go / no-go controls.',
      fr: 'Vous envisagez un achat et avez besoin des contrôles de type feu vert ou feu rouge.',
    },
    audience: 'all-members',
    view: 'section',
    sectionId: 'before-spending',
  },
  {
    id: 't-spend',
    band: 'spend-and-pay',
    title: { en: 'Buy something with NPF', fr: 'Acheter quelque chose avec des FNP' },
    when: {
      en: 'You are running a purchase from requirement through to payment.',
      fr: 'Vous gérez un achat, du besoin jusqu’au paiement.',
    },
    audience: 'operators',
    view: 'section',
    sectionId: 'spending-npf',
  },
  {
    id: 't-vendor',
    band: 'spend-and-pay',
    title: { en: 'Pay an existing vendor', fr: 'Payer un fournisseur existant' },
    when: {
      en: 'The supplier is already set up in NPP Accounting.',
      fr: 'Le fournisseur est déjà inscrit à la comptabilité des BNP.',
    },
    audience: 'operators',
    view: 'section',
    sectionId: 'existing-vendor',
  },
  {
    id: 't-newvendor',
    band: 'spend-and-pay',
    title: { en: 'Set up a new vendor', fr: 'Créer un nouveau fournisseur' },
    when: {
      en: 'No suitable supplier record exists yet.',
      fr: 'Aucun dossier de fournisseur approprié n’existe encore.',
    },
    audience: 'operators',
    view: 'section',
    sectionId: 'create-vendor',
  },
  {
    id: 't-person',
    band: 'spend-and-pay',
    title: { en: 'Pay an individual', fr: 'Payer une personne' },
    when: {
      en: 'A person is owed money — as a contractor, or as a reimbursement.',
      fr: 'Une personne doit être payée — à titre de contractant ou de remboursement.',
    },
    audience: 'operators',
    view: 'section',
    sectionId: 'pay-individual',
  },
  {
    id: 't-alienation',
    band: 'spend-and-pay',
    title: { en: 'Give away or sell NPP', fr: 'Donner ou vendre des BNP' },
    when: {
      en: 'Gifts, donations, below-market sales. A separate approval path.',
      fr: 'Dons, donations, ventes sous la valeur marchande. Une voie d’approbation distincte.',
    },
    audience: 'operators',
    view: 'section',
    sectionId: 'alienation-of-funds',
  },
  {
    id: 't-reimburse',
    band: 'claim-and-reference',
    title: { en: 'Get reimbursed', fr: 'Se faire rembourser' },
    when: {
      en: 'You paid out of pocket and need to build the claim package.',
      fr: 'Vous avez payé de votre poche et devez monter le dossier de réclamation.',
    },
    audience: 'all-members',
    view: 'checklist',
    sectionId: 'reimbursement-checklist',
  },
  {
    id: 't-grants',
    band: 'claim-and-reference',
    title: { en: 'Find a grant', fr: 'Trouver une subvention' },
    when: {
      en: 'Nine funding records, with amount or formula and what to confirm.',
      fr: 'Neuf dossiers de financement, avec montant ou formule et éléments à confirmer.',
    },
    audience: 'operators',
    view: 'grants',
    sectionId: 'grants',
  },
  {
    id: 't-sources',
    band: 'claim-and-reference',
    title: { en: 'Sources and help', fr: 'Sources et aide' },
    when: {
      en: 'The twenty official documents this guide is drawn from.',
      fr: 'Les vingt documents officiels dont ce guide est tiré.',
    },
    audience: 'all-members',
    view: 'sources',
    sectionId: 'sources-help',
  },
];

const defaultNextSteps: [string, string] = ['t-reimburse', 't-sources'];

// Hand-curated related-task pairs per section, ported from the approved design.
// Not derived programmatically — narrative flow was chosen editorially.
export const nextStepsFor: Record<string, [string, string]> = {
  'npp-and-npf': ['t-before', 't-reimburse'],
  'before-spending': ['t-spend', 't-reimburse'],
  'spending-npf': ['t-vendor', 't-person'],
  'existing-vendor': ['t-newvendor', 't-person'],
  'create-vendor': ['t-vendor', 't-sources'],
  'pay-individual': ['t-reimburse', 't-spend'],
  'alienation-of-funds': ['t-sources', 't-before'],
};

export const getNextSteps = (sectionId: string): [string, string] =>
  nextStepsFor[sectionId] ?? defaultNextSteps;
