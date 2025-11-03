// Test final output that will be displayed in the app
import { fetchPhilippineTelcoNews } from './services/buzzsumoService.ts';

async function testFinalOutput() {
  console.log('Testing final filtered output (what users will see)...\n');

  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30);

  const startDateStr = startDate.toISOString().split('T')[0];
  const endDateStr = endDate.toISOString().split('T')[0];

  try {
    const articles = await fetchPhilippineTelcoNews(startDateStr, endDateStr);

    console.log(`✓ Total articles after all filters: ${articles.length}\n`);
    console.log('=== FINAL ARTICLES TO DISPLAY ===\n');

    articles.forEach((article, index) => {
      console.log(`${index + 1}. ${article.title}`);
      console.log(`   Source: ${article.domain_name}`);
      console.log(`   Published: ${article.published_date}`);
      console.log(`   Engagement: ${article.engagement.total_shares} shares`);

      // Flag any suspicious articles
      const title = article.title.toLowerCase();
      const warnings = [];

      if (title.includes('smart meter') || title.includes('smart grid')) {
        warnings.push('⚠️  Contains "smart meter/grid"');
      }
      if (title.includes('smart economics')) {
        warnings.push('⚠️  Contains "smart economics"');
      }
      if (title.includes('dito') && !title.includes('dito telecom')) {
        warnings.push('⚠️  Contains "dito" (possibly Tagalog)');
      }
      if (title.includes('volleyball') || title.includes('basketball')) {
        warnings.push('⚠️  Sports content');
      }
      if (title.includes('pvl') || title.includes('pba')) {
        warnings.push('⚠️  Sports league');
      }

      if (warnings.length > 0) {
        warnings.forEach(w => console.log(`   ${w}`));
      }

      console.log('');
    });

    // Summary statistics
    console.log('\n=== FILTER EFFECTIVENESS ===');
    const sportsCount = articles.filter(a => {
      const t = a.title.toLowerCase();
      return t.includes('volleyball') || t.includes('basketball') ||
             t.includes('pvl') || t.includes('pba');
    }).length;

    const smartMeterCount = articles.filter(a => {
      const t = a.title.toLowerCase();
      return t.includes('smart meter') || t.includes('smart grid') ||
             t.includes('smart economics');
    }).length;

    const ditoTagalogCount = articles.filter(a => {
      const t = a.title.toLowerCase();
      return t.includes('dito') && !t.includes('dito telecom') &&
             !t.includes('dito network');
    }).length;

    console.log(`Sports articles: ${sportsCount} (should be 0)`);
    console.log(`Smart meter/economics: ${smartMeterCount} (should be 0)`);
    console.log(`Dito (Tagalog): ${ditoTagalogCount} (should be 0)`);

    if (sportsCount === 0 && smartMeterCount === 0 && ditoTagalogCount === 0) {
      console.log('\n✅ All filters working correctly!');
    } else {
      console.log('\n⚠️  Some false positives still present. Review filters.');
    }

  } catch (error) {
    console.error('Error:', error.message);
  }
}

testFinalOutput();
