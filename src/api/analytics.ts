export type VisitSummary = {
  totalVisits: number;
  firstVisit: string | null;
  lastVisit: string | null;
  dailyCounts: Array<{ date: string; count: number }>;
};

export type VisitSummaryFilters = {
  startAt?: string;
  endAt?: string;
  path?: string;
};

type VisitEventPayload = {
  path: string;
  referrer?: string | null;
  sessionId?: string | null;
  locale?: string | null;
  title?: string | null;
  viewport?: string | null;
  metadata?: Record<string, unknown>;
};

export async function sendVisitEvent(event: VisitEventPayload): Promise<boolean> {
  try {
    const response = await fetch('/api/analytics/visit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
      keepalive: true,
    });

    if (!response.ok && response.status !== 503) {
      console.warn('Visit event call failed', response.status, await response.text());
      return false;
    }

    return response.ok;
  } catch (error) {
    console.warn('Unable to record visit event', error);
    return false;
  }
}

export async function fetchVisitSummary(filters: VisitSummaryFilters = {}): Promise<VisitSummary> {
  const params = new URLSearchParams();

  if (filters.startAt) {
    params.set('startAt', filters.startAt);
  }
  if (filters.endAt) {
    params.set('endAt', filters.endAt);
  }
  if (filters.path) {
    params.set('path', filters.path);
  }

  const query = params.toString();
  const url = query.length > 0 ? `/api/admin/analytics/visits?${query}` : '/api/admin/analytics/visits';

  const response = await fetch(url);

  if (!response.ok) {
    let errorMessage = `Failed to load visit analytics (${response.status})`;
    try {
      const errorBody = await response.json();
      if (typeof errorBody?.message === 'string') {
        errorMessage = errorBody.message;
      }
    } catch (error) {
      // Ignore JSON parse errors and fall back to default message
    }

    throw new Error(errorMessage);
  }

  const data = await response.json();

  return data?.data ?? {
    totalVisits: 0,
    firstVisit: null,
    lastVisit: null,
    dailyCounts: [],
  };
}
