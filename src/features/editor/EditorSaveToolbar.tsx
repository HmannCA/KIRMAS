import React from 'react';
import { saveSurvey, updateSurvey } from '../ai/surveyApi';

type Props = {
  /** Liefert das aktuell bearbeitete Erhebungs-Schema aus dem Editor. */
  getSchema: () => any;
  /** Optional: zuletzt gespeichertes Survey (ID/Title), falls der Editor das schon kennt. */
  lastId?: string;
  lastTitle?: string;
  /** Callback nach erfolgreichem Speichern */
  onSaved?: (info: { id: string; title: string }) => void;
};

const btn: React.CSSProperties = { padding: '6px 10px', borderRadius: 8, border: '1px solid #D0D5DD', background: '#fff', cursor: 'pointer' };
const btnPrimary: React.CSSProperties = { ...btn, background: '#155EEF', borderColor: '#155EEF', color: 'white' };
const wrap: React.CSSProperties = { display: 'flex', gap: 8, alignItems: 'center' };

export default function EditorSaveToolbar({ getSchema, lastId, lastTitle, onSaved }: Props) {
  const [title, setTitle] = React.useState<string>(lastTitle || '');
  const [saving, setSaving] = React.useState(false);
  const [currentId, setCurrentId] = React.useState<string | undefined>(
    lastId || (typeof localStorage !== 'undefined' ? localStorage.getItem('kirmas:lastSurveyId') || undefined : undefined)
  );

  // Modal-Zustand für "Kopie anlegen & unter neuem Titel speichern"
  const [showSaveAs, setShowSaveAs] = React.useState(false);
  const [tempTitle, setTempTitle] = React.useState<string>('');

  React.useEffect(() => {
    // Bei Wechsel des geladenen Schemas Titel im Eingabefeld aktualisieren
    if (lastTitle !== undefined) setTitle(lastTitle);
    if (lastId !== undefined) setCurrentId(lastId);
  }, [lastId, lastTitle]);

  async function doSave(update: boolean, overrideTitle?: string) {
    try {
      setSaving(true);
      const schema = getSchema();
      const baseTitle = (title || schema?.title || 'Erhebung').toString();
      const finalTitle = (overrideTitle ?? baseTitle).toString().trim() || 'Erhebung';
      let id = currentId;

      if (update && id) {
        const rec = await updateSurvey(id, schema, finalTitle);
        onSaved?.({ id: rec.id, title: rec.title });
        alert('Erhebung gespeichert.');
      } else {
        const rec = await saveSurvey(schema, finalTitle);
        id = rec.id;
        setCurrentId(id);
        onSaved?.({ id: rec.id, title: rec.title });
        alert('Kopie gespeichert.');
      }

      if (typeof localStorage !== 'undefined' && id) {
        localStorage.setItem('kirmas:lastSurveyId', id);
        localStorage.setItem('kirmas:lastSurveyTitle', finalTitle);
      }
    } catch (e: any) {
      alert('Speichern fehlgeschlagen: ' + (e?.message || String(e)));
    } finally {
      setSaving(false);
    }
  }

  // Strg/Cmd+S -> Speichern (Update, wenn id vorhanden, sonst Neu)
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        doSave(Boolean(currentId));
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [currentId, title, getSchema]);

  function openSaveAsModal() {
    const schema = getSchema();
    const current = (title || schema?.title || 'Erhebung').toString();
    const suggestion = current && !/kopie/i.test(current) ? (current + ' – Kopie') : current;
    setTempTitle(suggestion);
    setShowSaveAs(true);
  }

  function SaveAsModal() {
    if (!showSaveAs) return null;
    return (
      <div style={{
        position:'fixed', inset:0, background:'rgba(0,0,0,.35)',
        display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000
      }}>
        <div style={{ background:'#fff', borderRadius:12, padding:16, minWidth:420, boxShadow:'0 10px 30px rgba(0,0,0,.12)' }}>
          <div style={{ fontSize:18, fontWeight:600, marginBottom:8 }}>Kopie anlegen & unter neuem Titel speichern</div>
          <div style={{ color:'#475467', fontSize:14, marginBottom:8 }}>
            Bitte gib den <b>neuen Titel</b> für die Kopie ein. Der ursprüngliche Datensatz bleibt unverändert.
          </div>
          <input
            className="kirmas-input"
            autoFocus
            value={tempTitle}
            onChange={e=>setTempTitle(e.target.value)}
            placeholder="Neuer Titel der Erhebung"
            style={{ width:'100%', padding:'8px 10px', marginTop:6 }}
          />
          <div style={{ display:'flex', gap:8, marginTop:12, justifyContent:'flex-end' }}>
            <button className="btn" onClick={()=>setShowSaveAs(false)}>Abbrechen</button>
            <button
              className="btn"
              style={btnPrimary}
              onClick={async ()=>{ 
                const t = (tempTitle || '').trim();
                if (!t) { alert('Bitte Titel eingeben.'); return; }
                setShowSaveAs(false);
                await doSave(false, t);
                setTitle(t); // Toolbar-Feld direkt auf neuen Titel setzen
              }}
            >
              Übernehmen & speichern
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position:'relative' }}>
      <div style={wrap}>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Titel der Erhebung …"
          style={{ padding: '6px 8px', borderRadius: 8, border: '1px solid #D0D5DD', minWidth: 260 }}
        />
        <button onClick={() => doSave(Boolean(currentId))} disabled={saving} style={btnPrimary}>
          {saving ? 'Speichere…' : currentId ? 'Speichern' : 'Speichern (neu)'}
        </button>
        <button onClick={openSaveAsModal} disabled={saving} style={btn}>Kopie anlegen & unter neuem Titel speichern</button>
      </div>
      <SaveAsModal />
    </div>
  );
}
