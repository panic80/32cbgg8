import type { LucideIcon } from 'lucide-react';
import { FileText, Info, Landmark, Mail, ShieldCheck } from 'lucide-react';
import type { Locale } from '@/i18n/types';
import { landingCopy } from '@/i18n/landingCopy';

export type LandingFeatureKind = 'link' | 'action' | 'maintenance' | 'disabled';

export interface LandingFeature {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  kind: LandingFeatureKind;
  to?: string;
  badge?: string;
  disabledTooltip?: string;
  linkTitle?: string;
  itemType?: string;
  itemID?: string;
}

export interface LandingFooterLink {
  id: 'about' | 'contact' | 'privacy';
  label: string;
  icon: LucideIcon;
}

export const getLandingFeatures = (locale: Locale): LandingFeature[] => {
  const copy = landingCopy[locale];

  return [
    {
      id: 'doaList',
      title: copy.features.doaList.title,
      description: copy.features.doaList.description,
      icon: FileText,
      kind: 'link',
      to: 'https://018gc.sharepoint.com/sites/ORG-03658-000-000/Lists/DOA_Filtered_cleaned/AllItems.aspx?CID=9de1ffbd%2D848e%2D456e%2Da1e8%2D1ba6046c7c2a',
      linkTitle:
        'https://018gc.sharepoint.com/sites/org-03658-000-000/lists/doa_filtered_cleaned/allitems.aspx?cid=9de1ffbd%2d848e%2d456e%2da1e8%2d1ba6046c7c2a',
      itemType: 'http://schema.skype.com/HyperLink/Files',
      itemID: '93040afd-2ef9-4634-bb08-a0c664de7e80',
    },
    {
      id: 'scipPortal',
      title: copy.features.scipPortal.title,
      description: copy.features.scipPortal.description,
      icon: FileText,
      kind: 'action',
    },
    {
      id: 'npf',
      title: copy.features.npf.title,
      description: copy.features.npf.description,
      icon: Landmark,
      kind: 'link',
      to: `/npp?lang=${locale}`,
    },
  ];
};

export const landingFeatures: LandingFeature[] = getLandingFeatures('en');

export const footerLinks: LandingFooterLink[] = [
  {
    id: 'about',
    label: 'About',
    icon: Info,
  },
  {
    id: 'contact',
    label: 'Contact',
    icon: Mail,
  },
  {
    id: 'privacy',
    label: 'Privacy',
    icon: ShieldCheck,
  },
];
