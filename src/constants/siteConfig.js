// Site-wide configuration constants

export const SITE_CONFIG = {
  // Last update date - Update this when making significant changes
  LAST_UPDATED: 'September 4, 2025',
  
  // Site information
  SITE_NAME: 'G8 Administration Hub',
  SITE_DESCRIPTION: 'Streamlined Military Administration Portal',
  
  // Copyright information
  COPYRIGHT_YEAR: new Date().getFullYear(),
  COPYRIGHT_TEXT: 'G8 Administration Hub. All rights reserved. Not affiliated with DND or CAF.',
  
  // Contact information
  CONTACT_EMAIL: 'g8@sent.com',
  
  // External links
  // Keep the link minimal; PowerApps handles auth/selection. Avoid extra params that can cause issues on mobile.
  SCIP_PORTAL_URL: 'https://apps.powerapps.com/play/e/default-325b4494-1587-40d5-bb31-8b660b7f1038/a/75e3789b-9c1d-4feb-9515-20665ab7d6e8?tenantId=325b4494-1587-40d5-bb31-8b660b7f1038',
  CFTDTI_URL: 'https://www.canada.ca/en/department-national-defence/services/benefits-military/pay-pension-benefits/benefits/canadian-forces-temporary-duty-travel-instructions.html',
  NJC_TRAVEL_URL: 'https://www.njc-cnm.gc.ca/directive/d10/en',
};

// Helper function to get formatted copyright text
export const getCopyrightText = () => {
  return `© ${SITE_CONFIG.COPYRIGHT_YEAR} ${SITE_CONFIG.COPYRIGHT_TEXT}`;
};

// Helper function to get last updated text
export const getLastUpdatedText = () => {
  return `Last updated: ${SITE_CONFIG.LAST_UPDATED}`;
};
