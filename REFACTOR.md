# Refactoring Plan for ChatPage.tsx

## Project Overview
- **File**: `/var/www/cbthis/src/pages/ChatPage.tsx`
- **Current Size**: 1,349 lines
- **Target Size**: ~200 lines (main orchestration only)
- **Extraction Target**: ~1,150 lines into modular components
- **Risk Level**: Low (UI-only refactoring, no logic changes)

## Pre-Refactoring Setup
- [x] Create backup: `cp src/pages/ChatPage.tsx src/pages/ChatPage.tsx.backup.20250815_233414`
- [ ] Document current behavior and edge cases
- [ ] Create test suite that captures ALL current functionality
- [ ] Run baseline performance benchmark
- [ ] Commit original state to version control

## Test Suite Definition

### Core Functionality Tests
```bash
# Run after EVERY step - no exceptions
npm run test:refactor
```

### Manual Test Checklist (run every 10 steps)
- [ ] Send message and receive response
- [ ] SSE streaming works (no broken chunks)
- [ ] Model toggle (FAST/SMART) persists
- [ ] RAG toggle functions correctly
- [ ] Follow-up questions clickable
- [ ] Copy message to clipboard
- [ ] Theme toggle works
- [ ] Command palette opens (Cmd+K)
- [ ] Help dialog displays
- [ ] LocalStorage persistence verified

### Automated Test Commands
```bash
# Build test (run after each step)
npm run build 2>&1 | grep -E "(✓ built|Failed)" 

# Type check (run after each step)
npx tsc --noEmit 2>&1 | grep -E "(error|Error)" || echo "✅ No TypeScript errors"

# Dev server test (run every 5 steps)
timeout 10s npm run dev 2>&1 | grep -E "ready in|Error" || echo "✅ Dev server starts"

# Full test suite (run at checkpoints)
npm run build:production && echo "✅ Production build successful"
```

## Incremental Changes

### Phase 1: Extract Utilities and Formatting (Lines 35-65)
**Risk**: Low | **Time**: 15 minutes | **Dependencies**: None

- [ ] **Step 1.1**: Create utils directory
  - Command: `mkdir -p src/pages/ChatPage/utils`
  - Test: `ls -la src/pages/ChatPage/utils`
  - Verify: Directory exists
  - Rollback: `rmdir src/pages/ChatPage/utils`

- [ ] **Step 1.2**: Extract formatPlainTextToMarkdown function
  - File: `src/pages/ChatPage/utils/formatting.ts`
  - Lines: 35-65 from ChatPage.tsx
  - Change: Create new file with function export
  ```typescript
  export const formatPlainTextToMarkdown = (text: string): string => {
    // ... existing function body ...
  };
  ```
  - Test: `npm run build 2>&1 | grep "✓ built"`
  - Rollback: `rm src/pages/ChatPage/utils/formatting.ts`

- [ ] **Step 1.3**: Import formatPlainTextToMarkdown in ChatPage.tsx
  - File: ChatPage.tsx
  - Line: Add after line 33
  - Change: `import { formatPlainTextToMarkdown } from './ChatPage/utils/formatting';`
  - Test: `npx tsc --noEmit`
  - Rollback: Remove import line

- [ ] **Step 1.4**: Remove inline formatPlainTextToMarkdown
  - File: ChatPage.tsx
  - Lines: 35-65
  - Change: Delete function definition
  - Test: `npm run build`
  - Rollback: Restore from backup

### Phase 2: Extract EmptyState Component (Lines 798-859)
**Risk**: Low | **Time**: 20 minutes | **Dependencies**: Phase 1

- [ ] **Step 2.1**: Create EmptyState.tsx file
  - File: `src/pages/ChatPage/components/EmptyState.tsx`
  - Command: `touch src/pages/ChatPage/components/EmptyState.tsx`
  - Test: `ls -la src/pages/ChatPage/components/EmptyState.tsx`
  - Rollback: `rm src/pages/ChatPage/components/EmptyState.tsx`

