import * as cheerio from 'cheerio';

/**
 * Process HTML content to extract main text while preserving structure hints.
 * Copied from server/main.js to ensure identical behavior and logs.
 */
export const processContent = (html) => {
  try {
    console.log('Starting HTML processing with cheerio...');

    const $ = cheerio.load(html, {
      decodeEntities: true,
      xmlMode: false,
    });

    console.log('Cheerio loaded HTML successfully');

    const scriptCount = $('script').length;
    const styleCount = $('style').length;
    const headerCount = $('header').length;
    const footerCount = $('footer').length;
    const navCount = $('nav').length;

    console.log(
      `Element counts before removal: scripts=${scriptCount}, styles=${styleCount}, headers=${headerCount}, footers=${footerCount}, navs=${navCount}`,
    );

    $('script, style, header, footer, nav').remove();

    let mainContent = '';
    const contentSelectors = [
      'main',
      'article',
      '.content',
      '#content',
      '.main-content',
      '.article-content',
      'div[role="main"]',
    ];

    for (const selector of contentSelectors) {
      if ($(selector).length > 0) {
        console.log(`Found content using selector: ${selector}`);
        mainContent = $(selector).text();
        break;
      }
    }

    if (!mainContent || mainContent.trim().length < 100) {
      console.log('Content selectors did not yield sufficient content, falling back to body');
      mainContent = $('body').text();
    }

    console.log(`Raw extracted text length: ${mainContent.length} characters`);

    const processedText = mainContent
      .replace(/\s+/g, ' ')
      .replace(/(\d+\.\d+\.?\d*)(\s+)/g, '\n$1$2')
      .replace(/(SECTION|Chapter|CHAPTER|Part|PART)\s+(\d+)/gi, '\n$1 $2')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(
        /([Ll]unch).+?(\d{1,2}[:\.]\d{2}).+?(\d{1,2}[:\.]\d{2})/g,
        (match, meal, start, end) => {
          return `${meal} may be claimed when duty travel extends through the period of ${start} to ${end}`;
        },
      )
      .replace(/([.!?])\s+/g, '$1\n')
      .trim();

    console.log(`Processed text length: ${processedText.length} characters`);

    return processedText;
  } catch (error) {
    console.error('Error processing HTML content:', error);
    try {
      return html
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/(\d+\.\d+\.?\d*)/g, '\n$1')
        .trim();
    } catch (fallbackError) {
      console.error('Even fallback processing failed:', fallbackError);
      throw new Error('Content processing failed completely');
    }
  }
};
