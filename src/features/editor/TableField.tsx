import React, { useMemo, useRef } from 'react'
import type { TableColumn, TableRow } from './TableFieldTypes'

export type { TableColumn, TableRow } from './TableFieldTypes'

// stabile Keys für Spalten/Zellen/Zeilen
const colKey = (c: any, i: number) => c?.id ?? c?.key ?? c?.name ?? c?.label ?? `col_${i}`
const rowKey = (r: any, i: number) => r?.__rowid ?? r?.id ?? r?.key ?? `row_${i}`

function toCSV(rows: TableRow[], columns: TableColumn[]): string {
  const header = columns.map(c => c.key)
  const esc = (v: any) => {
    if (v === null || v === undefined) return ''
    const s = String(v)
    if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"'
    return s
  }
  const lines = [header.join(',')]
  for (const r of rows) {
    const vals = columns.map(c => {
      const v = (r as any)[c.key]
      if (c.type === 'checkbox') return v ? 'true' : 'false'
      return v ?? ''
    })
    lines.push(vals.map(esc).join(','))
  }
  return lines.join('\n')
}

function parseCSV(text: string): string[][] {
  const rows: string[][] = []
  let i = 0, field = '', inQuotes = false, row: string[] = []
  while (i < text.length) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i+1] === '"') { field += '"'; i += 2; continue }
        inQuotes = false; i++; continue
      } else { field += ch; i++; continue }
    } else {
      if (ch === '"') { inQuotes = true; i++; continue }
      if (ch === ',') { row.push(field); field=''; i++; continue }
      if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i+1] === '\n') i++
        row.push(field); rows.push(row); field=''; row=[]; i++; continue
      }
      field += ch; i++; continue
    }
  }
  row.push(field); rows.push(row)
  return rows.filter(r => !(r.length===1 && r[0]===''))
}

function normalizeBool(s: string): boolean {
  const t = s.trim().toLowerCase()
  return t==='true' || t==='1' || t==='yes' || t==='ja' || t==='wahr' || t==='x'
}

