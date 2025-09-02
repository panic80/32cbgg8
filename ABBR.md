# Acronym/Abbreviation Management System Implementation

## Overview
Implemented a comprehensive centralized acronym and abbreviation management system for the Canadian Forces Travel Instructions chatbot. This system ensures consistent handling of military terminology across all services.

## What Was Implemented

### 1. Centralized Acronym Database
**File**: `/var/www/cbthis/rag-service/app/config/acronyms_glossary.json`
- Created comprehensive JSON database with 150+ military acronyms
- Organized into 12 categories:
  - military_general (CAF, CF, DND, CO, NCO, etc.)
  - travel_authority (TA, TD, ITA, GTA, CTA)
  - transportation (PMV, DCV, MSE, SVC)
  - allowances (SE, FOA, PLD, LDA, AIRCRA, SDA)
  - administrative (HG&E, F&E, IRP, BGRS, CFIRP, FSA)
  - accommodation (R&Q, CNL, SQ, PMQ, RHU)
  - locations_bases (NCR, CFB, ASU, CFSU)
  - ranks (Pte through Gen with all variations)
  - financial (CLPA, MTEC, FAA, TB, NJC)
  - medical (CF H Svcs, CDU, MIR, MEL)
  - operations (Op, Ex, ROTO, TAV, SAV)
  - time_date (COS, RFD, ETA, ETD)
- Each term includes: expansion, description, and variations

### 2. Glossary Loader Utility
**File**: `/var/www/cbthis/rag-service/app/utils/glossary_loader.py`
- Created GlossaryLoader class for centralized access
- Key methods:
  - `get_abbreviations()` - Get all abbreviations
  - `get_expansion(term)` - Get expansion for specific term
  - `expand_text(text)` - Expand abbreviations in text
  - `search_glossary(query)` - Search for terms
  - `get_all_variations(term)` - Get all variations of a term
- Singleton pattern with `get_glossary_loader()` function

### 3. Updated Query Enhancement Strategies

#### AbbreviationExpansionStrategy
**File**: `/var/www/cbthis/rag-service/app/unified_retrieval/strategies/query_enhancement.py`
- Added `use_centralized_glossary` parameter (default: True)
- Now loads abbreviations from centralized JSON
- Maintains backward compatibility with legacy abbreviations
- Uses `glossary_loader.expand_text()` for expansion

#### AdvancedQueryExpander
**File**: `/var/www/cbthis/rag-service/app/unified_retrieval/enhancements/query_expansion.py`
- Added `use_centralized_glossary` parameter (default: True)
- Loads abbreviations from centralized glossary
- Added `_get_legacy_abbreviations()` method for backward compatibility
- Updated `_expand_abbreviations()` to use glossary loader

### 4. API Endpoints
**File**: `/var/www/cbthis/rag-service/app/api/glossary.py`
- Created comprehensive glossary API:
  - `GET /api/glossary/` - Get all terms organized by category
  - `GET /api/glossary/search?q=term` - Search glossary
  - `GET /api/glossary/term/{term}` - Get specific term details
  - `POST /api/glossary/expand` - Expand acronyms in text
  - `GET /api/glossary/categories` - List all categories
  - `GET /api/glossary/abbreviations` - Get simple abbreviation dictionary
- Registered router in `app/main.py`

### 5. Frontend Components

#### GlossaryTooltip Component
**File**: `/var/www/cbthis/src/components/GlossaryTooltip.tsx`
- React component for acronym tooltips
- Fetches term details from API on hover
- Shows expansion, description, category, and variations
- Includes `wrapAcronymsWithTooltips()` utility function
- Pattern matches acronyms: 2-5 uppercase letters

#### GlossaryModal Component
**File**: `/var/www/cbthis/src/components/GlossaryModal.tsx`
- Full-screen modal for browsing all acronyms
- Features:
  - Search functionality
  - Category tabs
  - Alphabetical sorting
  - Shows all term details
- Accessible via Book icon in chat interface

### 6. Chat Interface Integration

#### Markdown Renderer Updates
**File**: `/var/www/cbthis/src/components/ui/markdown-renderer.tsx`
- Imported `wrapAcronymsWithTooltips` function
- Modified paragraph (`p`) component to process text for acronyms
- Modified list item (`li`) component to process text for acronyms
- Automatically adds tooltips to detected acronyms in chat responses

#### ChatPage Updates
**File**: `/var/www/cbthis/src/pages/ChatPage.tsx`
- Added Book icon import from lucide-react
- Added `showGlossaryModal` state
- Added GlossaryModal component
- Added glossary button next to help button
- Button opens the glossary modal

## How It Works

1. **Query Processing**: When a user submits a query containing acronyms:
   - AbbreviationExpansionStrategy expands acronyms using the centralized database
   - Both the acronym and expansion are included for better search results
   - Example: "What is the TD rate?" → "What is the (TD OR temporary duty) rate?"

2. **Response Display**: When displaying chat responses:
   - Markdown renderer detects acronyms (2-5 uppercase letters)
   - Wraps detected acronyms with GlossaryTooltip component
   - Users can hover over acronyms to see expansions and descriptions

3. **Glossary Access**: Users can:
   - Click the Book icon to browse all acronyms
   - Search for specific terms
   - Filter by category
   - See all variations of terms

## Next Steps / Improvements

1. **Add More Acronyms**: Continue expanding the glossary with more military terms
2. **Context-Aware Expansion**: Implement smart expansion based on context
3. **User Preferences**: Allow users to toggle glossary tooltips on/off
4. **Caching**: Implement frontend caching for glossary API calls
5. **Analytics**: Track which acronyms users look up most frequently
6. **Multilingual Support**: Add French translations for bilingual support

## Testing Checklist

- [ ] Verify RAG service starts without errors
- [ ] Test acronym expansion in queries
- [ ] Verify tooltips appear on hover in chat responses
- [ ] Test glossary modal search and filtering
- [ ] Check API endpoints return correct data
- [ ] Verify performance with many acronyms in text

## File Changes Summary

### Created Files:
- `/var/www/cbthis/rag-service/app/config/acronyms_glossary.json`
- `/var/www/cbthis/rag-service/app/utils/glossary_loader.py`
- `/var/www/cbthis/rag-service/app/api/glossary.py`
- `/var/www/cbthis/src/components/GlossaryTooltip.tsx`
- `/var/www/cbthis/src/components/GlossaryModal.tsx`

### Modified Files:
- `/var/www/cbthis/rag-service/app/unified_retrieval/strategies/query_enhancement.py`
- `/var/www/cbthis/rag-service/app/unified_retrieval/enhancements/query_expansion.py`
- `/var/www/cbthis/rag-service/app/main.py`
- `/var/www/cbthis/src/components/ui/markdown-renderer.tsx`
- `/var/www/cbthis/src/pages/ChatPage.tsx`