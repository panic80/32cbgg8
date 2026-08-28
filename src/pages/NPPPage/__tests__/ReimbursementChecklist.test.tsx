import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LocaleProvider } from '@/i18n/LocaleContext';
import { LocaleToggle } from '@/components/LocaleToggle';
import { ReimbursementChecklist } from '../ReimbursementChecklist';

const renderChecklist = () =>
  render(
    <LocaleProvider>
      <LocaleToggle />
      <ReimbursementChecklist />
    </LocaleProvider>,
  );

describe('ReimbursementChecklist', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/npp');
  });

  it('tracks checked items in an accessible progress status and resets them', () => {
    renderChecklist();

    expect(screen.getByText('0 of 15 complete')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('checkbox', { name: /approval before purchasing/i }));
    expect(screen.getByText('1 of 15 complete')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /reset/i }));
    expect(screen.getByText('0 of 15 complete')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reset/i })).toHaveClass('min-h-11');
    expect(screen.getByRole('button', { name: /print/i })).toHaveClass('min-h-11');
    expect(screen.getByRole('checkbox', { name: /approval before purchasing/i })).toHaveAttribute(
      'aria-checked',
      'false',
    );
    expect(screen.getByText('0 of 15 complete')).toHaveAttribute('aria-live', 'polite');
  });

  it('calls the browser print action when Print is selected', () => {
    const print = vi.fn();
    const originalPrint = window.print;
    window.print = print;

    try {
      renderChecklist();
      fireEvent.click(screen.getByRole('button', { name: /print/i }));
      expect(print).toHaveBeenCalledTimes(1);
    } finally {
      window.print = originalPrint;
    }
  });

  it('does not retain completion after unmounting and remounting', () => {
    const view = renderChecklist();

    fireEvent.click(screen.getByRole('checkbox', { name: /approval before purchasing/i }));
    expect(screen.getByText('1 of 15 complete')).toBeInTheDocument();

    view.unmount();
    renderChecklist();

    expect(screen.getByText('0 of 15 complete')).toBeInTheDocument();
  });

  it('renders French labels and progress after switching locale', () => {
    renderChecklist();

    fireEvent.click(screen.getByRole('button', { name: 'Français' }));

    expect(screen.getByText(/0 sur 15/)).toBeInTheDocument();
    expect(
      screen.getByRole('checkbox', { name: /approbation avant d’effectuer l’achat/i }),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('checkbox', { name: /approbation avant d’effectuer l’achat/i }),
    );
    expect(screen.getByText(/1 sur 15/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /réinitialiser/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /imprimer/i })).toBeInTheDocument();
  });
});