function parseNumberSmart(s: string): number | null {
  const t = s.trim().replace(',', '.')
  if (t==='') return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

function validateCell(col: TableColumn, value: any): string | null {
  if ((col as any).required) {
    if (col.type === 'checkbox') {
      if (!value) return 'Pflicht: muss angehakt sein'
    } else if (value === null || value === undefined || String(value).trim() === '') {
      return 'Pflichtfeld'
    }
  }
  if (col.type === 'number') {
    if (value !== null && value !== undefined && String(value).trim() !== '') {
      const n = parseNumberSmart(String(value))
      if (n === null) return 'Ungültige Zahl'
      const min = (col as any).min
      const max = (col as any).max
      if (typeof min === 'number' && n < min) return `>= ${min}`
      if (typeof max === 'number' && n > max) return `<= ${max}`
    }
  }
  if (col.type === 'text' && (col as any).pattern) {
    try {
      const re = new RegExp((col as any).pattern as string)
      if (value && !re.test(String(value))) return 'Muster nicht erfüllt'
    } catch {}
  }
  const optList: any = (col as any).options
  if ((col.type === 'select' || (col as any).type === 'radio') && Array.isArray(optList) && value) {
    const values = optList.map((o: any) => typeof o === 'string' ? o : o?.value ?? String(o))
    if (!values.includes(String(value))) return 'Nicht in Optionen'
  }
  return null
}

function computeColPercents(columns: TableColumn[]): number[] {
  const manual: Array<number | null> = columns.map((c:any) =>
    typeof (c as any).widthPct === 'number' && (c as any).widthPct > 0
      ? Math.min(100, Math.max(0, (c as any).widthPct as number))
      : null
  )
  const sumManual = manual.reduce<number>((acc, v) => acc + (v ?? 0), 0)
  const autoCount = manual.filter(v => v === null).length
  const leftover = Math.max(0, 100 - sumManual)
  const autoWidth = autoCount > 0 ? leftover / autoCount : 0
  return manual.map(v => v ?? autoWidth)
}

export default function TableField({
  columns,
  value,
  onChange,
  nameForExport
}:{
  columns: TableColumn[]
  value: TableRow[]
  onChange: (rows: TableRow[]) => void
  nameForExport?: string
}){
  const rows = value || []
  const colKeyList = columns.map((c:any) => (c as any).key)
  const fileRefAppend = useRef<HTMLInputElement>(null)
  const fileRefReplace = useRef<HTMLInputElement>(null)

  function setCell(rIdx:number, key:string, v:any){
    const next = rows.map((r,i) => i===rIdx ? { ...(r as any), [key]: v } : r)
    onChange(next)
  }
  function addRow(){
    const newRow: TableRow = {} as any
    for (const k of colKeyList) (newRow as any)[k] = ''
    onChange([...(rows||[]), newRow])
  }
  function removeRow(idx:number){
    const next = rows.slice(); (next as any).splice(idx,1); onChange(next)
  }

  function exportCSV(){
    const csv = toCSV(rows, columns)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const fname = (nameForExport || 'tabelle') + '.csv'
    a.href = url; a.download = fname; document.body.appendChild(a); a.click(); a.remove()
    URL.revokeObjectURL(url)
  }

  function handleImport(file: File, mode: 'append'|'replace'){
    const fr = new FileReader()
    fr.onload = () => {
      const text = String(fr.result || '')
      const matrix = parseCSV(text)
      if (matrix.length === 0) return
      const header = matrix[0]
      const body = matrix.slice(1)
      const keyIdx: Record<string, number> = {}
      header.forEach((h, i) => keyIdx[h.trim()] = i)
      const mapped: TableRow[] = body.map(row => {
        const obj: TableRow = {} as any
        for (const c of columns as any[]) {
          const k = (c as any).key
          const idx = keyIdx[k]
          if (idx === undefined) { (obj as any)[k] = ''; continue }
          const raw = row[idx] ?? ''
          if ((c as any).type === 'checkbox') (obj as any)[k] = normalizeBool(String(raw))
          else if ((c as any).type === 'number') (obj as any)[k] = String(raw)
          else (obj as any)[k] = String(raw)
        }
        return obj
      })
      onChange(mode==='replace' ? mapped : [ ...(rows||[]), ...mapped ])
    }
    fr.readAsText(file, 'utf-8')
  }

  const errors = useMemo(() => {
    const errMap: Record<string, Record<number, string | null>> = {}
    for (let ci=0; ci<columns.length; ci++){
      const c: any = (columns as any)[ci]
      errMap[c.key] = {}
      for (let ri=0; ri<rows.length; ri++){
        const v = (rows[ri] as any)?.[c.key]
        errMap[c.key][ri] = validateCell(c, v)
      }
    }
    return errMap
  }, [columns, rows])

  const errorCount = useMemo(() => {
    let n = 0
    for (const c of columns as any) for (let ri=0; ri<rows.length; ri++){
      if ((errors as any)[(c as any).key]?.[ri]) n++
    }
    return n
  }, [errors, columns, rows])

  const percents = computeColPercents(columns)

  return (
    <div className="table-wrap">
      <table className="kirmas-table">
        <colgroup>
          {columns.map((c, i) => <col key={colKey(c, i)} style={{ width: percents[i] + '%' }} />)}
          <col style={{ width: 42 }} />
        </colgroup>
        <thead>
          <tr>
            {columns.map((c,i) => <th key={colKey(c,i)}>{(c as any).label}{(c as any).required && <span style={{color:'#b91c1c'}}> *</span>}</th>)}
            <th style={{width:1}}></th>
          </tr>
        </thead>
        <tbody>
          {(rows||[]).map((r, rIdx) => (
            <tr key={rowKey(r, rIdx)}>
              {columns.map((c, ci) => {
                const v = (r as any)[(c as any).key]
                const err = (errors as any)[(c as any).key]?.[rIdx] || null

                if ((c as any).type === 'checkbox'){
                  return (
                    <td key={colKey(c, ci)}>
                      <input type="checkbox" checked={!!v} onChange={e=>setCell(rIdx, (c as any).key, e.target.checked)} title={err || ''} />
                      {err && <div className="cell-err">{err}</div>}
                    </td>
                  )
                }
                if ((c as any).type === 'select' || (c as any).type === 'radio'){
                  const opts: any[] = (c as any).options || []
                  const values = opts.map((o:any) => typeof o === 'string' ? o : (o?.value ?? String(o)))
                  return (
                    <td key={colKey(c, ci)}>
                      <select className={'kirmas-input' + (err ? ' invalid' : '')} value={v ?? ''} onChange={e=>setCell(rIdx, (c as any).key, e.target.value)} title={err || ''}>
                        <option value=""></option>
                        {values.map((o) => <option key={String(o)} value={String(o)}>{String(o)}</option>)}
                      </select>
                      {err && <div className="cell-err">{err}</div>}
                    </td>
                  )
                }
                if ((c as any).type === 'number'){
                  return (
                    <td key={colKey(c, ci)}>
                      <input
                        type="number"
                        className={'kirmas-input' + (err ? ' invalid' : '')}
                        value={v ?? ''}
                        onChange={e=>setCell(rIdx, (c as any).key, e.target.value)}
                        title={err || ''}
                      />
                      {err && <div className="cell-err">{err}</div>}
                    </td>
                  )
                }
                return (
                  <td key={colKey(c, ci)}>
                    <input
                      type="text"
                      className={'kirmas-input' + (err ? ' invalid' : '')}
                      value={v ?? ''}
                      onChange={e=>setCell(rIdx, (c as any).key, e.target.value)}
                      title={err || ''}
                    />
                    {err && <div className="cell-err">{err}</div>}
                  </td>
                )
              })}
              <td>
                <button className="btn" onClick={()=>removeRow(rIdx)}>–</button>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={columns.length+1}>
              <div className="row" style={{ flexWrap:'wrap', gap:8, alignItems:'center' }}>
                <button className="btn" onClick={addRow}>+ Zeile</button>
                <span style={{ marginLeft:'auto' }}></span>
                <button className="btn" onClick={exportCSV}>Export CSV</button>
                <input ref={fileRefAppend} type="file" accept=".csv,text/csv" style={{ display:'none' }} onChange={e=>{ const f=e.target.files?.[0]; if(f) handleImport(f, 'append'); e.currentTarget.value='' }} />
                <button className="btn" onClick={()=>fileRefAppend.current?.click()}>Import CSV (Anhängen)</button>
                <input ref={fileRefReplace} type="file" accept=".csv,text/csv" style={{ display:'none' }} onChange={e=>{ const f=e.target.files?.[0]; if(f) handleImport(f, 'replace'); e.currentTarget.value='' }} />
                <button className="btn" onClick={()=>fileRefReplace.current?.click()}>Import CSV (Ersetzen)</button>
                {errorCount>0 && <span className="warn">Fehler: {errorCount}</span>}
              </div>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
