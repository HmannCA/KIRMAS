
import React from 'react';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

type Opt = string | { value: string; label: string };
type Row = { id: string; value: string; label: string; manual?: boolean };

function slugify(s: string): string {
  return (s || '')
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[ß]/g, 'ss')
    .replace(/[ä]/g, 'ae')
    .replace(/[ö]/g, 'oe')
    .replace(/[ü]/g, 'ue')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function tinyId(len = 6): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function toObjects(value: Opt[]): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];
  for (const o of (value || [])) {
    if (o == null) continue;
    if (typeof o === 'string') out.push({ value: slugify(o), label: o });
    else {
      const v = (o.value ?? slugify(o.label ?? 'option')) + '';
      const l = (o.label ?? o.value ?? '') + '';
      out.push({ value: v, label: l });
    }
  }
  return out;
}

function equalList(a: Row[], bObjs: {value:string; label:string}[]): boolean {
  if (a.length !== bObjs.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].label !== bObjs[i].label || a[i].value !== bObjs[i].value) return false;
  }
  return true;
}

function reconcileRows(prev: Row[], objs: {value:string; label:string}[]): Row[] {
  const map = new Map<string, string>(); // content -> id
  for (const r of prev) map.set(`${r.label}||${r.value}`, r.id);
  return objs.map((o, i) => {
    const key = `${o.label}||${o.value}`;
    const id = map.get(key) ?? `r_${i}_${tinyId()}`;
    return { id, label: o.label, value: o.value, manual: false };
  });
}

function isDuplicateValue(rows: Row[], value: string, selfId: string): boolean {
  const v = (value || '').toLowerCase();
  let count = 0;
  for (const r of rows) {
    if (r.value.toLowerCase() === v) {
      if (r.id !== selfId) count++;
    }
  }
  return count > 0;
}

function makeUnique(base: string, rows: Row[], selfId?: string): string {
  let v = slugify(base);
  if (!v) v = 'option';
  if (!isDuplicateValue(rows, v, selfId || '')) return v;
  let i = 2;
  while (true) {
    const cand = `${v}-${i}`;
    if (!isDuplicateValue(rows, cand, selfId || '')) return cand;
    i++;
    if (i > 9999) return cand;
  }
}

