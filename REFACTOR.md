# Refactoring Plan for ChatPage.tsx

## Project Overview
- **File**: `/var/www/cbthis/src/pages/ChatPage.tsx`
- **Current Size**: 544 lines (post-initial extraction work)
- **Target Size**: ~200 lines (main orchestration only)
- **Remaining Extraction**: ~350 lines into modular components/hooks
- **Risk Level**: Low (UI-only refactoring, no logic changes)

## Additional Refactor Targets
- Break out chat view-model concerns from `src/pages/ChatPage.tsx` (state windowing, scroll tracking, command palette) into focused hooks/components so the page is a thin orchestrator. ✅ Hooks extracted (`useScrollBehavior`, `useCommandPalette`, `useMessageOperations`, `useMessageWindow`) but streaming and export helpers still inline.
- Restructure `src/pages/ChatPage/hooks/useStreamingChat.ts` so transport/parsing/state concerns are isolated (e.g., reducer + helpers) for easier testing and new SSE event support. ✅ Hook now uses a reducer + helper mappers; remaining follow-up is test coverage.
- Consolidate `src/components/PlaceAutocomplete.tsx` with the shared `usePlaceAutocomplete` hook to eliminate duplicate debounce/fetch logic while preserving advanced Google Maps behavior.
- Introduce a shared glossary data provider so `src/components/GlossaryTooltip.tsx` becomes a lightweight renderer instead of managing fetch/caching on every tooltip instance.
- Decompose `src/components/config/GlossaryConfig.tsx` into smaller subcomponents/hooks (list pane, editor form, import/export controls) to reduce rerenders and simplify maintenance.
- Split the state machine and scoring utilities out of `src/components/SuggestionController.tsx` into dedicated hooks/modules to improve readability and reusability.
- Convert `src/api/travelInstructions.js` to TypeScript (or add typed helpers) to replace the handwritten declaration file and catch API shape issues at compile time.
- Reduce `src/App.jsx` responsibilities (remove unused state, move route prefetching into a hook, consolidate nested `Suspense`) so navigation shell stays maintainable.
- Run a post-refactor cleanup pass (redundant/orphaned assets, backup files, stale feature toggles) to keep the tree lean once core extractions are finished.
- Remove legacy hybrid search toggle plumbing from `useStreamingChat` if the feature is sunset.
- Centralize glossary data fetching/caching so modal + tooltip consume a single provider.
- Consolidate Google Places autocomplete implementations into one code path.
- Extract ChatPage export helpers (Markdown/JSON) into utilities for reuse/testing.

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

### Phase 2: Extract EmptyState Component (Completed)
**Status**: ✅ `src/pages/ChatPage/components/EmptyState.tsx` owns the empty-state UI, including the categorized suggestions experiment.
**Follow-up**: Retire the legacy view once the `USE_CATEGORIZED_VIEW` flag is no longer needed.

### Phase 3: Extract ChatHeader Component (Completed)
**Status**: ✅ Header UI lives in `src/pages/ChatPage/components/ChatHeader.tsx` with focused props for theme, model mode, exports, and quick actions.
**Follow-up**: Consider memoising expensive dropdowns if rerenders become an issue.

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

### Phase 5: Extract useStreamingChat Hook (Completed)
**Status**: ✅ Refactored `useStreamingChat` with a reducer-driven state machine, helper mappers for sources/follow-ups, and a `setMessages` adapter that preserves existing consumers.
**Follow-up**: Add unit coverage around SSE edge cases (metadata-only, missing `complete` events) and consider isolating network transport for easier mocking.

### CHECKPOINT B: Phase 4-5 Validation
- [ ] Full regression test suite
- [ ] Performance benchmark comparison
- [ ] Memory leak check
- [ ] SSE streaming verification
- [ ] Error handling test

### Phase 6: Extract ChatInput Component (Completed)
**Status**: ✅ `src/pages/ChatPage/components/ChatInput.tsx` manages the footer, inline command palette, and send controls behind props.
**Follow-up**: Attachments feature flag remains off; plan separate story for upload UX once backend is ready.

### Phase 7: Extract HelpDialog Component (Completed)
**Status**: ✅ `src/pages/ChatPage/components/HelpDialog.tsx` encapsulates the shortcut primer with shared constants under `./constants`.
**Follow-up**: Evaluate externalising help copy if marketing needs runtime edits.

