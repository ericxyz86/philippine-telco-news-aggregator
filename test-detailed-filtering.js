// Detailed test to see what articles are being filtered and why
import { fetchBuzzSumoNews } from './services/buzzsumoService.ts';

async function testDetailedFiltering() {
  console.log('Testing detailed filtering to identify false positives...\n');

  // Test with last 30 days
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30);

  const startDateStr = startDate.toISOString().split('T')[0];
  const endDateStr = endDate.toISOString().split('T')[0];

  const comprehensiveQuery =
    'telecom OR telecoms OR telecommunications OR dict OR ntc OR ' +
    '"globe telecom" OR "dito telecoms" OR "dito telecommunity" OR ' +
    '"converge ict" OR "smart communications" OR pldt OR "sky fiber" OR ' +
    'globe OR smart OR converge OR dito ' +
    '-golden -pvl -pba -basketball -volleyball -nba -fiba -uaap -ncaa ' +
    '-gilas -"converge fiberxers" -traded -debut -match -"high speed hitters"';

  try {
    const articles = await fetchBuzzSumoNews({
      query: comprehensiveQuery,
      startDate: startDateStr,
      endDate: endDateStr,
      country: "Philippines",
      limit: 50,
    });

    console.log(`Total articles fetched: ${articles.length}\n`);

    // Categorize articles
    const smartMeterArticles = articles.filter(a =>
      a.title.toLowerCase().includes('smart meter') ||
      a.title.toLowerCase().includes('smart grid') ||
      a.title.toLowerCase().includes('smart city')
    );

    const ditoTagalogArticles = articles.filter(a => {
      const title = a.title.toLowerCase();
      return (title.includes('dito sa') ||
              title.includes('dito ang') ||
              title.includes('dito na') ||
              (title.includes('dito') && !title.includes('dito telecom')));
    });

    const globeFalsePositives = articles.filter(a =>
      a.title.toLowerCase().includes('vendée globe') ||
      a.title.toLowerCase().includes('golden globe')
    );

    const smartEconomicsArticles = articles.filter(a =>
      a.title.toLowerCase().includes('smart economics')
    );

    console.log('=== POTENTIAL FALSE POSITIVES FOUND ===\n');

    if (smartMeterArticles.length > 0) {
      console.log(`Smart Meter/Grid/City articles (${smartMeterArticles.length}):`);
      smartMeterArticles.forEach(a => console.log(`  - ${a.title}`));
      console.log('');
    }

    if (smartEconomicsArticles.length > 0) {
      console.log(`Smart Economics articles (${smartEconomicsArticles.length}):`);
      smartEconomicsArticles.forEach(a => console.log(`  - ${a.title}`));
      console.log('');
    }

    if (ditoTagalogArticles.length > 0) {
      console.log(`"Dito" (Tagalog) articles (${ditoTagalogArticles.length}):`);
      ditoTagalogArticles.forEach(a => console.log(`  - ${a.title}`));
      console.log('');
    }

    if (globeFalsePositives.length > 0) {
      console.log(`Globe false positives (${globeFalsePositives.length}):`);
      globeFalsePositives.forEach(a => console.log(`  - ${a.title}`));
      console.log('');
    }

    // Show legitimate telco articles
    const legitTelcoArticles = articles.filter(a => {
      const title = a.title.toLowerCase();
      return (
        title.includes('pldt') ||
        title.includes('globe telecom') ||
        title.includes('dito telecom') ||
        title.includes('converge ict') ||
        title.includes('smart communications') ||
        title.includes('telecommunications') ||
        title.includes('5g') ||
        title.includes('fiber') ||
        title.includes('broadband')
      );
    });

    console.log(`\n=== LEGITIMATE TELCO ARTICLES (${legitTelcoArticles.length}) ===\n`);
    legitTelcoArticles.slice(0, 10).forEach((a, i) => {
      console.log(`${i + 1}. ${a.title}`);
      console.log(`   Source: ${a.domain_name}`);
      console.log('');
    });

  } catch (error) {
    console.error('Error:', error.message);
  }
}

testDetailedFiltering();