export default function SelectOptionsEditor({
  value,
  onChange
}:{
  value: Opt[];
  onChange: (next: { value: string; label: string }[]) => void;
}){
  const [insertAt, setInsertAt] = React.useState<'start'|'end'>('end');
  const [rows, setRows] = React.useState<Row[]>(() => reconcileRows([], toObjects(value || [])));
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  React.useEffect(() => {
    const objs = toObjects(value || []);
    if (!equalList(rows, objs)) {
      const next = reconcileRows(rows, objs);
      setRows(next);
    }
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  function commit(nextRows: Row[]) {
    setRows(nextRows);
    onChange(nextRows.map(x => ({ value: x.value, label: x.label })));
  }

  function onDragEnd(e: any){
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = rows.findIndex(r => r.id === active.id);
    const newIndex = rows.findIndex(r => r.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const next = arrayMove(rows, oldIndex, newIndex);
    commit(next);
  }

  function addRow(){
    const base = { label: 'Option', value: 'option' };
    const r: Row = { id: 'r_new_' + tinyId(), ...base, manual: false };
    const placed = insertAt === 'start' ? [r, ...rows] : [...rows, r];
    const idx = placed.findIndex(x => x.id === r.id);
    placed[idx].value = makeUnique(placed[idx].label, placed, placed[idx].id);
    commit(placed);
  }
  function removeRow(i:number){
    const next = rows.filter((_,idx)=> idx!==i);
    commit(next);
  }
  function updateRow(i:number, patch: Partial<{label:string; value:string; manual?: boolean}>){
    const next = rows.map((row,idx)=> {
      if (idx!==i) return row;
      let r: Row = { ...row, ...patch };
      if (patch.label !== undefined) {
        const newLabel = patch.label;
        if (newLabel && !r.manual) {
          r.value = makeUnique(newLabel, rows, row.id);
        }
      }
      return r;
    });
    commit(next);
  }
  function sortBy(by:'label'|'value', dir:'asc'|'desc'){
    const next = [...rows].sort((a,b)=> {
      const A = (a[by] || '').toLowerCase();
      const B = (b[by] || '').toLowerCase();
      if (A < B) return dir==='asc' ? -1 : 1;
      if (A > B) return dir==='asc' ? 1 : -1;
      return 0;
    });
    commit(next);
  }

  async function importFile(file: File, mode:'append'|'replace'){
    const name = file.name.toLowerCase();
    const buf = await file.arrayBuffer();
    let pairs: {label:string; value:string}[] = [];

    if (name.endsWith('.csv') || name.endsWith('.txt')) {
      const text = new TextDecoder('utf-8').decode(buf);
      const lines = text.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
      for (const line of lines) {
        const csv = line.split(/;|,|\t/);
        if (csv.length >= 2) {
          const label = csv[0].trim();
          const rawV = (csv[1] || '').trim();
          const value = rawV || slugify(label);
          pairs.push({ label, value });
        } else {
          const m = line.match(/^(.+?)[\|=](.+)$/);
          if (m) { const label = m[1].trim(); const rawV = (m[2]||'').trim(); const value = rawV || slugify(label); pairs.push({label,value}); }
          else { const label = line; pairs.push({ label, value: slugify(label) }); }
        }
      }
    } else if (name.endsWith('.xlsx')) {
      try {
        const XLSX = await import('xlsx');
        const wb = XLSX.read(buf, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rws = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
        for (const row of rws) {
          if (!row || row.length===0) continue;
          const label = String(row[0] ?? '').trim();
          if (!label) continue;
          const rawV = String(row[1] ?? '').trim();
          const value = rawV || slugify(label);
          pairs.push({ label, value });
        }
      } catch (e) {
        alert('XLSX-Import erfordert das Paket "xlsx". Bitte installieren: npm i xlsx');
        return;
      }
    } else {
      alert('Bitte CSV, TXT oder XLSX auswählen.');
      return;
    }

    const imported: Row[] = pairs.map((p, i) => ({ id:'r_imp_' + i + '_' + tinyId(), ...p, manual: false }));
    const base = mode==='replace' ? [] : rows.slice();
    let combined = base.concat(imported);
    combined = combined.map((r,i)=> ({...r, value: makeUnique(r.value || r.label, combined, r.id)}));
    commit(combined);
  }

  const fileRefAppend = React.useRef<HTMLInputElement>(null);
  const fileRefReplace = React.useRef<HTMLInputElement>(null);

  const ImportRow = () => (
    <div className="row" style={{ gap:8, alignItems:'center', marginTop:8, flexWrap:'wrap' }}>
      <span style={{fontSize:12, color:'#475467'}}>Import:</span>
      <input
        ref={fileRefAppend}
        type="file"
        accept=".csv,.txt,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        style={{display:'none'}}
        onChange={e=>{ const f=e.target.files?.[0]; if(f) importFile(f,'append'); e.currentTarget.value=''; }}
      />
      <button className="btn" onClick={()=>fileRefAppend.current?.click()}>CSV/XLSX anhängen</button>
      <input
        ref={fileRefReplace}
        type="file"
        accept=".csv,.txt,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        style={{display:'none'}}
        onChange={e=>{ const f=e.target.files?.[0]; if(f) importFile(f,'replace'); e.currentTarget.value=''; }}
      />
      <button className="btn" onClick={()=>fileRefReplace.current?.click()}>CSV/XLSX ersetzen</button>
    </div>
  );

  return (
    <div style={{display:'grid', gap:8}}>
      <div style={{border:'1px solid #EAECF0', borderRadius:8, padding:8}}>
        {/* Row 1: Einfügeposition + +Option */}
        <div className="row" style={{ gap:8, alignItems:'center', flexWrap:'wrap' }}>
          <div className="row" style={{gap:6, alignItems:'center'}}>
            <span style={{fontSize:12, color:'#475467'}}>Einfügeposition:</span>
            <label className="row" style={{gap:4}}>
              <input type="radio" checked={insertAt==='start'} onChange={()=>setInsertAt('start')} />
              <span>Anfang</span>
            </label>
            <label className="row" style={{gap:4}}>
              <input type="radio" checked={insertAt==='end'} onChange={()=>setInsertAt('end')} />
              <span>Ende</span>
            </label>
          </div>
          <button className="btn" onClick={addRow}>+ Option</button>
        </div>

        {/* Row 2: Import */}
        <ImportRow />

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={rows.map(r=>r.id)} strategy={verticalListSortingStrategy}>
            <table className="kirmas-table" style={{ width:'100%', borderCollapse:'collapse', marginTop:8 }}>
              <colgroup>
                <col style={{width:'4%'}} />
                <col style={{width:'48%'}} />
                <col style={{width:'38%'}} />
                <col style={{width:'10%'}} />
              </colgroup>
              <thead>
                <tr>
                  <th></th>
                  <th>
                    <div className="row" style={{justifyContent:'space-between', alignItems:'center'}}>
                      <span>Label</span>
                      <span className="row" style={{gap:4}}>
                        <button className="btn" title="Label aufsteigend" onClick={()=>sortBy('label','asc')}>▲</button>
                        <button className="btn" title="Label absteigend" onClick={()=>sortBy('label','desc')}>▼</button>
                      </span>
                    </div>
                  </th>
                  <th>
                    <div className="row" style={{justifyContent:'space-between', alignItems:'center'}}>
                      <span>Value</span>
                      <span className="row" style={{gap:4}}>
                        <button className="btn" title="Value aufsteigend" onClick={()=>sortBy('value','asc')}>▲</button>
                        <button className="btn" title="Value absteigend" onClick={()=>sortBy('value','desc')}>▼</button>
                      </span>
                    </div>
                  </th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const labelEmpty = !r.label || r.label.trim()==='';
                  const valueDisabled = labelEmpty;
                  const dup = !labelEmpty && isDuplicateValue(rows, r.value, r.id);
                  return (
                    <SortableRow key={r.id} row={r} index={i}
                      onRemove={()=>removeRow(i)}
                      onChange={(p)=>{
                        if (p.value !== undefined) {
                          const nr = rows.slice();
                          nr[i] = { ...nr[i], value: p.value, manual: true };
                          commit(nr);
                          return;
                        }
                        if (p.label !== undefined) {
                          updateRow(i, { label: p.label });
                          return;
                        }
                      }}
                    >
                      <td><input className="kirmas-input" value={r.label} onChange={e=>updateRow(i,{label:e.target.value})} /></td>
                      <td>
                        <div style={{display:'grid', gap:4}}>
                          <input
                            className="kirmas-input"
                            disabled={valueDisabled}
                            value={r.value}
                            onChange={e=>{
                              const v = e.target.value;
                              const nr = rows.slice();
                              nr[i] = { ...nr[i], value: v, manual: true };
                              setRows(nr);
                              onChange(nr.map(x => ({ value: x.value, label: x.label })));
                            }}
                            style={dup ? { borderColor:'#D92D20', outlineColor:'#D92D20' } : undefined}
                          />
                          {dup && (
                            <div className="row" style={{gap:8, alignItems:'center'}}>
                              <span style={{color:'#D92D20', fontSize:12}}>Value muss eindeutig sein.</span>
                              <button className="btn" onClick={()=>{
                                const nr = rows.slice();
                                nr[i] = { ...nr[i], value: makeUnique(r.value || r.label, rows, r.id), manual: true };
                                commit(nr);
                              }}>Automatisch bereinigen</button>
                            </div>
                          )}
                        </div>
                      </td>
                    </SortableRow>
                  );
                })}
              </tbody>
            </table>
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
}

function SortableRow(
  { row, index, onRemove, onChange, children }:
  { row: Row; index: number; onRemove: ()=>void; onChange: (p: Partial<Row>)=>void; children?: React.ReactNode }
){
  const {attributes, listeners, setNodeRef, transform, transition, isDragging} = useSortable({ id: row.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    background: isDragging ? '#F9FAFB' : undefined
  };
  return (
    <tr ref={setNodeRef} style={style}>
      <td>
        <button className="btn" aria-label="ziehen" {...attributes} {...listeners} title="Ziehen">
          ≡
        </button>
      </td>
      {children}
      <td><button className="btn" onClick={onRemove}>–</button></td>
    </tr>
  );
}
