import React, { useMemo, useState } from 'react'
import { nanoid } from 'nanoid'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, useSortable, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { rectSortingStrategy } from '@dnd-kit/sortable'

import { CSS } from '@dnd-kit/utilities'
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
//import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png?url'
//import markerIcon from 'leaflet/dist/images/marker-icon.png?url'
//import markerShadow from 'leaflet/dist/images/marker-shadow.png?url'
import RuleEditor from './RuleEditor'
import { isVisible, type VisibilityRule } from '../rules/engine'
import TableField from './TableField'
import type { TableColumn } from './TableFieldTypes'
import TableColumnsEditor from './TableColumnsEditor'
import AiPanel from '../ai/AiPanel'
import EditorSaveToolbar from '../editor/EditorSaveToolbar';
import SelectOptionsEditor from './SelectOptionsEditor'

function PillBar({
  value, options, onRemove
}:{
  value: string[],
  options: {label:string, value:string}[],
  onRemove: (val:string)=>void
}){
  const map = new Map(options.map(o=>[o.value, o.label]))
  return (
    <div className="pillbar">
      {value.map(v=>(
        <span key={v} className="pill">
          {map.get(v) ?? v}
          <button className="pill-x" onClick={(e)=>{e.preventDefault(); onRemove(v)}} aria-label="Entfernen">×</button>
        </span>
      ))}
      {!value.length && <span className="muted" style={{fontSize:12}}>Keine Auswahl</span>}
    </div>
  )
}

// Ensure leaflet default marker icons work with bundlers
//delete (L.Icon.Default.prototype as any)._getIconUrl;
///L.Icon.Default.mergeOptions({
//  iconRetinaUrl: markerIcon2x,
//  iconUrl: markerIcon,
//  shadowUrl: markerShadow,
//})

type GeoValue = { lat:number, lng:number }
type FieldStyle = { border?:boolean; borderColor?:string; fontWeight?:'normal'|'bold'; color?:string }
type Field = {id:string; type:string; label?:string; name?:string; placeholder?:string; tooltip?:string;
  value?:any; min?:number; max?:number; step?:number; multiple?: boolean; options?:Array<string|{label:string,value:string
}>; height?:number;
  required?:boolean; tabIndex?:number; style?:FieldStyle;
  colSpan?: number;
  visibility?: VisibilityRule;
  columns?: TableColumn[];
  pattern?: string;
}
type Block = { id:string; title:string; fields:Field[]; visibility?: VisibilityRule }
type Section = { id:string; title:string; blocks:Block[]; visibility?: VisibilityRule }
type Page = { id:string; title:string; sections:Section[]; visibility?: VisibilityRule }
type Survey = { id:string; title:string; pages:Page[] }

const newId = (p='id') => `${p}_${nanoid(6)}`
const deepClone = <T,>(x:T):T => structuredClone(x)
const uid = () => Math.random().toString(36).slice(2,10)
function ensureIds(s:any){
  for (const p of s.pages||[]) {
    p.id ||= 'pg_'+uid()
    for (const se of p.sections||[]) {
      se.id ||= 'sec_'+uid()
      for (const b of se.blocks||[]) {
        b.id ||= 'blk_'+uid()
        for (const f of b.fields||[]) f.id ||= 'fld_'+uid()
      }
    }
  }
  return s
}

function SortableItem({
  id, children, style: extraStyle, className = ''
}:{
  id: string,
  children: (args:{listeners:any}) => React.ReactNode,
  style?: React.CSSProperties,
  className?: string
}){
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id })
  const style:React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    ...(extraStyle || {})
  }
  return <div ref={setNodeRef} style={style} className={className} {...attributes}>{children({ listeners })}</div>
}

function ClickToAddMarker({ onSet }:{ onSet:(pos:GeoValue)=>void }){
  useMapEvents({ click(e){ onSet({ lat:e.latlng.lat, lng:e.latlng.lng }) } })
  return null
}

function DraggableMarker({ position, onDragEnd }:{ position:[number,number], onDragEnd:(pos:GeoValue)=>void }){
  const [pos, setPos] = useState(position)
  const eventHandlers = useMemo(() => ({
    dragend(e:any){
      const ll = e.target.getLatLng()
      setPos([ll.lat, ll.lng])
      onDragEnd({ lat: ll.lat, lng: ll.lng })
    }
  }), [onDragEnd])
  return <Marker draggable eventHandlers={eventHandlers} position={pos} />
}

function GeoPicker({ value, onChange, height=320 }:{ value?:GeoValue, onChange:(v:GeoValue)=>void, height?:number }){
  const center = useMemo(()=> value?.lat && value?.lng ? [value.lat, value.lng] : [54.093, 13.387], [value]) as [number,number]
  const handleSet = (pos:GeoValue)=> onChange(pos)
  return (
    <div style={{ border:'1px solid #ddd', borderRadius:8, overflow:'hidden' }}>
      <MapContainer center={center} zoom={10} style={{ height }}>
        <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <ClickToAddMarker onSet={handleSet} />
        {value?.lat && value?.lng && <DraggableMarker position={[value.lat, value.lng]} onDragEnd={handleSet} />}
      </MapContainer>
      <div style={{ padding:8, fontSize:12 }}>
        {value?.lat ? `Lat: ${value.lat.toFixed(6)}  Lng: ${value.lng.toFixed(6)}` : 'Karte klicken, um Position zu setzen.'}
      </div>
    </div>
  )
}

type FieldRendererProps = {
  field: any,
  onChange: (v:any)=>void,
  errors: Record<string, string | undefined>,
  setErrors: React.Dispatch<React.SetStateAction<Record<string, string | undefined>>>,
  validateField: (field:any, value:any)=>string | undefined
}

