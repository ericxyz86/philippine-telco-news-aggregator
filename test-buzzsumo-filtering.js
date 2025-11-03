// Test BuzzSumo filtering functionality
import { fetchPhilippineTelcoNews } from './services/buzzsumoService.ts';

async function testFiltering() {
  console.log('Testing BuzzSumo filtering...\n');

  // Test with last 30 days
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30);

  const startDateStr = startDate.toISOString().split('T')[0];
  const endDateStr = endDate.toISOString().split('T')[0];

  console.log(`Date range: ${startDateStr} to ${endDateStr}\n`);

  try {
    const articles = await fetchPhilippineTelcoNews(startDateStr, endDateStr);

    console.log(`Total filtered articles: ${articles.length}\n`);

    if (articles.length > 0) {
      console.log('Sample filtered articles:\n');
      articles.slice(0, 5).forEach((article, index) => {
        console.log(`${index + 1}. ${article.title}`);
        console.log(`   Source: ${article.domain_name}`);
        console.log(`   URL: ${article.url}`);
        console.log(`   Engagement: ${article.engagement.total_shares} shares`);
        console.log('');
      });

      // Check for any sports-related content that slipped through
      const sportsKeywords = ['basketball', 'volleyball', 'pba', 'pvl', 'fiberxers', 'hitters'];
      const sportsArticles = articles.filter(article =>
        sportsKeywords.some(keyword => article.title.toLowerCase().includes(keyword))
      );

      if (sportsArticles.length > 0) {
        console.log('\n⚠️  WARNING: Found sports-related articles that passed the filter:');
        sportsArticles.forEach(article => {
          console.log(`   - ${article.title}`);
        });
      } else {
        console.log('\n✓ No sports-related articles found - filter is working!');
      }

      // Check for YouTube sources
      const youtubeArticles = articles.filter(article =>
        article.domain_name.toLowerCase().includes('youtube')
      );

      if (youtubeArticles.length > 0) {
        console.log('\n⚠️  WARNING: Found YouTube articles that passed the filter:');
        youtubeArticles.forEach(article => {
          console.log(`   - ${article.title} (${article.domain_name})`);
        });
      } else {
        console.log('✓ No YouTube articles found - filter is working!');
      }
    } else {
      console.log('⚠️  No articles returned. This might indicate the filter is too strict.');
    }

  } catch (error) {
    console.error('Error testing filtering:', error.message);
  }
}

testFiltering();