- [ ] **Step 2.2**: Extract EmptyState JSX structure
  - Source: Lines 798-859 from ChatPage.tsx
  - Target: EmptyState.tsx
  ```typescript
  import React from 'react';
  import { motion } from 'framer-motion';
  import { Card, CardContent } from '@/components/ui/card';
  import { WELCOME_SUGGESTIONS } from '../constants/suggestions';
  
  interface EmptyStateProps {
    onSuggestionClick: (title: string) => void;
  }
  
  export const EmptyState: React.FC<EmptyStateProps> = ({ onSuggestionClick }) => (
    // ... JSX from lines 798-859 ...
  );
  ```
  - Test: `npx tsc --noEmit`
  - Rollback: Clear file content

- [ ] **Step 2.3**: Import EmptyState in ChatPage.tsx
  - Line: After line 32
  - Change: `import { EmptyState } from './ChatPage/components/EmptyState';`
  - Test: `npm run build`
  - Rollback: Remove import

- [ ] **Step 2.4**: Replace inline EmptyState with component
  - Lines: 798-859
  - Change: Replace with `<EmptyState onSuggestionClick={handleSuggestionClick} />`
  - Test: `npm run dev` and verify welcome screen
  - Rollback: Restore original JSX

### Phase 3: Extract ChatHeader Component (Lines 608-720)
**Risk**: Medium | **Time**: 30 minutes | **Dependencies**: Phase 2

- [ ] **Step 3.1**: Create ChatHeader.tsx
  - File: `src/pages/ChatPage/components/ChatHeader.tsx`
  - Test: `touch src/pages/ChatPage/components/ChatHeader.tsx && ls -la`
  - Rollback: `rm src/pages/ChatPage/components/ChatHeader.tsx`

- [ ] **Step 3.2**: Define ChatHeader props interface
  ```typescript
  interface ChatHeaderProps {
    theme: string;
    toggleTheme: () => void;
    modelMode: 'fast' | 'smart';
    setModelMode: (mode: 'fast' | 'smart') => void;
    useHybridSearch: boolean;
    setUseHybridSearch: (value: boolean) => void;
    onTripPlanSubmit: (plan: string) => void;
  }
  ```
  - Test: `npx tsc --noEmit`
  - Rollback: Clear interface

- [ ] **Step 3.3**: Extract header JSX (lines 608-720)
  - Move entire header JSX to ChatHeader.tsx
  - Include all imports needed (Logo, TripPlanner, etc.)
  - Test: `npm run build`
  - Rollback: Restore to empty file

- [ ] **Step 3.4**: Import and use ChatHeader
  - Import in ChatPage.tsx
  - Replace lines 608-720 with `<ChatHeader {...headerProps} />`
  - Test: Full manual test checklist
  - Rollback: Restore inline JSX

### CHECKPOINT A: Phase 1-3 Validation
- [ ] Run full test suite: `npm run test:refactor`
- [ ] Build production: `npm run build:production`
- [ ] Manual test all toggles and buttons
- [ ] Verify localStorage persistence
- [ ] Check console for errors
- [ ] Screenshot comparison with original

### Phase 4: Extract ChatMessage Component (Lines 862-1026)
**Risk**: High | **Time**: 45 minutes | **Dependencies**: Phases 1-3

- [ ] **Step 4.1**: Create ChatMessage.tsx
  - File: `src/pages/ChatPage/components/ChatMessage.tsx`
  - Test: File exists
  - Rollback: Delete file

- [ ] **Step 4.2**: Define Message props interface
  ```typescript
  interface ChatMessageProps {
    message: Message;
    isCollapsed: boolean;
    onToggleCollapse: () => void;
    onCopy: () => void;
    onRegenerate: () => void;
    onVoice: () => void;
    currentModel: string;
    isLoading: boolean;
  }
  ```
  - Test: TypeScript compilation
  - Rollback: Clear interface

- [ ] **Step 4.3**: Extract user message rendering
  - Lines: 862-920 (user message branch)
  - Move to ChatMessage.tsx
  - Test: `npm run build`
  - Rollback: Restore inline

- [ ] **Step 4.4**: Extract assistant message rendering
  - Lines: 921-1026 (assistant message branch)
  - Merge with user rendering in ChatMessage.tsx
  - Test: Send test message, verify rendering
  - Rollback: Restore inline

- [ ] **Step 4.5**: Import and use ChatMessage
  - Replace message map with ChatMessage component
  - Test: Full conversation flow
  - Rollback: Restore inline rendering

