import React from 'react';
import { motion } from 'framer-motion';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Brain, Zap, ShieldCheck, ArrowRight, CheckCircle2 } from 'lucide-react';

interface HowItWorksModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const sections = [
  {
    title: '1. Smart retrieval first',
    icon: <Brain className="w-5 h-5 text-[var(--primary)]" />,
    description:
      'Each question fans out through a cached, pre-warmed retrieval pipeline so we can gather authoritative context before the model writes anything.',
    bullets: [
      'Vector similarity delivers high-recall semantic matches for paraphrased questions.',
      'MMR (Maximal Marginal Relevance) keeps results diverse so you see distinct policy points instead of duplicates.',
      'BM25 keyword search locks onto regulation numbers, acronyms, and exact phrases for precision.',
      'When enabled, the unified retriever layers in table-aware logic and rerankers for complex queries.'
    ],
    footer:
      'A performance monitor tracks latency and fallbacks so responses stay responsive even under load.',
  },
  {
    title: '2. Retrieval-Augmented Generation with guardrails',
    icon: <ShieldCheck className="w-5 h-5 text-[var(--primary)]" />,
    description:
      'The retrieved passages are woven into a policy-focused system prompt that enforces tone, formatting, and jurisdiction awareness.',
    bullets: [
      'Structured hints (like defaulting to Ontario if no location is provided) keep answers grounded in the right region.',
      'The system prompt carries mandatory instructions so policy language stays accurate and consistent.',
      'Follow-up questions are generated asynchronously after the main answer completes, so you get suggestions without delaying the response.'
    ],
    footer:
      'This guard‑railed RAG layer is what keeps the chatbot factual and audit-friendly.',
  },
  {
    title: '3. Streaming delivery & caching',
    icon: <Zap className="w-5 h-5 text-[var(--primary)]" />,
    description:
      'Responses stream from our FastAPI RAG service over Server-Sent Events (SSE) and land in the chat UI in real time.',
    bullets: [
      'The Express proxy maintains the SSE bridge, while the frontend listens with a cancellable hook so placeholders never duplicate.',
      'Metadata events update sources and follow-up prompts the moment they arrive.',
      'Three cache layers—embeddings (L1), documents (L2), and full responses (L3)—reuse previous work without sacrificing accuracy.'
    ],
    footer:
      'Together, this yields answers that feel instant while still citing their sources.',
  },
  {
    title: 'Why not just ask an LLM like ChatGPT.com?',
    icon: <Brain className="w-5 h-5 text-[var(--primary)]" />,
    description:
      'Pure LLM prompts rely on what the model remembers. Our RAG pipeline keeps it grounded and auditable.',
    bullets: [
      'LLM-only answers can hallucinate or drift from current policy. Retrieval forces the model to cite vetted source content.',
      'We can show our work—each response is linked to the exact document passages that supported it.',
      'Context-aware guardrails (prompts, jurisdiction hints, follow-ups) ensure answers stay compliant and user-ready.',
      'Caching and streaming make this RAG approach nearly as fast as a raw LLM call, but far more reliable.'
    ],
    footer:
      'The result: the speed of an assistant, with the accountability of a policy manual.',
  }
];

const HowItWorksModal: React.FC<HowItWorksModalProps> = ({ open, onOpenChange }) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>How does this chatbot work?</DialogTitle>
          <DialogDescription>
            An at-a-glance look at how we balance accuracy and speed under the hood.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[65vh] pr-2">
          <div className="space-y-6 pt-2">
            {sections.map((section, index) => (
              <motion.section
                key={section.title}
                className="rounded-xl border border-[var(--border)] bg-card/70 p-4"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 * index }}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex items-center justify-center rounded-full bg-[var(--primary)]/10 p-2">
                    {section.icon}
                  </div>
                  <h3 className="text-base font-semibold text-[var(--text)]">{section.title}</h3>
                </div>
                <p className="text-sm text-[var(--text-secondary)] mb-4">
                  {section.description}
                </p>
                <ul className="space-y-3 text-sm">
                  {section.bullets.map((bullet) => (
                    <li key={bullet} className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 mt-0.5 text-[var(--primary)] flex-shrink-0" />
                      <span className="text-[var(--text)]">{bullet}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-4 flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                  <ArrowRight className="w-3 h-3" />
                  <span>{section.footer}</span>
                </div>
              </motion.section>
            ))}
          </div>
        </ScrollArea>
        <div className="flex justify-end pt-3">
          <Button size="sm" onClick={() => onOpenChange(false)}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default HowItWorksModal;
