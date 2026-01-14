/**
 * Source formatting utilities
 * Extracted from useStreamingChat hook for better organization and testability
 */

import type { Source } from '@/types';

interface RawSource {
  id?: string;
  reference?: string;
  title?: string;
  url?: string;
  content?: string;
  text?: string;
  section?: string;
  page?: number;
  score?: number;
  source?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Convert raw source objects from API to Source type
 */
export const toSources = (eventSources: RawSource[] = []): Source[] =>
  eventSources.map((source, index) => ({
    id: source.id || source.reference || source.title || source.url || `stream-source-${index}`,
    text: source.content || source.text || '',
    title: source.title,
    url: source.url,
    section: source.section,
    page: source.page,
    score: source.score,
    reference: source.source || source.reference || source.title || '',
    metadata: source.metadata,
  }));

/**
 * Check if a string looks like a file path or URL
 */
const looksLikePath = (value: string): boolean =>
  /[\\/]/.test(value) || /^[a-z]+:\/\//i.test(value);

/**
 * Convert string to title case
 */
const toTitleCase = (value: string): string =>
  value.replace(/\b([a-zA-Z])/g, (match) => match.toUpperCase());

/**
 * Sanitize a filename to extract a readable label
 */
const sanitizeFilename = (value: string): string => {
  const withoutPath = value.split(/[\\\/]/).pop() || value;
  const withoutExt = withoutPath.replace(/\.[a-z0-9]+$/i, '');
  const normalized = withoutExt
    .replace(/[_\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return normalized ? toTitleCase(normalized) : withoutExt;
};

/**
 * Derive a human-readable label for a source
 */
export const deriveSourceLabel = (source: Source, index: number): string => {
  const candidates: Array<string | undefined> = [
    source.title,
    source.metadata?.title,
    source.metadata?.documentTitle,
    source.metadata?.displayTitle,
    source.metadata?.display_name,
    source.metadata?.displayName,
    source.metadata?.catalogTitle,
    source.metadata?.catalog_title,
    source.metadata?.canonicalTitle,
    source.metadata?.canonical_title,
    source.metadata?.document_name,
    source.metadata?.documentName,
    source.metadata?.sourceTitle,
    source.metadata?.source_name,
    source.metadata?.sourceName,
    source.metadata?.name,
    source.reference,
    source.section,
  ];

  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue;
    const trimmed = candidate.trim();
    if (!trimmed) continue;
    if (looksLikePath(trimmed)) continue;
    return trimmed;
  }

  const fallbackCandidates: Array<string | undefined> = [
    source.metadata?.original_filename,
    source.metadata?.original_name,
    source.metadata?.filename,
    source.metadata?.file_name,
    source.metadata?.source,
    source.reference,
    source.url,
  ];

  for (const candidate of fallbackCandidates) {
    if (typeof candidate !== 'string') continue;
    const trimmed = candidate.trim();
    if (!trimmed) continue;
    const cleaned = sanitizeFilename(trimmed);
    if (cleaned) {
      return cleaned;
    }
  }

  return `Source ${index + 1}`;
};

/**
 * Format sources as markdown list
 */
export const formatSourcesMarkdown = (sourceList: Source[]): string => {
  if (!sourceList || sourceList.length === 0) {
    return '';
  }

  return sourceList
    .map((source, index) => {
      const label = deriveSourceLabel(source, index);
      const metaParts: string[] = [];
      if (source.section) {
        metaParts.push(source.section);
      }
      if (source.page) {
        metaParts.push(`p. ${source.page}`);
      }
      const metadataSuffix = metaParts.length > 0 ? ` — ${metaParts.join(' · ')}` : '';
      return `${index + 1}. ${label}${metadataSuffix}`;
    })
    .join('\n');
};

/**
 * Format sources as inline reference line
 */
export const formatInlineReferenceLine = (sourceList: Source[]): string => {
  if (!sourceList || sourceList.length === 0) {
    return '';
  }

  const entries = sourceList.map((source, index) => {
    const label = deriveSourceLabel(source, index);
    const metaParts: string[] = [];
    if (source.section) {
      metaParts.push(source.section);
    }
    if (source.page) {
      metaParts.push(`p. ${source.page}`);
    }
    const metadataSuffix = metaParts.length > 0 ? ` — ${metaParts.join(' · ')}` : '';
    return `[${index + 1}] ${label}${metadataSuffix}`;
  });

  return `_References for further detail: ${entries.join('; ')}_`;
};
