import { describe, expect, it } from 'vitest';
import { getLandingFeatures, landingFeatures } from '../landingConfig';

describe('landingConfig', () => {
  it('does not expose chatbot quick ask prompts', async () => {
    const config = await import('../landingConfig');

    expect('quickAskPrompts' in config).toBe(false);
  });

  it('includes a SCIP portal feature flagged as action', () => {
    const feature = landingFeatures.find((item) => item.id === 'scipPortal');
    expect(feature).toBeDefined();
    expect(feature?.kind).toBe('action');
    expect(feature?.to).toBeUndefined();
  });

  it('does not display the temporarily removed OPI Contacts or Resources cards', () => {
    expect(landingFeatures.some((item) => item.id === 'opiContacts')).toBe(false);
    expect(landingFeatures.some((item) => item.id === 'resources')).toBe(false);
  });

  it('does not expose policy assistant as a feature', () => {
    expect(landingFeatures.some((item) => item.id === 'policyAssistant')).toBe(false);
    expect(landingFeatures.some((item) => item.title === 'Policy Assistant')).toBe(false);
  });

  it('includes at least one navigable feature link', () => {
    const linkFeatures = landingFeatures.filter((item) => item.kind === 'link');
    expect(linkFeatures.length).toBeGreaterThanOrEqual(1);
    linkFeatures.forEach((feature) => {
      expect(feature.to).toBeDefined();
    });
  });

  it('provides ordered bilingual feature entries with an internal NPF guide link', () => {
    const englishFeatures = getLandingFeatures('en');

    expect(englishFeatures.map((item) => item.id)).toEqual(['doaList', 'scipPortal', 'npf']);

    const npf = englishFeatures.find((item) => item.id === 'npf');
    expect(npf).toMatchObject({
      title: 'NPF',
      kind: 'link',
      to: '/npp?lang=en',
    });
    expect(npf?.badge).toBeUndefined();
    expect(npf?.disabledTooltip).toBeUndefined();
    expect(npf?.icon).toBeDefined();

    const frenchNpf = getLandingFeatures('fr').find((item) => item.id === 'npf');
    expect(frenchNpf?.description).toBe(
      'Consultez le Guide des BNP / FNP pour obtenir des conseils clairs sur les dépenses, les subventions, les fournisseurs et les remboursements.',
    );
  });
});
