import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HamburgerMenu } from '@/components/HamburgerMenu';

vi.mock('framer-motion', () => {
  const sanitizeProps = (props: Record<string, unknown>) => {
    const { whileHover, whileTap, initial, animate, transition, ...rest } = props;
    return rest;
  };

  const Framer = {
    div: React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>((props, ref) => (
      <div ref={ref} {...(sanitizeProps(props) as React.HTMLAttributes<HTMLDivElement>)} />
    )),
    button: React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>((props, ref) => (
      <button ref={ref} {...(sanitizeProps(props) as React.ButtonHTMLAttributes<HTMLButtonElement>)} />
    )),
  };
  return { motion: Framer };
});

const SheetContext = React.createContext<{
  open: boolean;
  setOpen: (value: boolean) => void;
}>({ open: false, setOpen: () => {} });

vi.mock('@/components/ui/sheet', () => {
  const Sheet = ({ open, onOpenChange, children }: any) => (
    <SheetContext.Provider value={{ open: !!open, setOpen: onOpenChange || (() => {}) }}>
      {children}
    </SheetContext.Provider>
  );

  const SheetTrigger = ({ asChild, children }: any) => {
    const { setOpen } = React.useContext(SheetContext);
    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children, {
        onClick: (event: React.MouseEvent) => {
          children.props.onClick?.(event);
          setOpen(true);
        },
      });
    }
    return (
      <button type="button" onClick={() => setOpen(true)}>
        {children}
      </button>
    );
  };

  const SheetContent = ({ children }: any) => {
    const { open } = React.useContext(SheetContext);
    return open ? <div>{children}</div> : null;
  };

  const SheetHeader = ({ children }: any) => <div>{children}</div>;
  const SheetTitle = ({ children }: any) => <h2>{children}</h2>;

  return {
    Sheet,
    SheetTrigger,
    SheetContent,
    SheetHeader,
    SheetTitle,
  };
});

vi.mock('@/components/ui/switch', () => ({
  Switch: ({ checked, onCheckedChange }: { checked: boolean; onCheckedChange: (value: boolean) => void }) => (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onCheckedChange(!checked)}
    >
      {checked ? 'On' : 'Off'}
    </button>
  ),
}));

vi.mock('@/components/ui/separator', () => ({
  Separator: (props: React.HTMLAttributes<HTMLHRElement>) => <hr {...props} />,
}));

vi.mock('react-router-dom', () => ({
  Link: ({ to, children, ...props }: any) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

describe('HamburgerMenu', () => {
  const toggleTheme = vi.fn();
  const setModelMode = vi.fn();
  const setShortAnswerMode = vi.fn();
  const onTripPlannerOpen = vi.fn();
  const onHelpOpen = vi.fn();
  const onWhatsNewOpen = vi.fn();
  const onHowItWorksOpen = vi.fn();
  const onExportMarkdown = vi.fn();
  const onClearConversation = vi.fn();

  const renderMenu = () =>
    render(
      <HamburgerMenu
        theme="light"
        toggleTheme={toggleTheme}
        modelMode="smart"
        setModelMode={setModelMode}
        shortAnswerMode={false}
        setShortAnswerMode={setShortAnswerMode}
        onTripPlannerOpen={onTripPlannerOpen}
        onHelpOpen={onHelpOpen}
        onWhatsNewOpen={onWhatsNewOpen}
        onHowItWorksOpen={onHowItWorksOpen}
        onExportMarkdown={onExportMarkdown}
        onClearConversation={onClearConversation}
        hasWhatsNew
      />
    );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('opens the sheet and allows toggling AI settings', () => {
    renderMenu();

    fireEvent.click(screen.getByRole('button', { name: /open menu/i }));

    fireEvent.click(screen.getByRole('button', { name: /fast/i }));
    expect(setModelMode).toHaveBeenCalledWith('fast');

    fireEvent.click(screen.getByRole('button', { name: /dark/i }));
    expect(toggleTheme).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('switch'));
    expect(setShortAnswerMode).toHaveBeenCalledWith(true);
  });

  it('invokes tool actions and closes the menu', () => {
    renderMenu();

    fireEvent.click(screen.getByRole('button', { name: /open menu/i }));
    expect(screen.getByRole('heading', { name: /menu/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /travel planner/i }));
    expect(onTripPlannerOpen).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('heading', { name: /menu/i })).not.toBeInTheDocument();
  });

  it('does not render a glossary menu entry', () => {
    renderMenu();

    fireEvent.click(screen.getByRole('button', { name: /open menu/i }));

    expect(screen.queryByText(/glossary/i)).not.toBeInTheDocument();
  });
});
