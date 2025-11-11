# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Philippine Telco News Aggregator - A React + TypeScript application that aggregates and analyzes telecommunications news from the Philippines using BuzzSumo API and Google Gemini AI, with PowerPoint presentation generation capabilities.

## Development Commands

```bash
# Install dependencies
npm install

# Run development server (default: http://localhost:3000)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Required Environment Variables

Create `.env.local` file with:
```bash
# Required
GEMINI_API_KEY=your_gemini_api_key_here
BUZZSUMO_API_KEY=your_buzzsumo_api_key_here

# Optional (for stock images when articles lack thumbnails)
VITE_PEXELS_API_KEY=your_pexels_api_key_here
VITE_UNSPLASH_ACCESS_KEY=your_unsplash_access_key_here
```

**Important:** Client-side environment variables in Vite must have the `VITE_` prefix. Server-side variables (accessed in Node.js during build) do not need this prefix.

## Architecture

### Data Flow

1. **News Fetching (Dual Source)**
   - `App.tsx` coordinates parallel fetching from both APIs using `Promise.allSettled()`
   - **BuzzSumo** (`services/buzzsumoService.ts`): Trending articles with engagement metrics (total shares, backlinks)
   - **Google Gemini** (`services/geminiService.ts`): AI-analyzed and summarized news with grounding citations

2. **Deduplication & Merging**
   - `mergeNewsWithBuzzSumo()` in `geminiService.ts` combines both sources
   - Deduplication uses URL normalization and title similarity (>80% match)
   - BuzzSumo articles preserve thumbnails for use in presentations

3. **Presentation Generation**
   - `generatePresentationFromNews()` sends merged data to Gemini with structured prompt
   - Returns typed `Presentation` object with slides array
   - Slide types: `title`, `news`, `significance`, `end`

4. **PowerPoint Export**
   - `PresentationViewer.tsx` handles export via `pptxgenjs` library
   - **Dual-method image conversion** (components/PresentationViewer.tsx:16-86):
     - **Method 1**: Direct `fetch()` with CORS mode (works for most images)
     - **Method 2**: Fallback using `Image` + `canvas` with `crossOrigin="anonymous"`
   - Images must be base64-encoded; URLs are converted client-side
   - CORS-blocked images (manilatimes.net, abante.com.ph) will be skipped with error logging

### Key Services

**`services/buzzsumoService.ts`:**
- `fetchPhilippineTelcoNews()`: Main entry point with comprehensive boolean query
- Aggressive filtering to exclude sports content (PBA, PVL, etc.)
- `validateTelcoRelevance()`: Filters false positives for ambiguous terms like "smart", "dito", "globe", "converge"
- Returns top 15 articles sorted by engagement

**`services/geminiService.ts`:**
- `fetchTelcoNews()`: Calls Gemini with search grounding for news retrieval
- `generatePresentationFromNews()`: Generates presentation slides with image descriptions
- `mergeNewsWithBuzzSumo()`: Intelligent deduplication and merging
- Pexels/Unsplash integration for stock images when thumbnails are missing

### Type System (`types.ts`)

All data structures are strictly typed:
- `NewsArticle`: Standard article format with thumbnails
- `BuzzSumoArticle`: Raw BuzzSumo response with engagement metrics
- `Presentation`: Slide-based presentation structure
- `Slide`: Union type supporting multiple slide layouts

### Component Structure

**Main Components:**
- `App.tsx`: Root component managing state and orchestrating data fetching
- `PresentationViewer.tsx`: Modal viewer with PowerPoint export functionality
- `BuzzSumoSection.tsx`: Displays trending news with engagement metrics
- `NewsCard.tsx`: Reusable card for displaying individual articles

## Critical Implementation Details

### BuzzSumo Search Query Construction

The boolean query in `fetchPhilippineTelcoNews()` uses:
- **Positive terms**: Company names, industry terms
- **Negative terms**: Sports-related keywords to exclude false positives (e.g., "Converge FiberXers" basketball team)
- **Country filter**: `Philippines` to ensure local relevance

### Image Conversion for PowerPoint

The `urlToBase64()` function implements a two-stage approach:
1. Try direct fetch (fast, works for CORS-friendly images)
2. Fall back to Image + Canvas (handles some CORS scenarios)
3. Skip image gracefully if both fail (logs clear error with ❌)

**Known limitations**: Images from domains without `Access-Control-Allow-Origin` header cannot be converted client-side. These will be skipped in PowerPoint exports but display fine in web UI.

### Gemini API Integration

- Uses `@google/genai` SDK with grounding for search
- Search grounding provides source citations that are parsed and merged
- **Grounding link fixing**: App attempts to match broken grounding links with BuzzSumo metadata by title matching
- Presentation generation uses structured prompts with JSON schema enforcement

### Error Handling Philosophy

- **BuzzSumo failures**: Non-critical - app continues with Gemini data only
- **Gemini failures**: Critical - displays error to user
- **Image conversion failures**: Logged but non-blocking for PowerPoint export
- All async operations use `Promise.allSettled()` for graceful degradation

## Common Gotchas

1. **Environment variables**: Client-side variables need `VITE_` prefix; accessed via `import.meta.env.VITE_*`
2. **CORS for images**: Some news sites block cross-origin image access; dual-method approach minimizes but doesn't eliminate this
3. **BuzzSumo date format**: Unix timestamps, not ISO strings
4. **Gemini grounding links**: May be broken; app fixes them by title matching against BuzzSumo metadata
5. **Sports filtering**: Very aggressive to avoid "Converge FiberXers" and "DITO" (Tagalog for "here") false positives

## Testing

Test scripts in root directory:
- `test-buzzsumo-filtering.js`: Validates BuzzSumo query and filtering logic
- `test-gemini-api.js`: Tests Gemini API integration
- Run with: `node <script-name>.js` (requires environment variables set)
