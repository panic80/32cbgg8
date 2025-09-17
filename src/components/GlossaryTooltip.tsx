import React, { useState, useEffect } from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import { useGlossary, GlossaryTerm } from '@/context/GlossaryContext';

interface GlossaryTooltipProps {
  term: string;
  children: React.ReactNode;
  className?: string;
}

export const GlossaryTooltip: React.FC<GlossaryTooltipProps> = ({
  term,
  children,
  className = '',
}) => {
  const { getCachedTerm, lookupTerm } = useGlossary();
  const [glossaryTerm, setGlossaryTerm] = useState<GlossaryTerm | null>(getCachedTerm(term));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const cached = getCachedTerm(term);
    if (!term) {
      setGlossaryTerm(null);
      setError(false);
      setLoading(false);
      return;
    }

    if (cached) {
      setGlossaryTerm(cached);
      setError(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(false);

    lookupTerm(term)
      .then(result => {
        if (!isMounted) return;
        if (result) {
          setGlossaryTerm(result);
          setError(false);
        } else {
          setGlossaryTerm(null);
          setError(true);
        }
      })
      .catch(() => {
        if (!isMounted) return;
        setError(true);
        setGlossaryTerm(null);
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [term, getCachedTerm, lookupTerm]);

  // If no glossary term found or error, just render children without tooltip
  if (!glossaryTerm || error) {
    return <>{children}</>;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={`cursor-help border-b border-dotted border-[var(--border)] ${className}`}>
            {children}
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-sm p-4 bg-[var(--card)] border-[var(--border)]">
          {loading ? (
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Loading...</span>
            </div>
          ) : (
            <div className="space-y-2">
              <div>
                <p className="font-semibold text-[var(--text-primary)]">
                  {glossaryTerm.term.toUpperCase()}
                </p>
                <p className="text-sm text-[var(--text-secondary)]">
                  {glossaryTerm.expansion}
                </p>
              </div>
              
              {glossaryTerm.description && (
                <p className="text-xs text-[var(--text-secondary)]">
                  {glossaryTerm.description}
                </p>
              )}
              
              {glossaryTerm.category && (
                <Badge variant="secondary" className="text-xs">
                  {glossaryTerm.category}
                </Badge>
              )}
              
              {glossaryTerm.variations && glossaryTerm.variations.length > 0 && (
                <div className="text-xs text-[var(--text-secondary)]">
                  <span className="font-medium">Also:</span> {glossaryTerm.variations.join(', ')}
                </div>
              )}
            </div>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

// Utility function to detect and wrap acronyms in text
export const wrapAcronymsWithTooltips = (text: string): React.ReactNode => {
  // Common military acronym pattern - 2-5 uppercase letters, possibly with & or numbers
  const acronymPattern = /\b([A-Z]{2,5}(?:[&]?[A-Z0-9])*)\b/g;
  
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;
  
  while ((match = acronymPattern.exec(text)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }
    
    // Add the acronym wrapped in tooltip
    const acronym = match[1];
    parts.push(
      <GlossaryTooltip key={`${match.index}-${acronym}`} term={acronym}>
        {acronym}
      </GlossaryTooltip>
    );
    
    lastIndex = match.index + match[0].length;
  }
  
  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }
  
  return parts.length > 0 ? <>{parts}</> : text;
};
