import { describe, expect, it } from 'vitest';
import { landingFeatures } from '../landingConfig';

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

  it('keeps resources visible as an under-review link', () => {
    const resources = landingFeatures.find((item) => item.id === 'resources');
    expect(resources).toBeDefined();
    expect(resources?.kind).toBe('link');
    expect(resources?.to).toBe('/resources');
    expect(resources?.badge).toBe('Under Review');
  });

  it('does not expose policy assistant as a feature', () => {
    expect(landingFeatures.some((item) => item.id === 'policyAssistant')).toBe(false);
    expect(landingFeatures.some((item) => item.title === 'Policy Assistant')).toBe(false);
  });

  it('includes at least one navigable feature link', () => {
    const linkFeatures = landingFeatures.filter((item) => item.kind === 'link');
    expect(linkFeatures.length).toBeGreaterThanOrEqual(2);
    linkFeatures.forEach((feature) => {
      expect(feature.to).toBeDefined();
    });
  });
});