### Phase 5: Extract useStreamingChat Hook (Lines 259-497)
**Risk**: High | **Time**: 60 minutes | **Dependencies**: Phases 1-4

- [ ] **Step 5.1**: Create useStreamingChat.ts
  - File: `src/pages/ChatPage/hooks/useStreamingChat.ts`
  - Test: File created
  - Rollback: Delete file

- [ ] **Step 5.2**: Define hook signature
  ```typescript
  export function useStreamingChat(config: StreamConfig) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    // ... 
    return { messages, sendMessage, isLoading };
  }
  ```
  - Test: TypeScript check
  - Rollback: Clear file

- [ ] **Step 5.3**: Move SSE event type definitions
  - Lines: Define StreamEvent interface
  - Test: `npx tsc --noEmit`
  - Rollback: Remove interface

- [ ] **Step 5.4**: Extract handleSendMessage logic (part 1)
  - Lines: 259-350 (setup and request creation)
  - Move to hook
  - Test: Build test
  - Rollback: Restore inline

- [ ] **Step 5.5**: Extract handleSendMessage logic (part 2)
  - Lines: 351-420 (SSE parsing)
  - Move to hook
  - Test: Send message test
  - Rollback: Restore inline

- [ ] **Step 5.6**: Extract handleSendMessage logic (part 3)
  - Lines: 421-497 (error handling)
  - Move to hook
  - Test: Force error, verify handling
  - Rollback: Restore inline

- [ ] **Step 5.7**: Use useStreamingChat in ChatPage
  - Replace inline logic with hook
  - Test: Complete chat flow
  - Rollback: Restore inline logic

### CHECKPOINT B: Phase 4-5 Validation
- [ ] Full regression test suite
- [ ] Performance benchmark comparison
- [ ] Memory leak check
- [ ] SSE streaming verification
- [ ] Error handling test

### Phase 6: Extract ChatInput Component (Lines 1072-1261)
**Risk**: Medium | **Time**: 40 minutes | **Dependencies**: Phases 1-5

- [ ] **Step 6.1**: Create ChatInput.tsx
  - File: `src/pages/ChatPage/components/ChatInput.tsx`
  - Test: File exists
  - Rollback: Delete file

- [ ] **Step 6.2**: Define ChatInput props
  ```typescript
  interface ChatInputProps {
    input: string;
    setInput: (value: string) => void;
    onSend: () => void;
    isLoading: boolean;
    showInlineCommand: boolean;
    // ... other props
  }
  ```
  - Test: TypeScript check
  - Rollback: Clear interface

- [ ] **Step 6.3**: Extract input field JSX
  - Lines: 1072-1150
  - Move to ChatInput.tsx
  - Test: Input field renders
  - Rollback: Restore inline

- [ ] **Step 6.4**: Extract command palette
  - Lines: 1151-1220
  - Include in ChatInput.tsx
  - Test: Command palette opens
  - Rollback: Restore inline

- [ ] **Step 6.5**: Extract action buttons
  - Lines: 1221-1261
  - Include in ChatInput.tsx
  - Test: All buttons functional
  - Rollback: Restore inline

- [ ] **Step 6.6**: Import and use ChatInput
  - Replace inline input area
  - Test: Send message flow
  - Rollback: Restore inline

### Phase 7: Extract HelpDialog Component (Lines 1266-1374)
**Risk**: Low | **Time**: 20 minutes | **Dependencies**: Phases 1-6

- [ ] **Step 7.1**: Create HelpDialog.tsx
  - File: `src/pages/ChatPage/components/HelpDialog.tsx`
  - Test: File exists
  - Rollback: Delete file

- [ ] **Step 7.2**: Extract help content to constants
  - File: `src/pages/ChatPage/constants/helpContent.ts`
  - Lines: Help text from dialog
  - Test: Import works
  - Rollback: Delete constants file

- [ ] **Step 7.3**: Move dialog JSX
  - Lines: 1266-1374
  - Move to HelpDialog.tsx
  - Test: Dialog opens
  - Rollback: Restore inline

- [ ] **Step 7.4**: Import and use HelpDialog
  - Replace inline dialog
  - Test: Help button functionality
  - Rollback: Restore inline

