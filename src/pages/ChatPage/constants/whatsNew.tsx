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
export const WHATS_NEW_VERSION = '2025-10-05';

export const WHATS_NEW_BY_DATE: WhatsNewDateGroup[] = [
  {
    date: 'Sunday, October 5, 2025',
    updates: [
      {
        icon: <Zap className="w-4 h-4" />,
        text: 'LangChain backend refresh',
        description:
          'Updated all LangChain imports to the new core modules and repaired the ensemble retriever weights for steadier answers.',
      },
    ],
  },
  {
    date: 'Wednesday, September 17, 2025',
    updates: [
      {
        icon: <FileText className="w-4 h-4" />,
        text: 'DOA Matrix and DOA Policy ingested',
        description:
          'Both documents are now part of the retrieval set so the chatbot can reference the latest guidance.',
      },
    ],
  },
  {
    date: 'Tuesday, September 16, 2025',
    updates: [
      {
        icon: <Zap className="w-4 h-4" />,
        text: 'Chat replies feel snappier',
        description:
          'Streaming now reuses retrieval pipelines and avoids duplicate placeholders, so answers appear faster and cleaner.',
      },
      {
        icon: <FileText className="w-4 h-4" />,
        text: 'New “How this chatbot works” overview',
        description:
          'Explore the retrieval pipeline, guardrails, and why RAG beats a raw LLM inside the new modal in the menu.',
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
