import React from 'react';
import { BuzzSumoArticle } from '../types';

interface BuzzSumoSectionProps {
  articles: BuzzSumoArticle[];
}

const BuzzSumoSection: React.FC<BuzzSumoSectionProps> = ({ articles }) => {
  if (articles.length === 0) {
    return null;
  }

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  };

  return (
    <div className="mb-12">
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Trending & Most Shared News
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Popular articles based on social engagement and shares
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {articles.map((article, index) => (
          <div
            key={index}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-lg hover:shadow-2xl transform hover:-translate-y-1 transition-all duration-300 flex flex-col h-full"
          >
            {/* Thumbnail if available */}
            {article.thumbnail && (
              <div className="w-full h-48 overflow-hidden rounded-t-xl">
                <img
                  src={article.thumbnail}
                  alt={article.title}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
            )}

            <div className="p-6 flex-grow">
              {/* Date and Domain */}
              <div className="flex justify-between items-start mb-3">
                <span className="inline-flex items-center bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-300 text-xs font-medium px-2.5 py-0.5 rounded-full">
                  <svg
                    className="w-3 h-3 mr-1.5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      fillRule="evenodd"
                      d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z"
                      clipRule="evenodd"
                    ></path>
                  </svg>
                  {article.published_date}
                </span>
              </div>

              {/* Title */}
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3 leading-tight line-clamp-3">
                {article.title}
              </h3>

              {/* Excerpt if available */}
              {article.excerpt && (
                <p className="text-gray-600 dark:text-gray-300 mb-4 text-sm leading-relaxed line-clamp-3">
                  {article.excerpt}
                </p>
              )}

              {/* Engagement Metrics */}
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <h4 className="font-semibold text-gray-700 dark:text-gray-200 mb-3 text-sm">
                  Engagement Metrics:
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  {/* Total Shares */}
                  <div className="flex items-center space-x-2">
                    <svg
                      className="w-5 h-5 text-blue-500"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z"></path>
                    </svg>
                    <div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Total Shares
                      </div>
                      <div className="font-bold text-gray-900 dark:text-white">
                        {formatNumber(article.engagement.total_shares)}
                      </div>
                    </div>
                  </div>

                  {/* Backlinks */}
                  {article.engagement.total_links !== undefined && (
                    <div className="flex items-center space-x-2">
                      <svg
                        className="w-5 h-5 text-green-500"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          fillRule="evenodd"
                          d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z"
                          clipRule="evenodd"
                        ></path>
                      </svg>
                      <div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          Backlinks
                        </div>
                        <div className="font-bold text-gray-900 dark:text-white">
                          {formatNumber(article.engagement.total_links)}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Facebook Shares */}
                  {article.engagement.facebook_shares !== undefined &&
                    article.engagement.facebook_shares > 0 && (
                      <div className="flex items-center space-x-2">
                        <svg
                          className="w-5 h-5 text-blue-600"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                        </svg>
                        <div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            Facebook
                          </div>
                          <div className="font-bold text-gray-900 dark:text-white">
                            {formatNumber(article.engagement.facebook_shares)}
                          </div>
                        </div>
                      </div>
                    )}

                  {/* Evergreen Score */}
                  {article.engagement.evergreen_score !== undefined &&
                    article.engagement.evergreen_score > 0 && (
                      <div className="flex items-center space-x-2">
                        <svg
                          className="w-5 h-5 text-emerald-500"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            fillRule="evenodd"
                            d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                            clipRule="evenodd"
                          ></path>
                        </svg>
                        <div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            Evergreen
                          </div>
                          <div className="font-bold text-gray-900 dark:text-white">
                            {article.engagement.evergreen_score.toFixed(1)}
                          </div>
                        </div>
                      </div>
                    )}
                </div>
              </div>
            </div>

            {/* Footer with link */}
            <div className="bg-purple-50 dark:bg-purple-900/20 px-6 py-4 rounded-b-xl mt-auto">
              <a
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-300 font-semibold text-sm group"
              >
                Read Full Article
                <svg
                  className="w-4 h-4 ml-1 transform group-hover:translate-x-1 transition-transform"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M17 8l4 4m0 0l-4 4m4-4H3"
                  ></path>
                </svg>
              </a>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">
                Source: {article.domain_name}
              </p>
              {article.author && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  By: {article.author}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default BuzzSumoSection;