function FieldRenderer({ field, onChange, errors, setErrors, validateField }: FieldRendererProps){
  const common = {
    id:field.id, name:field.name||field.id, placeholder:field.placeholder||'', title:field.tooltip||'',
    style: field.style?.border ? { borderColor: field.style.borderColor } : undefined,
    className: 'kirmas-input',
    tabIndex: field.tabIndex ?? 0
  } as any
  const label = field.label || field.type
  const labelStyle:React.CSSProperties = { fontWeight: field.style?.fontWeight||'normal', color: field.style?.color }
  const fid = String(field.id ?? field.name ?? '')

  switch(field.type){
    case 'text': {
      const v = String(field.value ?? '')
      return (
        <div>
          <label style={labelStyle}>
            {label}{field.required && <span style={{color:'#c00'}}> *</span>}
          </label>
          <input
            {...common}
            type="text"
            value={v}
            onChange={e=>{
              const next = e.target.value
              onChange(next)
              const err = validateField(field, next)
              setErrors(prev => ({ ...prev, [fid]: err }))
            }}
          />
          {errors[fid] && <div className="input-error">{errors[fid]}</div>}
        </div>
      )
    }

    case 'number': {
      const v = field.value ?? ''
      return (
        <div>
          <label style={labelStyle}>
            {label}{field.required && <span style={{color:'#c00'}}> *</span>}
          </label>
          <input
            {...common}
            type="number"
            value={v}
            onChange={e=>{
              const raw = e.target.value
              const next = raw === '' ? '' : Number(raw)
              onChange(next)
              const err = validateField(field, next)
              setErrors(prev => ({ ...prev, [fid]: err }))
            }}
          />
          {errors[fid] && <div className="input-error">{errors[fid]}</div>}
        </div>
      )
    }

    case 'tel':
    case 'phone':
    case 'telephone': {
      const v = String(field.value ?? '')
      return (
        <div>
          <label style={labelStyle}>
            {(field.label || field.name || field.id || 'Telefon')}{field.required && <span style={{color:'#c00'}}> *</span>}
          </label>
          <input
            {...common}
            type="tel"
            value={v}
            onChange={e=>{
              const next = e.target.value
              onChange(next)
              const err = validateField(field, next)
              setErrors(prev => ({ ...prev, [fid]: err }))
            }}
          />
          {errors[fid] && <div className="input-error">{errors[fid]}</div>}
        </div>
      )
    }

    case 'email': {
      const v = String(field.value ?? '')
      return (
        <div>
          <label style={labelStyle}>{label}{field.required && <span style={{color:'#c00'}}> *</span>}</label>
          <input
            {...common}
            type="email"
            value={v}
            onChange={e=>{
              const next = e.target.value
              onChange(next)
              const err = validateField(field, next)
              setErrors(prev => ({ ...prev, [fid]: err }))
            }}
          />
          {errors[fid] && <div className="input-error">{errors[fid]}</div>}
        </div>
      )
    }

    case 'date':
      return <div><label style={labelStyle}>{label}{field.required && <span style={{color:'#c00'}}> *</span>}</label><input {...common} type="date" value={field.value ?? ''} onChange={e=>onChange(e.target.value)} /></div>
    case 'time':
      return <div><label style={labelStyle}>{label}{field.required && <span style={{color:'#c00'}}> *</span>}</label><input {...common} type="time" value={field.value ?? ''} onChange={e=>onChange(e.target.value)} /></div>
    case 'textarea': {
      const v = String(field.value ?? '')
      return (
        <div>
          <label style={labelStyle}>{label}{field.required && <span style={{color:'#c00'}}> *</span>}</label>
          <textarea
            {...common}
            value={v}
            onChange={e=>{
              const next = e.target.value
              onChange(next)
              const err = validateField(field, next)
              setErrors(prev => ({ ...prev, [fid]: err }))
            }}
            className="kirmas-textarea"
          />
          {errors[fid] && <div className="input-error">{errors[fid]}</div>}
        </div>
      )
    }
    case 'checkbox': {
      // Zwei Varianten:
      // A) ohne options => Single-Checkbox (boolean)
      // B) mit options => Multi-Checkboxen (array von values)
      const opts = (field.options || []).map((o:any)=>
        typeof o==='string' ? { label:o, value:o } : o
      )

      const isMulti = opts.length > 0

      if (!isMulti) {
        const checked = !!field.value
        return (
          <div>
            <label style={{ display:'flex', gap:8, alignItems:'center' }}>
              <input
                className="kirmas-input"
                type="checkbox"
                checked={checked}
                onChange={e=>{
                  const next = e.target.checked
                  onChange(next)
                  const err = validateField(field, next)
                  setErrors(prev => ({ ...prev, [fid]: err }))
                }}
              />
              <span>{(field.label || field.name || field.id || 'Checkbox')}{field.required && <span style={{color:'#c00'}}> *</span>}</span>
            </label>
            {errors[fid] && <div className="input-error">{errors[fid]}</div>}
          </div>
        )
      }

      // Multi-Checkboxen
      const val: string[] = Array.isArray(field.value) ? field.value : []
      return (
        <div>
          <label style={{ display:'block', fontWeight:600, marginBottom:6 }}>
            {(field.label || field.name || field.id || 'Auswahl')}{field.required && <span style={{color:'#c00'}}> *</span>}
          </label>
          <div className="row" style={{ gap:12, flexWrap:'wrap' }}>
            {opts.map((o, i)=>(
              <label key={i} className="row" style={{ gap:6, alignItems:'center' }}>
                <input
                  type="checkbox"
                  checked={val.includes(o.value)}
                  onChange={e=>{
                    const next = e.target.checked
                      ? [...val, o.value]
                      : val.filter(v=>v!==o.value)
                    onChange(next)
                    const err = validateField(field, next)
                    setErrors(prev => ({ ...prev, [fid]: err }))
                  }}
                />
                <span>{o.label}</span>
              </label>
            ))}
          </div>
          {errors[fid] && <div className="input-error">{errors[fid]}</div>}
        </div>
      )
    }

    case 'multiselect':
      field = { ...field, type: 'select', multiple: true } as any;
    case 'select': {
      const opts = (field.options || []).map((o:any)=> typeof o==='string' ? {label:o, value:o} : o)
      const multiple = !!field.multiple
      const val = multiple
        ? (Array.isArray(field.value) ? field.value : [])
        : (field.value ?? '')

      return (
        <div>
          <label style={{ display:'block', fontWeight:600, marginBottom:6 }}>
            {(field.label || field.name || field.id || 'Feld')}{field.required && <span style={{color:'#c00'}}> *</span>}
          </label>

          {multiple && (
            <PillBar
              value={val as string[]}
              options={opts}
              onRemove={(v:string)=>{
                const next = (val as string[]).filter(x=>x!==v)
                onChange(next)
                const err = validateField(field, next)
                setErrors(prev => ({ ...prev, [fid]: err }))
              }}
            />
          )}

          <select
            className="kirmas-select"
            multiple={multiple}
            value={multiple ? (val as string[]) : String(val)}
            onChange={(e)=>{
              if (multiple) {
                const arr = Array.from(e.target.selectedOptions).map(o=>o.value)
                onChange(arr)
                const err = validateField(field, arr)
                setErrors(prev => ({ ...prev, [fid]: err }))
              } else {
                const next = e.target.value
                onChange(next)
                const err = validateField(field, next)
                setErrors(prev => ({ ...prev, [fid]: err }))
              }
            }}
            size={multiple ? Math.min(6, Math.max(3, (opts.length || 0))) : undefined}
          >
            {!multiple && <option value="">— bitte wählen —</option>}
            {opts.map((o, i)=> <option key={i} value={o.value}>{o.label}</option>)}
          </select>
          {errors[fid] && <div className="input-error">{errors[fid]}</div>}
        </div>
      )
    }
    case 'slider':
      return <div><label style={labelStyle}>{label}{field.required && <span style={{color:'#c00'}}> *</span>}</label><input type="range" min={field.min ?? 0} max={field.max ?? 100} step={field.step ?? 1} value={field.value ?? field.min ?? 0} onChange={e=>onChange(Number(e.target.value))}/></div>
    case 'geo':
      return <div><label style={labelStyle}>{label}{field.required && <span style={{color:'#c00'}}> *</span>}</label><GeoPicker value={field.value} onChange={onChange} /></div>
    case 'table':
      return <div><label style={labelStyle}>{label}</label><TableField columns={field.columns||[]} value={field.value||[]} onChange={onChange} nameForExport={field.name || field.label} /></div>
    case 'hidden':
      return <input type="hidden" value={field.value ?? ''} />
    case 'line-h':
      return <hr />
    case 'line-v':
      return <div style={{ width:1, alignSelf:'stretch', background:'#ccc', margin:'4px 8px' }} />
    case 'radio': {
      const name = field.name || field.id
      const opts = (field.options || []).map((o:any)=> typeof o==='string' ? {label:o, value:o} : o)
      return (
        <div>
          <label style={labelStyle}>{label}{field.required && <span style={{color:'#c00'}}> *</span>}</label>
          <div className="row" style={{ gap:16, flexWrap:'wrap', marginTop:6 }}>
            {opts.map((o:any, idx:number) => (
              <label key={idx} className="row" style={{ gap:6 }}>
                <input
                  type="radio"
                  name={name}
                  value={o.value}
                  checked={field.value === o.value}
                  onChange={() => {
                    const next = o.value
                    onChange(next)
                    const err = validateField(field, next)
                    setErrors(prev => ({ ...prev, [fid]: err }))
                  }}
                />
                {o.label}
              </label>
            ))}
          </div>
          {errors[fid] && <div className="input-error">{errors[fid]}</div>}
        </div>
      )
    }

    case 'map':
    case 'geolocation':
    case 'geoloc':
    case 'geopoint':
    case 'coordinate':
    case 'coordinates':
    case 'latlng':
    case 'location':
    case 'location_picker':
    case 'coordinate_picker':
      return (
        <div>
          <label style={labelStyle}>
            {label}{field.required && <span style={{color:'#c00'}}> *</span>}
          </label>
          <GeoPicker value={field.value} onChange={onChange} />
        </div>
      )

    default:
      return <div style={{ color:'#888' }}>[{field.type}] – noch ohne Renderer</div>
  }
}

