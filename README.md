# Philippine Telco News Aggregator

A React + TypeScript application that aggregates and analyzes telecommunications news from the Philippines using BuzzSumo API and Google Gemini AI, with PowerPoint presentation generation capabilities.

## Features

- **Dual-source news aggregation**: Combines BuzzSumo trending articles with Gemini AI-analyzed news
- **AI-powered analysis**: Google Gemini provides summaries and key takeaways for each article
- **PowerPoint generation**: Export news summaries as professional presentations
- **Engagement metrics**: View total shares, backlinks, and evergreen scores from BuzzSumo
- **Smart deduplication**: Automatically removes duplicate articles from multiple sources
- **Broken URL handling**: Gracefully handles expired Google grounding links with search fallbacks

## Prerequisites

- Node.js (v18+)
- npm or yarn

## Environment Variables

Create a `.env.local` file in the project root:

```bash
# Required
GEMINI_API_KEY=your_gemini_api_key_here
BUZZSUMO_API_KEY=your_buzzsumo_api_key_here

# Optional (for stock images when articles lack thumbnails)
VITE_PEXELS_API_KEY=your_pexels_api_key_here
VITE_UNSPLASH_ACCESS_KEY=your_unsplash_access_key_here
```

## Run Locally

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set environment variables in `.env.local`

3. Run the development server:
   ```bash
   npm run dev
   ```

4. Open http://localhost:3000 in your browser

## Backend Server

The backend handles news fetching and URL validation:

```bash
cd backend
npm install
npm start
```

The backend runs on port 10000 and provides:
- `/health` - Health check endpoint
- `/api/news` - Fetch aggregated news
- `/api/presentation` - Generate presentation slides

## Build for Production

```bash
npm run build
npm run preview  # Preview the production build
```

## Architecture

### Data Flow

1. **News Fetching**: Parallel requests to BuzzSumo and Google Gemini APIs
2. **URL Validation**: Backend validates and resolves broken grounding URLs
3. **Deduplication**: Smart merging based on URL normalization and title similarity
4. **Presentation Generation**: Gemini generates slide content with image descriptions
5. **Export**: Client-side PowerPoint generation with pptxgenjs

### Broken URL Handling

Google Gemini's grounding API returns temporary redirect URLs that can expire. The app handles this gracefully:

1. **Detection**: URLs containing `vertexaisearch` or `grounding-api-redirect` are flagged
2. **Resolution**: Backend attempts to follow redirects and validate final URLs
3. **Matching**: Title similarity matching against BuzzSumo articles to find working URLs
4. **Fallback**: Broken URLs display a "Search for Article" button linking to Google search
5. **PowerPoint**: Exported slides use amber-colored Google search links for broken URLs

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS
- **Backend**: Node.js, Express
- **APIs**: Google Gemini AI, BuzzSumo, Pexels (optional)
- **Export**: pptxgenjs for PowerPoint generation

## License

MIT
