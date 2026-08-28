import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ScrollToTop from '@/components/ScrollToTop';

describe('ScrollToTop', () => {
  let scrollToSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    scrollToSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    document.getElementById('app-scroll-root')?.remove();
    scrollToSpy.mockRestore();
  });

  it('restores a direct hash target instead of resetting the page to the top', () => {
    vi.useFakeTimers();
    const appRoot = document.createElement('div');
    appRoot.id = 'app-scroll-root';
    const target = document.createElement('section');
    const scrollIntoViewSpy = vi.fn();
    target.id = 'pay-individual';
    target.scrollIntoView = scrollIntoViewSpy;
    appRoot.appendChild(target);
    document.body.appendChild(appRoot);

    render(
      <MemoryRouter initialEntries={['/npp?lang=en#pay-individual']}>
        <ScrollToTop />
      </MemoryRouter>,
    );

    vi.runAllTimers();

    expect(scrollIntoViewSpy).toHaveBeenCalledWith({ behavior: 'auto', block: 'start' });
    expect(scrollToSpy).not.toHaveBeenCalled();
  });

  it('restores a hash target that mounts after the route effect', () => {
    vi.useFakeTimers();
    const appRoot = document.createElement('div');
    appRoot.id = 'app-scroll-root';
    document.body.appendChild(appRoot);

    render(
      <MemoryRouter initialEntries={['/npp?lang=en#pay-individual']}>
        <ScrollToTop />
      </MemoryRouter>,
    );

    vi.advanceTimersByTime(1);

    const target = document.createElement('section');
    const scrollIntoViewSpy = vi.fn();
    target.id = 'pay-individual';
    target.scrollIntoView = scrollIntoViewSpy;
    appRoot.appendChild(target);

    vi.runAllTimers();

    expect(scrollIntoViewSpy).toHaveBeenCalledWith({ behavior: 'auto', block: 'start' });
    expect(scrollToSpy).not.toHaveBeenCalled();
  });

  it('resets hashless routes to the top', () => {
    render(
      <MemoryRouter initialEntries={['/npp?lang=en']}>
        <ScrollToTop />
      </MemoryRouter>,
    );

    expect(scrollToSpy).toHaveBeenCalledWith({ top: 0, left: 0, behavior: 'auto' });
  });
});