### Phase 8: Extract Remaining Hooks
**Risk**: Low | **Time**: 30 minutes | **Dependencies**: Phases 1-7

- [ ] **Step 8.1**: Create useCommandPalette hook
  - File: `src/pages/ChatPage/hooks/useCommandPalette.ts`
  - Lines: 224-257 (keyboard handling)
  - Test: Cmd+K works
  - Rollback: Delete hook file

- [ ] **Step 8.2**: Create useScrollBehavior hook
  - Extract auto-scroll logic
  - Test: Scroll behavior
  - Rollback: Restore inline

- [ ] **Step 8.3**: Create useMessageOperations hook
  - Extract copy, regenerate functions
  - Test: Operations work
  - Rollback: Restore inline

### Phase 9: Final Cleanup
**Risk**: Low | **Time**: 15 minutes | **Dependencies**: All phases

- [ ] **Step 9.1**: Remove unused imports
  - Analyze and remove unused imports
  - Test: Build succeeds
  - Rollback: Restore imports

- [ ] **Step 9.2**: Organize remaining code
  - Group related state
  - Test: Functionality unchanged
  - Rollback: Restore organization

- [ ] **Step 9.3**: Add index.ts for exports
  - Create barrel export file
  - Test: Imports work
  - Rollback: Delete index.ts

### CHECKPOINT C: Final Validation
- [ ] Complete test suite execution
- [ ] Performance metrics comparison
- [ ] Bundle size analysis
- [ ] Visual regression testing
- [ ] Code coverage report
- [ ] Manual testing all features

## Emergency Procedures

### Full Rollback
```bash
# Restore original file
cp src/pages/ChatPage.tsx.backup.20250815_233414 src/pages/ChatPage.tsx

# Remove all extracted files
rm -rf src/pages/ChatPage/

# Rebuild
npm run build
```

### Partial Rollback to Checkpoint
```bash
# Checkpoint A (after Phase 3)
git checkout [commit-hash-checkpoint-a]

# Checkpoint B (after Phase 5)
git checkout [commit-hash-checkpoint-b]

# Checkpoint C (final)
git checkout [commit-hash-checkpoint-c]
```

### Test Suite Restoration
```bash
# Run baseline tests
npm run test:baseline

# Verify original functionality
npm run test:integration

# Check for regressions
npm run test:regression
```

## Success Criteria
- [ ] All original tests pass (100%)
- [ ] No performance regression >5%
- [ ] Code coverage maintained or improved
- [ ] No new warnings or errors
- [ ] Bundle size within 5% of original
- [ ] All manual test scenarios pass
- [ ] No visual differences in UI
- [ ] LocalStorage keys unchanged
- [ ] API calls identical
- [ ] SSE streaming unaffected

## Time Estimates
- **Total Estimated Time**: 4-6 hours
- **Phase 1-3**: 1 hour
- **Phase 4-5**: 2 hours
- **Phase 6-8**: 1.5 hours
- **Phase 9 & Testing**: 30 minutes

## Risk Matrix
| Phase | Risk | Impact | Mitigation |
|-------|------|--------|------------|
| 1-3 | Low | Minimal | Simple extractions |
| 4 | High | Message rendering | Extensive testing |
| 5 | High | Core chat function | Incremental extraction |
| 6-7 | Medium | UI interaction | Component testing |
| 8-9 | Low | Code organization | Easy rollback |

## Post-Refactoring Checklist
- [ ] Delete backup file after 1 week of stable operation
- [ ] Document any discovered issues
- [ ] Update team on refactoring completion
- [ ] Create maintenance guide for new structure
- [ ] Schedule code review session

## Notes
- Each step is designed to be atomic and independently testable
- Never skip testing, even for "trivial" changes
- If any test fails, stop immediately and investigate
- Maintain a log of any unexpected behaviors
- Consider pair programming for Phase 4-5 (high risk)

## Command Reference
```bash
# Quick test after each step
npm run build && echo "✅ Build OK" || echo "❌ Build Failed"

# Full validation
npm run test:refactor && npm run build:production

# Emergency restore
cp src/pages/ChatPage.tsx.backup.* src/pages/ChatPage.tsx
```

---
*Generated: 2025-08-15*
*Estimated Completion: 4-6 hours*
*Risk Level: Low-Medium with proper testing*