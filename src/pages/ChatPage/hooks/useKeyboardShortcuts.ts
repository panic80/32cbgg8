import { useEffect } from 'react';

interface KeyboardShortcutsOptions {
  showInlineCommand: boolean;
  selectedCommandIndex: number;
  inlineCommands: any[];
  setCommandOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  setSelectedCommandIndex: (index: number) => void;
  setInput: (value: string) => void;
  setShowInlineCommand: (show: boolean) => void;
  setShowHelpDialog?: (open: boolean | ((prev: boolean) => boolean)) => void;
}

export const useKeyboardShortcuts = ({
  showInlineCommand,
  selectedCommandIndex,
  inlineCommands,
  setCommandOpen,
  setSelectedCommandIndex,
  setInput,
  setShowInlineCommand,
  setShowHelpDialog
}: KeyboardShortcutsOptions) => {
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCommandOpen((open) => !open);
      }
      // Shift+/ opens Help (common "?" shortcut)
      if (e.key === '/' && e.shiftKey && setShowHelpDialog) {
        e.preventDefault();
        setShowHelpDialog((prev) => !prev);
      }
      
      // Handle arrow navigation for inline commands
      if (showInlineCommand) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelectedCommandIndex((selectedCommandIndex + 1) % inlineCommands.length);
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedCommandIndex(selectedCommandIndex === 0 ? inlineCommands.length - 1 : selectedCommandIndex - 1);
        } else if (e.key === 'Enter') {
          e.preventDefault();
          const selectedCommand = inlineCommands[selectedCommandIndex];
          setInput(selectedCommand.command + ' ');
          setShowInlineCommand(false);
          // Focus is now handled inside ChatInput component
        } else if (e.key === 'Escape') {
          setShowInlineCommand(false);
        }
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [showInlineCommand, selectedCommandIndex, inlineCommands, setCommandOpen, setSelectedCommandIndex, setInput, setShowInlineCommand, setShowHelpDialog]);
};
