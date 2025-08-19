export async function uploadDocuments(files: File[]): Promise<{ ok: boolean; text: string; meta: any[] }> {
  const fd = new FormData();
  for (const f of files) fd.append('files', f);
  const res = await fetch('/api/ai/ingest', { method: 'POST', body: fd });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || res.statusText);
  return data;
}

type SynthesisOpts = {
  provider: 'openai' | 'gemini';
  model: string;
  prompt: string;
  docText?: string;
  allowSplit?: boolean;
};

export async function callAiSynthesis(opts: SynthesisOpts): Promise<any> {
  const res = await fetch('/api/ai/synthesize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(opts)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data?.error || res.statusText), { response: data });
  return data;
}