type Selection =
  | { kind:'field', pageId:string, sectionId:string, blockId:string, fieldId:string }
  | { kind:'block', pageId:string, sectionId:string, blockId:string }
  | { kind:'section', pageId:string, sectionId:string }
  | { kind:'page', pageId:string }

function FieldProperties({ field, onPatch, ruleEditor }:{
  field: any,
  onPatch:(f:any)=>void,
  ruleEditor: React.ReactNode
}){
  const set = (k:any, v:any) => onPatch({ [k]: v })
  const setStyle = (k:any, v:any) => onPatch({ style: { ...(field.style||{}), [k]: v } })
  const setOptions = (text:string) => {
    const arr = text.split('\\n').map(s=>s.trim()).filter(Boolean)
    onPatch({ options: arr })
  }

  return (
    <div className="card">
      <strong>Feld-Eigenschaften</strong>
      <div style={{ display:'grid', gap:8, marginTop:8 }}>
        <div>
          <div><small className="muted">Technischer Name</small></div>
          <input className="kirmas-input" value={field.name||''} onChange={e=>set('name', e.target.value)} />
        </div>
        <div>
          <div><small className="muted">Angezeigter Titel</small></div>
          <input className="kirmas-input" value={field.label||''} onChange={e=>set('label', e.target.value)} />
        </div>
        <div>
          <div><small className="muted">Beispielwert</small></div>
          <input className="kirmas-input" value={field.placeholder||''} onChange={e=>set('placeholder', e.target.value)} />
        </div>
        <div>
          <div><small className="muted">Tooltip</small></div>
          <input className="kirmas-input" value={field.tooltip||''} onChange={e=>set('tooltip', e.target.value)} />
        </div>

        <div className="row" style={{ gap:8 }}>
          <label className="row" style={{ gap:6 }}>
            <input type="checkbox" checked={!!field.required} onChange={e=>set('required', e.target.checked)} />
            Pflichtfeld
          </label>
          <div style={{ width:120 }}>
            <div><small className="muted">TabIndex</small></div>
            <input type="number" className="kirmas-input" value={field.tabIndex??0} onChange={e=>set('tabIndex', Number(e.target.value))} />
          </div>
          <div style={{ width:160 }}>
            <div><small className="muted">Breite (1–12)</small></div>
            <input type="number" min={1} max={12} className="kirmas-input" value={field.colSpan ?? 12} onChange={e=>set('colSpan', Math.min(12, Math.max(1, Number(e.target.value)||12)))} />
          </div>
        </div>

        {(field.type==='number' || field.type==='slider') && (
          <div className="row" style={{ gap:8 }}>
            <div>
              <div><small className="muted">Min</small></div>
              <input type="number" className="kirmas-input" value={field.min??''} onChange={e=>set('min', e.target.value===''?undefined:Number(e.target.value))} />
            </div>
            <div>
              <div><small className="muted">Max</small></div>
              <input type="number" className="kirmas-input" value={field.max??''} onChange={e=>set('max', e.target.value===''?undefined:Number(e.target.value))} />
            </div>
            <div>
              <div><small className="muted">Step</small></div>
              <input type="number" className="kirmas-input" value={field.step??''} onChange={e=>set('step', e.target.value===''?undefined:Number(e.target.value))} />
            </div>
          </div>
        )}

        {(field.type==='select') && (
          <div>
            <div><small className="muted">Optionen (eine pro Zeile)</small></div>
            <SelectOptionsEditor key={field.id || field.name} value={field.options || []} onChange={(opts)=>set('options', opts)} />
            <div className="row" style={{ gap:8, marginTop:6 }}>
              <label className="row" style={{ gap:6 }}>
                <input
                  type="checkbox"
                  checked={!!field.multiple}
                  onChange={e => set('multiple', e.target.checked)}
                />
                Mehrfachauswahl
              </label>
            </div>
  
          </div>
        )}

        {(field.type==='table') && (
          <div>
            <div style={{ marginBottom:6 }}><small className="muted">Tabellenspalten</small></div>
            <TableColumnsEditor
              columns={field.columns||[]}
              onChange={(cols)=>onPatch({ columns: cols })}
            />
          </div>
        )}

        <div style={{ borderTop:'1px solid #eee', paddingTop:8 }}>
          <div><small className="muted">Darstellung</small></div>
          <div className="row" style={{ gap:8 }}>
            <label className="row" style={{ gap:6 }}>
              <input type="checkbox" checked={field.style?.border ?? true} onChange={e=>setStyle('border', e.target.checked)} />
              Rahmen
            </label>
            <div>
              <div><small className="muted">Rahmenfarbe</small></div>
              <input type="color" className="kirmas-input" value={field.style?.borderColor || '#d1d5db'} onChange={e=>setStyle('borderColor', e.target.value)} />
            </div>
            <div>
              <div><small className="muted">Schrift</small></div>
              <select className="kirmas-input" value={field.style?.fontWeight || 'normal'} onChange={e=>setStyle('fontWeight', e.target.value as any)}>
                <option value="normal">normal</option>
                <option value="bold">bold</option>
              </select>
            </div>
            <div>
              <div><small className="muted">Farbe</small></div>
              <input type="color" className="kirmas-input" value={field.style?.color || '#111827'} onChange={e=>setStyle('color', e.target.value)} />
            </div>
          </div>
        </div>
      </div>

      <div style={{ borderTop:'1px solid #eee', paddingTop:8, marginTop:8 }}>
        <strong>Regeln für Sichtbarkeit</strong>
        <div style={{ marginTop:8 }}>
          {ruleEditor}
        </div>
      </div>
    </div>
  )
}

