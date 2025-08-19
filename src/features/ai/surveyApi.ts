const API_BASE =
  import.meta.env.VITE_API_BASE?.replace(/\/$/, '') ||
  '/api'; // via Vite-Proxy an http://localhost:8787

async function fetchJson(path: string, init?: RequestInit) {
  const res = await fetch(
    path.startsWith('http') ? path : `${API_BASE}${path}`,
    init
  );
  const ct = res.headers.get('content-type') || '';
  const text = await res.text();
  if (!ct.includes('application/json')) {
    // Häufigster Fall: Vite liefert index.html (Proxy fehlt) => hilfreicher Fehler
    throw new Error(
      `Unerwartete Nicht-JSON-Antwort (Status ${res.status}). ` +
      `Ist der API-Proxy aktiv / Server auf 8787 erreichbar?\n\n` +
      text.slice(0, 200)
    );
  }
  const data = JSON.parse(text);
  if (!res.ok) {
    const msg = (data && (data.error || data.message)) || res.statusText;
    throw new Error(String(msg));
  }
  return data;
}

export type SurveyMeta = { id: string; title: string; createdAt: string; updatedAt: string };
export type SurveyRecord = { id: string; title: string; schema: any; createdAt: string; updatedAt: string };

export async function listSurveys(query = ''): Promise<SurveyMeta[]> {
  const u = '/surveys' + (query ? `?query=${encodeURIComponent(query)}` : '');
  const data = await fetchJson(u);
  return data.items as SurveyMeta[];
}

export async function getSurvey(id: string): Promise<SurveyRecord> {
  const data = await fetchJson(`/surveys/${id}`);
  return data.record as SurveyRecord;
}

export async function saveSurvey(schema: any, title?: string): Promise<SurveyRecord> {
  const data = await fetchJson('/surveys', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, schema })
  });
  return data.record as SurveyRecord;
}

export async function updateSurvey(id: string, schema: any, title?: string): Promise<SurveyRecord> {
  const data = await fetchJson(`/surveys/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, schema })
  });
  return data.record as SurveyRecord;
}

export async function deleteSurvey(id: string): Promise<void> {
  await fetchJson(`/surveys/${id}`, { method: 'DELETE' });
}
