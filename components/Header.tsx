
import React from 'react';

const Header: React.FC = () => {
  return (
    <header className="bg-white dark:bg-gray-800 shadow-md">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 text-center">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-800 dark:text-white tracking-tight">
          Philippine Telco News Aggregator
        </h1>
        <p className="mt-2 text-md sm:text-lg text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
          Using Gemini with Google Search to deliver verified, summarized news on the Philippine telecommunications industry.
        </p>
      </div>
    </header>
  );
};

export default Header;
