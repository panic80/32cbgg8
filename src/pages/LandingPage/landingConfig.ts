import type { LucideIcon } from 'lucide-react';
import { FileText, Users, Zap, Info, Mail, ShieldCheck } from 'lucide-react';

export type LandingFeatureKind = 'link' | 'action' | 'disabled';

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

export const landingFeatures: LandingFeature[] = [
  {
    id: 'doaList',
    title: '32 CBG DOA List',
    description: 'Access the current 32 CBG Delegation of Authority list in SharePoint.',
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
    title: 'SCIP Portal',
    description:
      'Streamlined Claims Interface Platform for efficient digital submission and processing of administrative claims.',
    icon: FileText,
    kind: 'action',
  },
  {
    id: 'opiContacts',
    title: 'OPI Contacts',
    description:
      "Find FSC & FMC contact information for your unit's financial services and management.",
    icon: Users,
    kind: 'link',
    to: '/opi',
  },
  {
    id: 'resources',
    title: 'Resources',
    description:
      'Access SOPs, how-to guides, FAQs, templates, and comprehensive administrative documentation.',
    icon: Zap,
    kind: 'link',
    to: '/resources',
    badge: 'Under Review',
  },
];

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