function TitleAndRules({
  title, onTitle, ruleEditor, titleLabel='Titel'
}:{
  title: string, onTitle: (t:string)=>void, ruleEditor: React.ReactNode, titleLabel?: string
}){
  return (
    <div className="card">
      <div>
        <div><small className="muted">{titleLabel}</small></div>
        <input className="kirmas-input" value={title} onChange={e=>onTitle(e.target.value)} />
      </div>
      <div style={{ borderTop:'1px solid #eee', paddingTop:8, marginTop:8 }}>
        <strong>Regeln für Sichtbarkeit</strong>
        <div style={{ marginTop:8 }}>
          {ruleEditor}
        </div>
      </div>
    </div>
  )
}

export default function KirmasEditor(){
  const [schema, setSchema] = useState<Survey>({
    id: newId('survey'),
    title: 'KIRMAS – Erhebungs-Editor',
    pages: [
      {
        id: newId('page'),
        title: 'Seite 1',
        sections: [
          {
            id: newId('section'),
            title: 'Allgemein',
            blocks: [
              {
                id: newId('block'),
                title: 'Einsatzort',
                fields: [
                  { id: newId('field'), type:'checkbox', label:'Einsatz aktiv?', name:'einsatz_aktiv', colSpan: 4 },
                  { id: newId('field'), type:'text',  label:'Einsatzbezeichnung', name:'einsatz_name', placeholder:'z. B. Hochwasser Übung 2025', colSpan: 8 },
                  { id: newId('field'), type:'select', label:'Kategorie', name:'kategorie', options:['A','B','C'], colSpan: 4 },
                  { id: newId('field'), type:'geo',   label:'Geoposition',        name:'einsatz_geo', colSpan: 8 },
                ]
              },
              {
                id: newId('block'),
                title: 'Adresse',
                fields: [
                  { id: newId('field'), type:'text', label:'PLZ', name:'plz', colSpan: 3 },
                  { id: newId('field'), type:'text', label:'Ort', name:'ort', colSpan: 9 },
                  { id: newId('field'), type:'text', label:'Straße', name:'strasse', colSpan: 8 },
                  { id: newId('field'), type:'number', label:'Haus-Nr.', name:'hausnr', colSpan: 4 },
                ]
              },
              {
                id: newId('block'),
                title: 'Material (Tabelle)',
                fields: [
                  { id: newId('field'), type:'table', label:'Material-Liste', name:'material', colSpan: 12, columns:[
                    { id:'c0', key:'bezeichnung', label:'Bezeichnung', type:'text', required:true },
                    { id:'c1', key:'anzahl', label:'Anzahl', type:'number', min:0 },
                    { id:'c2', key:'zustand', label:'Zustand', type:'select', options:['ok','mangelhaft','defekt'], required:true },
                    { id:'c3', key:'einsatzbereit', label:'Einsatzbereit', type:'checkbox' }
                  ] },
                ]
              },
              {
                id: newId('block'),
                title: 'Kontakt',
                fields: [
                  { id: newId('field'), type:'text',  label:'Anrede', name:'anrede', colSpan: 3 },
                  { id: newId('field'), type:'text',  label:'Titel', name:'titel', colSpan: 3 },
                  { id: newId('field'), type:'text',  label:'Vorname', name:'vorname', colSpan: 3 },
                  { id: newId('field'), type:'text',  label:'Nachname', name:'nachname', colSpan: 3 },
                  { id: newId('field'), type:'text',  label:'Vorwahl', name:'vorwahl', colSpan: 3 },
                  { id: newId('field'), type:'text',  label:'Telefon', name:'telefon', colSpan: 9 },
                  { id: newId('field'), type:'email', label:'E-Mail', name:'email', colSpan: 12 },
                ]
              }
            ]
          }
        ]
      },
      { id: newId('page'), title:'Seite 2', sections:[] }
    ]
  })

  const [selected, setSelected] = useState<any>(null)
  const [preview, setPreview] = useState(true)
  const [aiOpen, setAiOpen] = useState(false)
  const [errors, setErrors] = useState<Record<string, string | undefined>>({})

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 }}))

  type WithId = { id: string };
  const reorder = <T extends WithId>(list: T[], fromId: string, toId: string): T[] => {
    const oldIndex = list.findIndex((i) => i.id === fromId)
    const newIndex = list.findIndex((i) => i.id === toId)
    if (oldIndex === -1 || newIndex === -1) return list
    return arrayMove(list, oldIndex, newIndex)
  }

  function getMeta(id:string){
    for (let pi=0; pi<schema.pages.length; pi++){
      const p = schema.pages[pi]
      if (p.id === id) return { level:'page' as const, pi }
      for (let si=0; si<p.sections.length; si++){
        const s = p.sections[si]
        if (s.id === id) return { level:'section' as const, pi, si }
        for (let bi=0; bi<s.blocks.length; bi++){
          const b = s.blocks[bi]
          if (b.id === id) return { level:'block' as const, pi, si, bi }
          for (let fi=0; fi<b.fields.length; fi++){
            const f = b.fields[fi]
            if (f.id === id) return { level:'field' as const, pi, si, bi, fi }
          }
        }
      }
    }
    return null
  }

  function onDragEnd(evt:any){
    const active = evt.active?.id as string|undefined
    const over   = evt.over?.id as string|undefined
    if (!active || !over || active === over) return
    const a = getMeta(active); const o = getMeta(over); if(!a || !o) return

    setSchema(prev => {
      const d = structuredClone(prev)
      if (a.level !== o.level) return d

      if (a.level === 'page'){
        d.pages = reorder(d.pages as any, active, over) as any
        return d
      }
      if (a.level === 'section'){
        if (a.pi === o.pi){
          d.pages[a.pi].sections = reorder(d.pages[a.pi].sections as any, active, over) as any
        } else {
          const sec = d.pages[a.pi].sections.splice(a.si!,1)[0]
          const targetList = d.pages[o.pi].sections
          const targetIndex = targetList.findIndex(x=>x.id===over)
          targetList.splice(targetIndex, 0, sec)
        }
        return d
      }
      if (a.level === 'block'){
        if (a.pi === o.pi && a.si === o.si){
          d.pages[a.pi].sections[a.si!].blocks = reorder(d.pages[a.pi].sections[a.si!].blocks as any, active, over) as any
        } else {
          const blk = d.pages[a.pi].sections[a.si!].blocks.splice(a.bi!,1)[0]
          const targetList = d.pages[o.pi].sections[o.si!].blocks
          const targetIndex = targetList.findIndex(x=>x.id===over)
          targetList.splice(targetIndex, 0, blk)
        }
        return d
      }
      if (a.level === 'field'){
        if (a.pi === o.pi && a.si === o.si && a.bi === o.bi){
          d.pages[a.pi].sections[a.si!].blocks[a.bi!].fields = reorder(d.pages[a.pi].sections[a.si!].blocks[a.bi!].fields as any, active, over) as any
        } else {
          const fld = d.pages[a.pi].sections[a.si!].blocks[a.bi!].fields.splice(a.fi!,1)[0]
          const targetList = d.pages[o.pi].sections[o.si!].blocks[o.bi!].fields
          const targetIndex = targetList.findIndex(x=>x.id===over)
          targetList.splice(targetIndex, 0, fld)
        }
        return d
      }
      return d
    })
  }

  function validateField(field:any, value:any): string | undefined {
    // Pflicht
    if (field.required) {
      const empty = value===undefined || value===null || value==='' || (Array.isArray(value)&&value.length===0)
      if (empty) return 'Pflichtfeld'
    }
    // number: min/max
    if (field.type==='number' || field.type==='slider') {
      if (value!=='' && value!==null && value!==undefined) {
        const num = Number(value)
        if (Number.isFinite(num)) {
          if (typeof field.min==='number' && num < field.min) return `≥ ${field.min}`
          if (typeof field.max==='number' && num > field.max) return `≤ ${field.max}`
        }
      }
    }
    // Regex (optional: field.pattern)
    if (field.pattern) {
      try {
        const re = new RegExp(field.pattern)
        if (!re.test(String(value??''))) return 'Ungültiges Format'
      } catch {}
    }
    // Email (einfach)
    if (field.type==='email') {
      const v = String(value ?? '')
      if (v && !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(v)) return 'Ungültige E-Mail'
    }
    return undefined
  }

  const addPage = () => setSchema(prev => ({ ...prev, pages:[...prev.pages, { id:newId('page'), title:`Seite ${prev.pages.length+1}`, sections:[] }] }))
  const addSection = (pageId:string) => setSchema(prev => { const d=structuredClone(prev); const p=d.pages.find(x=>x.id===pageId)!; p.sections.push({ id:newId('section'), title:'Neuer Bereich', blocks:[] }); return d })
  const addBlock = (pageId:string, sectionId:string) => setSchema(prev => { const d=structuredClone(prev); const s=d.pages.find(p=>p.id===pageId)!.sections.find(s=>s.id===sectionId)!; s.blocks.push({ id:newId('block'), title:'Neuer Block', fields:[] }); return d })
  const addField = (pageId:string, sectionId:string, blockId:string, type:string) => setSchema(prev => { const d=structuredClone(prev); const b=d.pages.find(p=>p.id===pageId)!.sections.find(s=>s.id===sectionId)!.blocks.find(b=>b.id===blockId)!; const base:any = { id:newId('field'), type, label:type.toUpperCase(), name:`${type}_${b.fields.length+1}`, colSpan: 12 }; if(type==='table'){ base.columns=[{id:'c0', key:'col0', label:'Spalte 1', type:'text'}] } ; b.fields.push(base); return d })
  const setFieldValue = (pageId:string, sectionId:string, blockId:string, fieldId:string, value:any) => setSchema(prev => { const d=structuredClone(prev); const f=d.pages.find(p=>p.id===pageId)!.sections.find(s=>s.id===sectionId)!.blocks.find(b=>b.id===blockId)!.fields.find(f=>f.id===fieldId)!; f.value = value; return d })
  const patchField = (ids:any, patch:any) => setSchema(prev => { const d=structuredClone(prev); const f=d.pages.find(p=>p.id===ids.pageId)!.sections.find(s=>s.id===ids.sectionId)!.blocks.find(b=>b.id===ids.blockId)!.fields.find(f=>f.id===ids.fieldId)!; Object.assign(f, patch); return d })
  const patchBlock = (ids:any, patch:any) => setSchema(prev => { const d=structuredClone(prev); const b=d.pages.find(p=>p.id===ids.pageId)!.sections.find(s=>s.id===ids.sectionId)!.blocks.find(b=>b.id===ids.blockId)!; Object.assign(b, patch); return d })
  const patchSection = (ids:any, patch:any) => setSchema(prev => { const d=structuredClone(prev); const s=d.pages.find(p=>p.id===ids.pageId)!.sections.find(s=>s.id===ids.sectionId)!; Object.assign(s, patch); return d })
  const patchPage = (ids:any, patch:any) => setSchema(prev => { const d=structuredClone(prev); const p=d.pages.find(p=>p.id===ids.pageId)!; Object.assign(p, patch); return d })
  const removeField = (ids:any) => setSchema(prev => { const d=structuredClone(prev); const list=d.pages.find(p=>p.id===ids.pageId)!.sections.find(s=>s.id===ids.sectionId)!.blocks.find(b=>b.id===ids.blockId)!.fields; const idx=list.findIndex((x:any)=>x.id===ids.fieldId); if(idx>=0) list.splice(idx,1); return d })

  function removePage(pageId:string){
    setSchema(prev=>{
      const d = structuredClone(prev)
      const idx = d.pages.findIndex((p:any)=>p.id===pageId)
      if (idx<0) return d
      if ((d.pages[idx].sections || []).length > 0) {
        alert('Diese Seite enthält Bereiche und kann nicht gelöscht werden.')
        return d
      }
      d.pages.splice(idx,1)
      return d
    })
  }

  function removeSection(pageId:string, sectionId:string){
    setSchema(prev=>{
      const d = structuredClone(prev)
      const p = d.pages.find((x:any)=>x.id===pageId)
      if (!p) return d
      const idx = p.sections.findIndex((s:any)=>s.id===sectionId)
      if (idx<0) return d
      if ((p.sections[idx].blocks || []).length > 0) {
        alert('Dieser Bereich enthält Blöcke und kann nicht gelöscht werden.')
        return d
      }
      p.sections.splice(idx,1)
      return d
    })
  }

  function removeBlock(pageId:string, sectionId:string, blockId:string){
    setSchema(prev=>{
      const d = structuredClone(prev)
      const p = d.pages.find((x:any)=>x.id===pageId)
      if (!p) return d
      const s = p.sections.find((x:any)=>x.id===sectionId)
      if (!s) return d
      const idx = s.blocks.findIndex((b:any)=>b.id===blockId)
      if (idx<0) return d
      if ((s.blocks[idx].fields || []).length > 0) {
        alert('Dieser Block enthält Felder und kann nicht gelöscht werden.')
        return d
      }
      s.blocks.splice(idx,1)
      return d
    })
  }

  const values = useMemo(() => {
    const m: Record<string, any> = {}
    for (const p of schema.pages) for (const s of p.sections) for (const b of s.blocks) for (const f of b.fields) {
      const key = f.name || f.id
      m[key] = f.value
    }
    return m
  }, [schema])

    const fieldOptions = useMemo(() => {
    const arr: {name:string, label:string, options?:string[]}[] = []
    for (const p of (schema.pages ?? [])) {
      for (const s of (p.sections ?? [])) {
        for (const b of (s.blocks ?? [])) {
          for (const f of (b.fields ?? [])) {
            const name = f.name || f.id
            const label = `${f.label || f.type} [${name}]`
            const options = Array.isArray(f.options) ? f.options.map((o:any)=> typeof o==='string'?o:o.label) : undefined
            arr.push({ name, label, options })
          }
        }
      }
    }
    return arr
  }, [schema])

  const suggestForField = (fieldName: string) => fieldOptions.find(o => o.name === fieldName)?.options

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd} >
      <div style={{ display:'grid', gridTemplateColumns:'1fr 420px', gap:16 }}>
        {/* LEFT: Editor */}
        <div>
          <div className="row" style={{ justifyContent:'space-between', margin:'8px 0' }}>
            <div className="row" style={{ gap:8 }}>
              <button className="btn" onClick={()=>addPage()}>+ Seite</button>
              <button className="btn" onClick={()=>setPreview(p=>!p)}>{preview ? 'Vorschau AUS' : 'Vorschau AN'}</button>
              <button className="btn" onClick={()=>setAiOpen(true)}>KI-Assistent (Beta)</button>
              <EditorSaveToolbar getSchema={() => schema} />
            </div>
          </div>

          <SortableContext items={schema.pages.map(p=>p.id)} strategy={verticalListSortingStrategy}>
            {schema.pages.map((p) => {
              const visPage = preview ? isVisible(p.visibility, values) : true
              return (
              <SortableItem key={p.id} id={p.id}>
                {({ listeners }) => (
                  <div className="page-card" style={{ display: visPage ? undefined : 'none' }}>
                    <div
                      className="header row"
                      style={{ justifyContent:'space-between' }}
                      onClick={()=>setSelected({ kind:'page', pageId:p.id })}
                    >
                      {/* LINKER TEIL: Drag-Handle + Titel */}
                      <div className="row">
                        <div className="drag" {...listeners}>⋮⋮</div>
                        <input
                          className="title-input"
                          value={p.title}
                          onChange={e=>setSchema(prev=>{
                            const d = structuredClone(prev)
                            d.pages.find((x:any)=>x.id===p.id)!.title = e.target.value
                            return d
                          })}
                        />
                      </div>

                      {/* RECHTER TEIL: Buttons */}
                      <div className="row" style={{ gap:8 }}>
                        <button
                          className="btn"
                          onClick={(e)=>{ e.stopPropagation(); addSection(p.id) }}
                        >
                          + Bereich
                        </button>
                        <button
                          className="btn"
                          disabled={(p.sections||[]).length>0}
                          title={(p.sections||[]).length>0
                            ? 'Seite löschen nur möglich, wenn sie leer ist'
                            : 'Seite löschen'}
                          onClick={(e)=>{ e.stopPropagation(); if ((p.sections||[]).length===0) removePage(p.id) }}
                        >
                          Löschen
                        </button>
                      </div>
                    </div>


                    <SortableContext items={(p.sections||[]).map(s=>s.id)} strategy={verticalListSortingStrategy}>
                      {(p.sections||[]).map(s => {
                        const visSection = preview ? isVisible(s.visibility, values) : true
                        return (
                        <SortableItem key={s.id} id={s.id}>
                          {({ listeners }) => (
                            <div className="section" style={{ display: visSection ? undefined : 'none' }}>
                              <div
                                className="row"
                                style={{ justifyContent:'space-between' }}
                                onClick={()=>setSelected({ kind:'section', pageId:p.id, sectionId:s.id })}
                              >
                                {/* LINKER TEIL: Drag-Handle + Titel */}
                                <div className="row">
                                  <div className="drag" {...listeners}>⋮⋮</div>
                                  <input
                                    className="title-input"
                                    value={s.title}
                                    onChange={e=>setSchema(prev=>{
                                      const d = structuredClone(prev)
                                      d.pages.find((x:any)=>x.id===p.id)!
                                      .sections.find((x:any)=>x.id===s.id)!.title = e.target.value
                                      return d
                                    })}
                                  />
                                </div>

                                {/* RECHTER TEIL: Buttons */}
                                <div className="row" style={{ gap:8 }}>
                                  <button
                                    className="btn"
                                    onClick={(e)=>{ e.stopPropagation(); addBlock(p.id, s.id) }}
                                  >
                                    + Block
                                  </button>
                                  <button
                                    className="btn"
                                    disabled={(s.blocks||[]).length>0}
                                    title={(s.blocks||[]).length>0
                                      ? 'Bereich löschen nur möglich, wenn er leer ist'
                                      : 'Bereich löschen'}
                                    onClick={(e)=>{ e.stopPropagation(); if ((s.blocks||[]).length===0) removeSection(p.id, s.id) }}
                                  >
                                    Löschen
                                  </button>
                                </div>
                              </div>


                              <SortableContext items={s.blocks.map(b=>b.id)} strategy={verticalListSortingStrategy}>
                                {s.blocks.map(b => {
                                  const visBlock = preview ? isVisible(b.visibility, values) : true
                                  return (
                                  <SortableItem key={b.id} id={b.id}>
                                    {({ listeners }) => (
                                      <div className="block" style={{ display: visBlock ? undefined : 'none' }}>
                                        <div
                                          className="row"
                                          style={{ justifyContent:'space-between' }}
                                          onClick={()=>setSelected({ kind:'block', pageId:p.id, sectionId:s.id, blockId:b.id })}
                                        >
                                          {/* LINKER TEIL: Drag-Handle + Titel */}
                                          <div className="row">
                                            <div className="drag" {...listeners}>⋮⋮</div>
                                            <input
                                              className="title-input"
                                              value={b.title}
                                              onChange={e=>setSchema(prev=>{
                                                const d = structuredClone(prev)
                                                d.pages.find((x:any)=>x.id===p.id)!
                                                .sections.find((x:any)=>x.id===s.id)!
                                                .blocks.find((x:any)=>x.id===b.id)!.title = e.target.value
                                                return d
                                              })}
                                            />
                                          </div>

                                          {/* RECHTER TEIL: Buttons */}
                                          <div className="row" style={{ gap:8 }}>
                                            <AddFieldMenu onPick={(t)=>addField(p.id, s.id, b.id, t)} />
                                            <button
                                              className="btn"
                                              disabled={(b.fields||[]).length>0}
                                              title={(b.fields||[]).length>0
                                                ? 'Block löschen nur möglich, wenn er leer ist'
                                                : 'Block löschen'}
                                              onClick={(e)=>{ e.stopPropagation(); if ((b.fields||[]).length===0) removeBlock(p.id, s.id, b.id) }}
                                            >
                                              Löschen
                                            </button>
                                          </div>
                                        </div>


                                        <div className="block-grid">
                                          <SortableContext items={(b.fields||[]).map(f=>f.id)} strategy={rectSortingStrategy}>

                                            {(b.fields||[]).map(f => {
                                              const visField = preview ? isVisible(f.visibility, values) : true
                                              const span = Math.min(12, Math.max(1, f.colSpan ?? 12))
                                              return (
                                              <SortableItem key={f.id} id={f.id} className="grid-item" style={{ gridColumn: `span ${span}` }}>
                                                {({ listeners }) => (
                                                  <div
                                                    className="field-card"
                                                    style={{ display: visField ? undefined : 'none' }}
                                                    onClickCapture={()=> setSelected({ kind:'field', pageId:p.id, sectionId:s.id, blockId:b.id, fieldId:f.id })}
                                                  >
                                                    <div className="field-head">
                                                      <div className="drag" {...listeners}>⋮⋮</div>
                                                      <strong className="fh-label" title={f.label || f.type}>
                                                        {f.label || f.type}
                                                      </strong>
                                                      <div className="fh-meta">
                                                        <span className="fh-type">({f.type})</span>
                                                        <span className="fh-span">span {span}/12</span>
                                                      </div>
                                                      <button
                                                        className="btn btn-icon"
                                                        title="Feld entfernen"
                                                        onClick={(e)=>{ 
                                                          e.stopPropagation();
                                                          removeField({pageId:p.id, sectionId:s.id, blockId:b.id, fieldId:f.id}); 
                                                          if(selected && selected.kind==='field' && selected.fieldId===f.id) setSelected(null)
                                                        }}
                                                      >
                                                        ✕
                                                      </button>
                                                    </div>
                                                    <FieldRenderer
                                                      field={f}
                                                      onChange={(val)=>setFieldValue(p.id, s.id, b.id, f.id, val)}
                                                      errors={errors}
                                                      setErrors={setErrors}
                                                      validateField={validateField}
                                                    />
                                                  </div>
                                                )}
                                              </SortableItem>
                                              )
                                            })}
                                          </SortableContext>
                                        </div>
                                      </div>
                                    )}
                                  </SortableItem>
                                  )
                                })}
                              </SortableContext>
                            </div>
                          )}
                        </SortableItem>
                        )
                      })}
                    </SortableContext>
                  </div>
                )}
              </SortableItem>
              )
            })}
          </SortableContext>
        </div>

        {/* RIGHT: Properties panel with independent scroll */}
        <div className="prop-panel">
          {!selected ? (
            <div className="card" style={{ color:'#6b7280' }}>
              Element anklicken, um Eigenschaften und Regeln zu bearbeiten.
            </div>
          ) : selected.kind==='field' ? (
            <FieldProperties
              field={schema.pages.find(p=>p.id===selected.pageId)!.sections.find(s=>s.id===selected.sectionId)!.blocks.find(b=>b.id===selected.blockId)!.fields.find(f=>f.id===selected.fieldId)!}
              onPatch={(patch)=>patchField(selected, patch)}
              ruleEditor={
                <RuleEditor
                  value={schema.pages.find(p=>p.id===selected.pageId)!.sections.find(s=>s.id===selected.sectionId)!.blocks.find(b=>b.id===selected.blockId)!.fields.find(f=>f.id===selected.fieldId)!.visibility}
                  onChange={(v)=>patchField(selected, { visibility: v })}
                  fieldOptions={fieldOptions}
                  suggestForField={suggestForField}
                />
              }
            />
          ) : selected.kind==='block' ? (
            <TitleAndRules
              title={schema.pages.find(p=>p.id===selected.pageId)!.sections.find(s=>s.id===selected.sectionId)!.blocks.find(b=>b.id===selected.blockId)!.title}
              onTitle={(t)=>patchBlock(selected, { title: t })}
              titleLabel="Block-Titel"
              ruleEditor={
                <RuleEditor
                  value={schema.pages.find(p=>p.id===selected.pageId)!.sections.find(s=>s.id===selected.sectionId)!.blocks.find(b=>b.id===selected.blockId)!.visibility}
                  onChange={(v)=>patchBlock(selected, { visibility: v })}
                  fieldOptions={fieldOptions}
                  suggestForField={suggestForField}
                />
              }
            />
          ) : selected.kind==='section' ? (
            <TitleAndRules
              title={schema.pages.find(p=>p.id===selected.pageId)!.sections.find(s=>s.id===selected.sectionId)!.title}
              onTitle={(t)=>patchSection(selected, { title: t })}
              titleLabel="Bereichs-Titel"
              ruleEditor={
                <RuleEditor
                  value={schema.pages.find(p=>p.id===selected.pageId)!.sections.find(s=>s.id===selected.sectionId)!.visibility}
                  onChange={(v)=>patchSection(selected, { visibility: v })}
                  fieldOptions={fieldOptions}
                  suggestForField={suggestForField}
                />
              }
            />
          ) : (
            <TitleAndRules
              title={schema.pages.find(p=>p.id===selected.pageId)!.title}
              onTitle={(t)=>patchPage(selected, { title: t })}
              titleLabel="Seiten-Titel"
              ruleEditor={
                <RuleEditor
                  value={schema.pages.find(p=>p.id===selected.pageId)!.visibility}
                  onChange={(v)=>patchPage(selected, { visibility: v })}
                  fieldOptions={fieldOptions}
                  suggestForField={suggestForField}
                />
              }
            />
          )}
        </div>
      </div>
      <AiPanel
        open={aiOpen}
        onClose={()=>setAiOpen(false)}
        getSchema={()=>schema}
        onApply={(next)=>{ const withIds = ensureIds(next); setSchema(withIds); setSelected(null); }}
      />
    </DndContext>
  )
}

