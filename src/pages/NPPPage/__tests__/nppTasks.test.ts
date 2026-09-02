import { describe, expect, it } from 'vitest';
import { nppGuideContent } from '../nppContent';
import { getNextSteps, nppTasks } from '../nppTasks';

const sectionIds = new Set(nppGuideContent.sections.map((section) => section.id));
const taskIds = new Set(nppTasks.map((task) => task.id));

describe('nppTasks', () => {
  it('has a unique id for every task', () => {
    expect(taskIds.size).toBe(nppTasks.length);
  });

  it('points every task at a section that actually exists', () => {
    for (const task of nppTasks) {
      expect(sectionIds.has(task.sectionId)).toBe(true);
    }
  });

  it('has non-empty English and French title and when copy for every task', () => {
    for (const task of nppTasks) {
      expect(task.title.en.trim().length).toBeGreaterThan(0);
      expect(task.title.fr.trim().length).toBeGreaterThan(0);
      expect(task.when.en.trim().length).toBeGreaterThan(0);
      expect(task.when.fr.trim().length).toBeGreaterThan(0);
    }
  });

  it('resolves every next-step id to a real task', () => {
    for (const sectionId of sectionIds) {
      const [first, second] = getNextSteps(sectionId);

      expect(taskIds.has(first)).toBe(true);
      expect(taskIds.has(second)).toBe(true);
    }
  });
});
