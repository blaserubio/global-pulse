export const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    next: { revalidate: 300 }, // 5 min cache for server components
  });
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
  return res.json();
}

// Client-side fetcher for SWR
export async function swrFetcher<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function getStories(params?: { topic?: string; limit?: number; offset?: number }) {
  const sp = new URLSearchParams();
  if (params?.topic) sp.set('topic', params.topic);
  if (params?.limit) sp.set('limit', String(params.limit));
  if (params?.offset) sp.set('offset', String(params.offset));
  const qs = sp.toString();
  return fetchApi<{ stories: import('./types').StoryCluster[]; total: number }>(`/stories${qs ? `?${qs}` : ''}`);
}

export async function getStory(id: string) {
  return fetchApi<import('./types').StoryDetail>(`/stories/${id}`);
}

export async function getFraming(id: string) {
  return fetchApi<import('./types').FramingAnalysis>(`/stories/${id}/framing`);
}

export async function getHeadlines(params?: { topic?: string; region?: string; limit?: number; offset?: number }) {
  const sp = new URLSearchParams();
  if (params?.topic) sp.set('topic', params.topic);
  if (params?.region) sp.set('region', params.region);
  if (params?.limit) sp.set('limit', String(params.limit));
  if (params?.offset) sp.set('offset', String(params.offset));
  const qs = sp.toString();
  return fetchApi<{ articles: import('./types').Article[]; total: number }>(`/headlines${qs ? `?${qs}` : ''}`);
}

export async function getSources() {
  return fetchApi<{ sources: import('./types').Source[] }>('/sources');
}

export async function getOverviewStats() {
  return fetchApi<import('./types').OverviewStats>('/stats/overview');
}
