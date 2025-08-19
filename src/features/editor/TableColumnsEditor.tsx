import React, { useMemo } from 'react'
import { DndContext, PointerSensor, useSensor, useSensors, closestCenter } from '@dnd-kit/core'
import { SortableContext, useSortable, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { TableColumn } from './TableFieldTypes'

function SortableRow({ id, children }:{ id:string, children:(args:{listeners:any})=>React.ReactNode }){
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id })
  const style:React.CSSProperties = { transform: CSS.Transform.toString(transform), transition }
  return <div ref={setNodeRef} style={style} {...attributes}>{children({ listeners })}</div>
}

function slugify(s:string){
  return s.toLowerCase().trim().replace(/[^\w]+/g, '_').replace(/^_+|_+$/g, '')
}

export default function TableColumnsEditor({
  columns,
  onChange
}:{
  columns: TableColumn[],
  onChange: (cols: TableColumn[]) => void
}){
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  function addCol(){
    const idx = columns.length
    const c: TableColumn = { id: 'c' + idx, key: 'c' + idx, label: 'Spalte ' + (idx+1), type:'text' }
    onChange([ ...columns, c ])
  }
  function removeCol(id:string){
    onChange(columns.filter(c => c.id !== id))
  }
  function patch(id:string, patch: Partial<TableColumn>){
    onChange(columns.map(c => c.id === id ? { ...c, ...patch } : c))
  }
  function onDragEnd(e:any){
    const active = e.active?.id; const over = e.over?.id
    if(!active || !over || active === over) return
    const oldIndex = columns.findIndex(c => c.id === active)
    const newIndex = columns.findIndex(c => c.id === over)
    if(oldIndex<0 || newIndex<0) return
    onChange(arrayMove(columns, oldIndex, newIndex))
  }

  const keyDupes = useMemo(() => {
    const map: Record<string, number> = {}
    for (const c of columns) map[c.key] = (map[c.key]||0) + 1
    const dups = new Set<string>()
    Object.keys(map).forEach(k => { if(map[k] > 1) dups.add(k) })
    return dups
  }, [columns])

  const sumManual = columns.reduce((acc, c) => acc + (typeof c.widthPct === 'number' ? Math.max(0, Math.min(100, c.widthPct)) : 0), 0)
  const manualInfo = Math.round(sumManual)

  const TYPES = ['text','number','select','checkbox','radio'] as const

  return (
    <div className="col-editor">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={columns.map(c=>c.id)} strategy={verticalListSortingStrategy}>
          {columns.map(c => {
            const dupe = keyDupes.has(c.key)
            return (
            <div key={c.id}>
              <SortableRow id={c.id}>
                {({ listeners }) => (
                  <div className="col-editor-row">
                    <div className="drag" {...listeners}>⋮⋮</div>
                    <input className="kirmas-input" value={c.label} onChange={e=>patch(c.id, { label: e.target.value })} placeholder="Label" />
                    <input
                      className={'kirmas-input' + (dupe ? ' invalid' : '')}
                      value={c.key}
                      onChange={e=>patch(c.id, { key: slugify(e.target.value) || 'col' })}
                      placeholder="Key (technisch)"
                      title={dupe ? 'Key ist nicht eindeutig' : ''}
                    />
                    <select className="kirmas-input" value={c.type} onChange={e=>patch(c.id, { type: e.target.value as any })}>
                      {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    {(c.type==='select' || c.type==='radio') ? (
                      <input className="kirmas-input" placeholder="Optionen: A,B,C" value={(c.options||[]).join(',')}
                             onChange={e=>patch(c.id, { options: e.target.value.split(',').map(s=>s.trim()).filter(Boolean) })} />
                    ) : <span className="hint"></span>}
                    <div className="row" style={{ gap:6, flexWrap:'wrap' }}>
                      <label className="row" style={{ gap:6 }}>
                        <input type="checkbox" checked={!!c.required} onChange={e=>patch(c.id, { required: e.target.checked })} />
                        Pflicht
                      </label>
                      {c.type==='number' && (
                        <>
                          <input type="number" className="kirmas-input" style={{ width:90 }} placeholder="min" value={c.min ?? ''} onChange={e=>patch(c.id, { min: e.target.value===''? undefined : Number(e.target.value) })} />
                          <input type="number" className="kirmas-input" style={{ width:90 }} placeholder="max" value={c.max ?? ''} onChange={e=>patch(c.id, { max: e.target.value===''? undefined : Number(e.target.value) })} />
                        </>
                      )}
                      {c.type==='text' && (
                        <input className="kirmas-input" placeholder="Regex z.B. ^[A-Z]{2}-\d{3}$" value={c.pattern || ''} onChange={e=>patch(c.id, { pattern: e.target.value })} />
                      )}
                    </div>

                    {/* Width slider */}
                    <div className="row" style={{ gap:8, alignItems:'center', flexWrap:'wrap' }}>
                      <small className="muted">Breite</small>
                      <input type="range" min={0} max={100} step={1}
                             value={typeof c.widthPct === 'number' ? c.widthPct : 0}
                             onChange={e=>patch(c.id, { widthPct: Number(e.target.value) || 0 })} />
                      <input type="number" className="kirmas-input" style={{ width:80 }}
                             value={typeof c.widthPct === 'number' ? c.widthPct : 0}
                             onChange={e=>patch(c.id, { widthPct: Number(e.target.value) || 0 })} />
                      <span className="hint">% (0 = Auto)</span>
                      <button className="btn" onClick={() => patch(c.id, { widthPct: 0 })}>Auto</button>
                    </div>
                    <button className="btn remove" onClick={()=>removeCol(c.id)}>–</button>
                  </div>
                )}
              </SortableRow>
              {dupe && <div className="warn">Achtung: Key „{c.key}“ ist doppelt.</div>}
            </div>
            )
          })}
        </SortableContext>
      </DndContext>

      <div className="row" style={{ marginTop:8, justifyContent:'space-between' }}>
        <button className="btn" onClick={addCol}>+ Spalte</button>
        <small className="muted">Summe feste Breiten: {manualInfo}% – Rest wird gleichmäßig verteilt.</small>
      </div>
    </div>
  )
}
