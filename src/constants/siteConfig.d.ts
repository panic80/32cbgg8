export interface SiteConfigType {
  LAST_UPDATED: string;
  SITE_NAME: string;
  SITE_DESCRIPTION: string;
  COPYRIGHT_YEAR: number;
  COPYRIGHT_TEXT: string;
  CONTACT_EMAIL: string;
  SCIP_PORTAL_URL: string;
  CFTDTI_URL: string;
  NJC_TRAVEL_URL: string;
}

export const SITE_CONFIG: SiteConfigType;
export function getCopyrightText(): string;
export function getLastUpdatedText(): string;
