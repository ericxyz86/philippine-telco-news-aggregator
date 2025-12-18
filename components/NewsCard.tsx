
import React, { useState, useCallback } from 'react';
import { NewsArticle } from '../types';

interface NewsCardProps {
  article: NewsArticle;
}

const NewsCard: React.FC<NewsCardProps> = ({ article }) => {
  const [searchingForLink, setSearchingForLink] = useState(false);

  // Function to search for article on Google when link is broken
  const handleBrokenLinkClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setSearchingForLink(true);
    // Open Google search for the article title
    const searchQuery = encodeURIComponent(`${article.title} ${article.source.title}`);
    window.open(`https://www.google.com/search?q=${searchQuery}`, '_blank');
    setTimeout(() => setSearchingForLink(false), 1000);
  }, [article.title, article.source.title]);

  const isBroken = article._urlBroken;

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-lg hover:shadow-2xl transform hover:-translate-y-1 transition-all duration-300 flex flex-col h-full ${isBroken ? 'ring-2 ring-amber-400/50' : ''}`}>
      <div className="p-6 flex-grow">
        <div className="flex justify-between items-start mb-2 gap-2">
            <span className="inline-flex items-center bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs font-medium px-2.5 py-0.5 rounded-full">
                <svg className="w-3 h-3 mr-1.5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd"></path></svg>
                {article.date}
            </span>
            {isBroken && (
              <span className="inline-flex items-center bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-medium px-2 py-0.5 rounded-full" title="Original link unavailable">
                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6"></path>
                </svg>
                Link Issue
              </span>
            )}
        </div>
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3 leading-tight">{article.title}</h3>
        <p className="text-gray-600 dark:text-gray-300 mb-4 text-sm leading-relaxed">{article.summary}</p>

        <div className="mt-4">
            <h4 className="font-semibold text-gray-700 dark:text-gray-200 mb-2">Key Takeaways:</h4>
            <ul className="space-y-2">
                {article.takeaways.map((takeaway, index) => (
                    <li key={index} className="flex items-start">
                        <svg className="w-4 h-4 mr-2 mt-1 text-blue-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path></svg>
                        <span className="text-gray-600 dark:text-gray-300 text-sm">{takeaway}</span>
                    </li>
                ))}
            </ul>
        </div>
      </div>
      <div className="bg-gray-50 dark:bg-gray-700/50 px-6 py-4 rounded-b-xl mt-auto">
        {isBroken ? (
          <button
            onClick={handleBrokenLinkClick}
            disabled={searchingForLink}
            className="inline-flex items-center text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 font-semibold text-sm group disabled:opacity-50"
          >
            <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
            </svg>
            {searchingForLink ? 'Searching...' : 'Search for Article'}
            <svg className="w-4 h-4 ml-1 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3"></path></svg>
          </button>
        ) : (
          <a
            href={article.source.uri}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-semibold text-sm group"
          >
            Read Full Article
            <svg className="w-4 h-4 ml-1 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3"></path></svg>
          </a>
        )}
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate" title={article.source.title}>
            Source: {article.source.title}
        </p>
      </div>
    </div>
  );
};

export default NewsCard;