function AddFieldMenu({ onPick }:{ onPick:(t:string)=>void }){
  const [open,setOpen] = useState(false)
  const items:[string,string][] = [
    ['text','Text'], ['number','Zahl'], ['email','E-Mail'], ['date','Datum'], ['time','Uhrzeit'],
    ['textarea','Mehrzeilig'], ['checkbox','Checkbox'], ['radio','Radio'], ['select','Dropdown'], ['slider','Slider'],
    ['geo','Geoposition (Karte)'], ['table','Tabelle (dynamisch)'],
    ['line-h','Linie (horizontal)'], ['line-v','Linie (vertikal)'], ['hidden','Versteckt']
  ]
  return (
    <div style={{ position:'relative' }}>
      <button className="btn" onClick={()=>setOpen(v=>!v)}>+ Feld</button>
      {open && (
        <div style={{ position:'absolute', zIndex:10, right:0, marginTop:6, background:'#fff', border:'1px solid #ddd', borderRadius:8, minWidth:240, boxShadow:'0 6px 24px rgba(0,0,0,.08)' }}>
          {items.map(([t,label]) => (
            <div key={t} onMouseDown={e=>e.preventDefault()} onClick={()=>{ onPick(t); setOpen(false) }} style={{ padding:'8px 10px', cursor:'pointer' }}>{label}</div>
          ))}
        </div>
      )}
    </div>
  )
}