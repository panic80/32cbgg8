import { ReactNode } from 'react';
import { Zap, FileText, Menu } from 'lucide-react';

export interface WhatsNewUpdateItem {
  icon: ReactNode;
  text: string;
  description?: string;
}

export interface WhatsNewDateGroup {
  date: string; // human readable date label
  updates: WhatsNewUpdateItem[];
}

// Bump this when you add new release notes
export const WHATS_NEW_VERSION = '2025-09-16';

export const WHATS_NEW_BY_DATE: WhatsNewDateGroup[] = [
  {
    date: 'Tuesday, September 16, 2025',
    updates: [
      {
        icon: <Zap className="w-4 h-4" />,
        text: 'Chat replies feel snappier',
        description:
          'Streaming now reuses retrieval pipelines and avoids duplicate placeholders, so answers appear faster and cleaner.',
      },
    ],
  },
  {
    date: 'Thursday, August 28, 2025',
    updates: [
      {
        icon: <Zap className="w-4 h-4" />,
        text: 'Embedded FAM - Multi-organization support',
        description:
          'The chatbot now serves CFTDTI, CBI, NJC and FAM with tailored responses for each organization',
      },
    ],
  },
  {
    date: 'Wednesday, August 7, 2025',
    updates: [
      {
        icon: <Zap className="w-4 h-4" />,
        text: 'Implemented Fast (GPT 4) / Smart (GPT 5) toggle',
        description:
          'Use Fast for quick answers and Smart for in-depth, detailed but slower answers',
      },
      {
        icon: <FileText className="w-4 h-4" />,
        text: 'Added Short answer mode',
      },
      {
        icon: <Menu className="w-4 h-4" />,
        text: 'Added a consolidated menu',
      },
    ],
  },
];
