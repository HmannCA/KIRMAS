
import React from 'react';

export type SurveySchema = any;

export type AiPanelProps = {
  open: boolean;
  onClose: () => void;
  getSchema: () => SurveySchema;
  onApply: (next: SurveySchema, mode: 'replace'|'append'|'integrate') => void;
  onLoad?: (payload: { id: string; title: string; version?: number; schema: SurveySchema }) => void;
};

type Provider = 'openai'|'gemini';
type Mode = 'replace'|'append'|'integrate';
type SavedItem = { id: string; title: string; version?: number; updatedAt?: string };

const styles = {
  overlay: { position: 'fixed' as const, top: 0, right: 0, bottom: 0, width: '480px', maxWidth: '100vw', background: '#FFFFFF', borderLeft: '1px solid #EAECF0', boxShadow: '-8px 0 24px rgba(16,24,40,0.08)', zIndex: 50, display: 'flex', flexDirection: 'column' as const },
  header: { padding: '12px 16px', borderBottom: '1px solid #EAECF0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontWeight: 600, fontSize: 16, color: '#101828' },
  body: { padding: 16, overflowY: 'auto' as const, display: 'grid', gap: 12 },
  label: { fontSize: 12, color: '#475467', marginBottom: 4 },
  select: { width: '100%', border: '1px solid #D0D5DD', borderRadius: 8, padding: '8px 10px', background: '#fff' },
  textarea: { width: '100%', minHeight: 120, border: '1px solid #D0D5DD', borderRadius: 8, padding: 10, resize: 'vertical' as const },
  row: { display: 'flex', gap: 8, alignItems: 'center' },
  col: { display: 'grid', gap: 6 },
  section: { display: 'grid', gap: 8, border: '1px solid #EAECF0', borderRadius: 10, padding: 12 },
  card: { border: '1px solid #EAECF0', borderRadius: 10, padding: 12 },
  small: { fontSize: 12, color: '#475467' },
  primary: { background: '#0B5ED7', color: '#fff', border: 0, borderRadius: 8, padding: '8px 12px', cursor: 'pointer' },
  subtle: { background: '#F2F4F7', color: '#344054', border: 0, borderRadius: 8, padding: '8px 12px', cursor: 'pointer' },
  rowButton: { width: '100%', textAlign: 'left' as const, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 10, border: '1px solid #EAECF0', borderRadius: 8, background: '#FFFFFF', cursor: 'pointer' },
  rightHint: { fontSize: 12, color: '#0B5ED7', fontWeight: 600 }
};

function coerceArray(anyRows: any): any[] {
  if (Array.isArray(anyRows)) return anyRows;
  if (anyRows && typeof anyRows === 'object') {
    for (const k of ['items','rows','data','list']) {
      if (Array.isArray((anyRows as any)[k])) return (anyRows as any)[k];
    }
    const vals = Object.values(anyRows);
    if (vals.length && vals.every(v => v && typeof v === 'object')) return vals as any[];
  }
  return [];
}

async function getJson(paths: string[]) {
  let last: any;
  for (const p of paths) {
    try {
      const r = await fetch(p, { headers: { 'accept': 'application/json' } });
      if (!r.ok) throw new Error(String(r.status));
      return await r.json();
    } catch (e) { last = e; }
  }
  throw last || new Error('Keine Quelle gefunden');
}

function ensureIds(schema: any) {
  const s = structuredClone(schema ?? {});
  if (!Array.isArray(s.pages)) s.pages = [];
  for (const p of s.pages) {
    p.id ||= 'pg_' + Math.random().toString(36).slice(2,8);
    if (!Array.isArray(p.sections)) p.sections = [];
    for (const se of p.sections) {
      se.id ||= 'sec_' + Math.random().toString(36).slice(2,8);
      if (!Array.isArray(se.blocks)) se.blocks = [];
      if (Array.isArray((se as any).fields) && (se as any).fields.length) {
        const blk = { id: 'blk_' + Math.random().toString(36).slice(2,8), title: se.title ?? 'Block', fields: (se as any).fields };
        se.blocks = [blk, ...se.blocks];
        delete (se as any).fields;
      }
      for (const b of se.blocks) {
        b.id ||= 'blk_' + Math.random().toString(36).slice(2,8);
        if (!Array.isArray(b.fields)) b.fields = [];
        for (const f of b.fields) f.id ||= 'fld_' + Math.random().toString(36).slice(2,8);
      }
    }
  }
  return s;
}

export default function AiPanel({ open, onClose, getSchema, onApply, onLoad }: AiPanelProps) {
  const [provider, setProvider] = React.useState<Provider>('openai');
  const [model, setModel] = React.useState<string>('gpt-5');
  const [mode, setMode] = React.useState<Mode>('replace');
  const [prompt, setPrompt] = React.useState<string>('Bitte die Erhebung präzise und datenbanktauglich modellieren. Wenn sinnvoll, in logisch getrennte Teil-Erhebungen splitten.');

  const [saved, setSaved] = React.useState<SavedItem[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => { if (open) refreshList(); }, [open]);
  React.useEffect(() => { setModel(provider === 'openai' ? 'gpt-5' : 'gemini-2.5-pro'); }, [provider]);

  async function refreshList() {
    try {
      setError(null);
      const rows = coerceArray(await getJson(['/api/surveys','/api/devstore/surveys','/api/devstore/surveys/list','/devstore/surveys/index.json']));
      const norm = rows.map((x:any)=>({ id:String(x.id||x.ID), title:String(x.title||x.name||x.schema?.title||'Ohne Titel'), updatedAt:x.updatedAt||x.mtime }));
      setSaved(norm);
    } catch (e:any) {
      console.warn('AiPanel.refreshList failed', e);
      setError('Konnte gespeicherte Erhebungen nicht laden.');
      setSaved([]);
    }
  }

  async function handleLoad(id: string) {
    try {
      console.log('AiPanel.handleLoad: fetching', id);
      const json = await getJson([`/api/surveys/${encodeURIComponent(id)}`, `/api/devstore/surveys/${encodeURIComponent(id)}`, `/api/devstore/surveys/get?id=${encodeURIComponent(id)}`, `/devstore/surveys/${encodeURIComponent(id)}.json`]);
      console.log('AiPanel.handleLoad: got JSON keys', Object.keys(json));
      const idEff = String(json.id ?? id);
      const titleEff = String(json.title ?? json.schema?.title ?? 'Ohne Titel');
      const rawSchema = json.schema ?? json;
      const effective = ensureIds({ ...rawSchema, title: titleEff });
      console.log('AiPanel.handleLoad: effective pages', Array.isArray(effective.pages) ? effective.pages.length : 'n/a');
      onApply(effective, 'replace');
      onLoad?.({ id: idEff, title: titleEff, schema: effective });
      onClose();
    } catch (e:any) {
      console.error('AiPanel.handleLoad failed', e);
      setError('Konnte Erhebung nicht laden.');
    }
  }

  async function runSynthesis() {
    setBusy(true);
    try {
      const body = { prompt, mode, provider, model, schema: getSchema() };
      const r = await fetch('/api/ai/synthesize?mode='+encodeURIComponent(mode), { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
      if (!r.ok) throw new Error(String(r.status));
      const data = await r.json();
      const schema = ensureIds({ ...(data.schema ?? {}), title: String(data.title ?? data.schema?.title ?? 'Ohne Titel') });
      onApply(schema, mode);
    } catch (e:any) {
      console.error('AiPanel.runSynthesis failed', e);
      setError('Fehler bei der KI-Erzeugung.');
    }
    setBusy(false);
  }

  if (!open) return null;

  return (
    <aside style={styles.overlay} role="dialog" aria-label="KI-Assistent">
      <div style={styles.header}>
        <div style={styles.title}>KI-Assistent</div>
        <div style={{ display:'flex', gap:8 }}>
          <button style={styles.subtle} onClick={onClose}>Schließen</button>
          <button style={styles.primary} onClick={runSynthesis}>Erhebung erzeugen</button>
        </div>
      </div>

      <div style={styles.body}>
        <div style={styles.section}>
          <div style={styles.row}>
            <div style={{ flex: 1 }}>
              <div style={styles.label}>KI-Anbieter</div>
              <select style={styles.select} value={provider} onChange={e => setProvider(e.target.value as Provider)}>
                <option value="openai">OpenAI</option>
                <option value="gemini">Google Gemini</option>
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <div style={styles.label}>Modell</div>
              <select style={styles.select} value={model} onChange={e => setModel(e.target.value)}>
                {(provider==='openai'?['gpt-5','gpt-4o']:['gemini-2.5-pro','gemini-2.5-flash']).map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>

          <div className="col" style={{ display: 'grid', gap: 6 }}>
            <div style={styles.label}>Auftrag an die KI</div>
            <textarea style={styles.textarea} value={prompt} onChange={e => setPrompt(e.target.value)}
              placeholder="Beschreibe das Ziel, Dokumente etc. (Erstellung kann einige Minuten dauern)." />
          </div>
        </div>

        <div style={styles.section}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 600, color: '#101828' }}>Gespeicherte Erhebungen</div>
            <button style={styles.subtle} onClick={refreshList}>Aktualisieren</button>
          </div>
          <div style={{ display:'grid', gap:8 }}>
            {error && <div style={{ color:'#D92D20' }}>{error}</div>}
            {saved.length === 0 && !error && <div style={styles.small}>Keine Erhebungen gefunden.</div>}
            {saved.map(item => (
              <button
                key={item.id}
                type="button"
                aria-label={`Erhebung „${item.title}“ laden`}
                title="Laden"
                onClick={()=>handleLoad(item.id)}
                style={styles.rowButton}
              >
                <div style={{ display:'grid' }}>
                  <div style={{ fontWeight: 600 }}>{item.title}</div>
                  <div style={{ fontSize: 12, color:'#475467' }}>
                    ID: <span style={{ fontFamily:'monospace' }}>{item.id}</span>
                    {item.updatedAt && <span> · { new Date(item.updatedAt).toLocaleString() }</span>}
                  </div>
                </div>
                <div style={styles.rightHint}>Laden ›</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {busy && (
        <div style={{ position:'absolute', inset:0, display:'grid', placeItems:'center', background:'rgba(16,24,40,0.45)', color:'#fff' }}>
          <div style={{ background:'#0B5ED7', padding:16, borderRadius:12 }}>KI arbeitet …</div>
        </div>
      )}
    </aside>
  );
}