### Phase 8: Extract Remaining Hooks
**Risk**: Low | **Time**: 30 minutes | **Dependencies**: Phases 1-7

- [x] **Step 8.1**: Create useCommandPalette hook
  - File: `src/pages/ChatPage/hooks/useCommandPalette.ts`
  - Lines: 224-257 (keyboard handling)
  - Test: Cmd+K works
  - Rollback: Delete hook file

- [x] **Step 8.2**: Create useScrollBehavior hook
  - Extract auto-scroll logic
  - Test: Scroll behavior
  - Rollback: Restore inline

- [x] **Step 8.3**: Create useMessageOperations hook
  - Extract copy, regenerate functions
  - Test: Operations work
  - Rollback: Restore inline

### Phase 9: Final Cleanup
**Risk**: Low | **Time**: 15 minutes | **Dependencies**: All phases

- [x] **Step 9.1**: Remove unused imports
  - Analyze and remove unused imports
  - Test: Build succeeds
  - Rollback: Restore imports

- [x] **Step 9.2**: Organize remaining code
  - Group related state
  - Test: Functionality unchanged
  - Rollback: Restore organization

- [x] **Step 9.3**: Add index.ts for exports
  - Create barrel export file
  - Test: Imports work
  - Rollback: Delete index.ts

### Phase 10: Redundant Code Audit (Planned)
**Risk**: Low | **Time**: 45 minutes | **Dependencies**: Phase 9

- [ ] **Step 10.1**: Map usage of ChatPage component variants and helpers
  - Inspect `src/pages/ChatPage/components` for backups/alternate versions (e.g., `EmptyState.tsx.backup`, `HelpDialog` variants)
  - Use `rg` to trace imports and runtime entry points
  - Output findings list (keep/remove/merge) before edits

- [ ] **Step 10.2**: Audit shared components/assets for orphaned code
  - Scan `src/components`, `src/assets`, and public assets for unused exports
  - Cross-reference with route definitions and tests
  - Summarise candidates for removal/cleanup

- [ ] **Step 10.3**: Consolidate findings into actionable cleanup tasks
  - Decide on deletions vs feature-flag retention
  - Plan required tests (`npm run build`, targeted Vitest suites)
  - Document the intended changeset before modifying files

### Phase 11: Legacy Hybrid Search Removal (Completed)
**Risk**: Low | **Time**: 30 minutes | **Dependencies**: Phase 5

- [x] **Step 11.1**: Confirm hybrid search feature status with stakeholders/documentation *(deprecated internally; safe to remove)*
- [x] **Step 11.2**: Remove `useHybridSearch` wiring from `useStreamingChat` + ChatPage *(see commit removing toggle and request payload flag)*
- [x] **Step 11.3**: Clean up localStorage keys/migrations and update release notes/tests *(legacy key removed on mount; Vitest + build rerun)*

### Phase 12: Glossary Data Provider (Planned)
**Risk**: Medium | **Time**: 60 minutes | **Dependencies**: Phase 10

- [ ] **Step 12.1**: Outline shared data provider responsibilities (fetch, cache, invalidation)
- [ ] **Step 12.2**: Implement provider + context, refactor `GlossaryModal`/`GlossaryTooltip`
- [ ] **Step 12.3**: Add provider-focused tests and manual verification checklist

### Phase 13: Autocomplete Consolidation (Completed)
**Risk**: Medium | **Time**: 45 minutes | **Dependencies**: Phase 10

- [x] **Step 13.1**: Compare `PlaceAutocomplete` vs `PlaceAutocompleteSimple` to identify required API surface *(advanced `PlaceAutocomplete` component unused; TripPlanner uses simple path + backend proxy)*
- [x] **Step 13.2**: Merge implementations or add feature detection wrapper *(removed unused component to avoid duplicate logic; hook already handles server-backed predictions)*
- [x] **Step 13.3**: Update TripPlanner + tests and remove redundancies *(TripPlanner unaffected; build/tests re-run to confirm)*

### Phase 14: Export Helper Extraction (Planned)
**Risk**: Low | **Time**: 30 minutes | **Dependencies**: Phase 5

- [ ] **Step 14.1**: Move Markdown/JSON export helpers into `utils`
- [ ] **Step 14.2**: Update ChatPage to consume helpers and cover with unit tests
- [ ] **Step 14.3**: Review docs/Changelog for user-facing impact

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
