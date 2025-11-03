import React, { useState, useCallback } from 'react';
import { NewsArticle, CompanyNewsSection, Presentation, NewsData, BuzzSumoArticle } from './types';
import { fetchTelcoNews, generatePresentationFromNews, mergeNewsWithBuzzSumo } from './services/geminiService';
import { fetchPhilippineTelcoNews } from './services/buzzsumoService';
import Header from './components/Header';
import NewsCard from './components/NewsCard';
import LoadingSpinner from './components/LoadingSpinner';
import PresentationViewer from './components/PresentationViewer';
import BuzzSumoSection from './components/BuzzSumoSection';


const getFormattedDate = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

const App: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(false);
  const [generatingPresentation, setGeneratingPresentation] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [newsData, setNewsData] = useState<NewsData | null>(null);
  const [buzzsumoArticles, setBuzzsumoArticles] = useState<BuzzSumoArticle[]>([]);
  const [presentation, setPresentation] = useState<Presentation | null>(null);

  const [hasFetched, setHasFetched] = useState<boolean>(false);

  const today = new Date();
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(today.getDate() - 7);
    
  const [startDate, setStartDate] = useState<string>(getFormattedDate(oneWeekAgo));
  const [endDate, setEndDate] = useState<string>(getFormattedDate(today));
  
  const handleFetchNews = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNewsData(null);
    setBuzzsumoArticles([]);
    setPresentation(null);
    setHasFetched(true);

    try {
      // Fetch from both sources in parallel
      const [geminiResult, buzzsumoResult] = await Promise.allSettled([
        fetchTelcoNews(startDate, endDate),
        fetchPhilippineTelcoNews(startDate, endDate),
      ]);

      // Handle Gemini results
      if (geminiResult.status === 'fulfilled') {
        setNewsData(geminiResult.value.data);
      } else {
        console.error('Gemini API error:', geminiResult.reason);
        throw geminiResult.reason;
      }

      // Handle BuzzSumo results (graceful degradation)
      if (buzzsumoResult.status === 'fulfilled') {
        setBuzzsumoArticles(buzzsumoResult.value);
      } else {
        console.warn('BuzzSumo API error (non-critical):', buzzsumoResult.reason);
        // Don't throw error for BuzzSumo failures - it's supplementary
      }
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred. Please check the console for details.');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  const handleGeneratePresentation = useCallback(async () => {
    if (!newsData) return;
    setGeneratingPresentation(true);
    setError(null);
    try {
      // Merge BuzzSumo articles with Google News before generating presentation
      const mergedData = mergeNewsWithBuzzSumo(newsData, buzzsumoArticles);
      const presentationData = await generatePresentationFromNews(mergedData, `${startDate} to ${endDate}`);
      setPresentation(presentationData);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred while generating the presentation.');
    } finally {
      setGeneratingPresentation(false);
    }
  }, [newsData, buzzsumoArticles, startDate, endDate]);

  const renderContent = () => {
    if (loading) {
      return (
        <div className="text-center py-10">
          <LoadingSpinner />
          <p className="mt-4 text-lg text-gray-600 dark:text-gray-300">
            Searching for the latest telco news...
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            This may take a moment as we analyze and summarize articles.
          </p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="text-center py-10 px-4">
          <div className="bg-red-100 dark:bg-red-900/20 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg relative" role="alert">
            <strong className="font-bold">Error: </strong>
            <span className="block sm:inline">{error}</span>
          </div>
        </div>
      );
    }

    if (!hasFetched) {
        return (
            <div className="text-center py-10">
                <p className="text-gray-600 dark:text-gray-300">Select a date range and click the button to fetch the latest news.</p>
            </div>
        )
    }
    
    if (!newsData || (newsData.internationalNews.length === 0 && newsData.generalNews.length === 0 && newsData.companyNews.every(c => c.articles.length === 0))) {
      return (
        <div className="text-center py-10">
          <p className="text-gray-600 dark:text-gray-300">
            No important news articles were found matching the criteria. Please try a different date range.
          </p>
        </div>
      );
    }
    
    const { internationalNews, generalNews, companyNews } = newsData;

    return (
      <div className="space-y-12">
        {/* BuzzSumo Trending News Section */}
        <BuzzSumoSection articles={buzzsumoArticles} />

        {internationalNews.length > 0 && (
          <section>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-white mb-6 pb-2 border-b-2 border-purple-500">
              Global News with Philippine Impact
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {internationalNews.map((article, index) => (
                <NewsCard key={`international-${index}`} article={article} />
              ))}
            </div>
          </section>
        )}
        {generalNews.length > 0 && (
          <section>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-white mb-6 pb-2 border-b-2 border-blue-500">
              General Industry News
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {generalNews.map((article, index) => (
                <NewsCard key={`general-${index}`} article={article} />
              ))}
            </div>
          </section>
        )}
        {companyNews.length > 0 && (
          <section>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-white mb-6 pb-2 border-b-2 border-green-500">
              Company-Specific News
            </h2>
            <div className="space-y-10">
              {companyNews.map((companySection) => (
                <div key={companySection.companyName}>
                  <h3 className="text-xl font-bold text-gray-700 dark:text-gray-200 mb-4 tracking-wide">{companySection.companyName}</h3>
                  {companySection.articles.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {companySection.articles.map((article, index) => (
                        <NewsCard key={`${companySection.companyName}-${index}`} article={article} />
                      ))}
                    </div>
                  ) : (
                    <div className="bg-white dark:bg-gray-800/50 rounded-lg p-6 text-center shadow-sm">
                      <p className="text-gray-600 dark:text-gray-300">
                        No important news found for {companySection.companyName} in the selected date range.
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    );
  };
  
  const isDateRangeValid = startDate && endDate && startDate <= endDate;
  const hasNews = newsData && (newsData.internationalNews.length > 0 || newsData.generalNews.length > 0 || newsData.companyNews.some(c => c.articles.length > 0));

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-sans">
      <Header />
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md mb-8 max-w-2xl mx-auto">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">Select Date Range</h2>
            <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                    <label htmlFor="start-date" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start Date</label>
                    <input
                        type="date"
                        id="start-date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                        max={endDate}
                    />
                </div>
                <div className="flex-1">
                    <label htmlFor="end-date" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End Date</label>
                    <input
                        type="date"
                        id="end-date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                        min={startDate}
                        max={getFormattedDate(new Date())}
                    />
                </div>
            </div>
        </div>

        <div className="text-center mb-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <button
            onClick={handleFetchNews}
            disabled={loading || generatingPresentation || !isDateRangeValid}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 dark:disabled:bg-blue-800/50 text-white font-bold py-3 px-8 rounded-full shadow-lg transform hover:scale-105 transition-transform duration-300 ease-in-out focus:outline-none focus:ring-4 focus:ring-blue-300 dark:focus:ring-blue-800 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
          >
            {loading ? 'Fetching...' : 'Fetch Telco News'}
          </button>
          
          {hasNews && (
            <button
                onClick={handleGeneratePresentation}
                disabled={loading || generatingPresentation}
                className="bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 dark:disabled:bg-purple-800/50 text-white font-bold py-3 px-8 rounded-full shadow-lg transform hover:scale-105 transition-transform duration-300 ease-in-out focus:outline-none focus:ring-4 focus:ring-purple-300 dark:focus:ring-purple-800 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none flex items-center justify-center gap-2"
            >
                {generatingPresentation ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Generating...
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M10 3.5a1.5 1.5 0 011.5 1.5v2.324l3.18-1.59A1.5 1.5 0 0116.5 7v6a1.5 1.5 0 01-1.82 1.406l-3.18-1.59V15a1.5 1.5 0 01-3 0V5A1.5 1.5 0 0110 3.5zM4 5a1.5 1.5 0 00-1.5 1.5v7A1.5 1.5 0 004 15h1a1.5 1.5 0 001.5-1.5v-7A1.5 1.5 0 005 5H4z" />
                    </svg>
                    Generate Presentation
                  </>
                )}
            </button>
          )}
          {!isDateRangeValid && (
              <p className="text-red-500 text-sm mt-2 sm:absolute sm:bottom-0 sm:left-1/2 sm:-translate-x-1/2 sm:w-full">Start date cannot be after the end date.</p>
          )}
        </div>

        {renderContent()}
      </main>
      {presentation && (
        <PresentationViewer presentation={presentation} onClose={() => setPresentation(null)} />
      )}
    </div>
  );
};

export default App;
