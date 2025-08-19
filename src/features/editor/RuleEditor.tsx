import React from 'react'
import type { VisibilityRule, Operator, Condition } from '../rules/engine'

const OPERATORS: { value: Operator, label: string, needsValue?: boolean }[] = [
  { value: 'equals', label: 'gleich', needsValue: true },
  { value: 'notEquals', label: 'ungleich', needsValue: true },
  { value: 'contains', label: 'enthält', needsValue: true },
  { value: 'isEmpty', label: 'ist leer', needsValue: false },
  { value: 'isNotEmpty', label: 'ist nicht leer', needsValue: false },
  { value: 'isChecked', label: 'ist angehakt', needsValue: false },
  { value: 'isNotChecked', label: 'ist nicht angehakt', needsValue: false },
  { value: 'gt', label: '>', needsValue: true },
  { value: 'lt', label: '<', needsValue: true },
  { value: 'gte', label: '≥', needsValue: true },
  { value: 'lte', label: '≤', needsValue: true },
]

export interface FieldRef { name: string; label: string }

export default function RuleEditor({
  value,
  onChange,
  fieldOptions,
  suggestForField
}: {
  value?: VisibilityRule,
  onChange: (v: VisibilityRule | undefined) => void,
  fieldOptions: FieldRef[],
  suggestForField?: (fieldName: string) => string[] | undefined
}){
  const rule = value ?? { mode:'show', logic:'all', conditions: [] }

  function set(partial: Partial<VisibilityRule>){
    onChange({ ...rule, ...partial })
  }
  function patchCond(idx: number, c: Partial<Condition>){
    const arr = rule.conditions.slice()
    arr[idx] = { ...arr[idx], ...c }
    set({ conditions: arr })
  }
  function addCond(){
    const first = fieldOptions[0]?.name ?? ''
    set({ conditions: [...rule.conditions, { fieldName:first, operator:'equals', value:'' }] })
  }
  function removeCond(idx: number){
    const arr = rule.conditions.slice()
    arr.splice(idx, 1)
    set({ conditions: arr })
  }
  function clearAll(){
    onChange(undefined)
  }

  return (
    <div>
      <div className="row" style={{ gap:8, marginBottom:8 }}>
        <select className="kirmas-input" value={rule.mode} onChange={e=>set({ mode: e.target.value as any })}>
          <option value="show">Anzeigen, wenn</option>
          <option value="hide">Ausblenden, wenn</option>
        </select>
        <select className="kirmas-input" value={rule.logic} onChange={e=>set({ logic: e.target.value as any })}>
          <option value="all">alle Bedingungen erfüllt sind</option>
          <option value="any">mindestens eine Bedingung erfüllt ist</option>
        </select>
      </div>

      {rule.conditions.length === 0 ? (
        <div style={{ color:'#6b7280', marginBottom:8 }}>Keine Bedingungen definiert.</div>
      ) : null}

      {rule.conditions.map((c, idx) => {
        const op = OPERATORS.find(o => o.value === c.operator)!
        const suggestions = c.fieldName ? (suggestForField?.(c.fieldName) ?? []) : []
        const listId = `rule-suggest-${idx}`
        return (
          <div key={idx} className="card" style={{ padding:'8px', margin:'8px 0' }}>
            <div className="row" style={{ gap:8 }}>
              <select className="kirmas-input" style={{ flex:1 }} value={c.fieldName} onChange={e=>patchCond(idx, { fieldName: e.target.value })}>
                {fieldOptions.map(opt => (
                  <option key={opt.name} value={opt.name}>{opt.label}</option>
                ))}
              </select>

              <select className="kirmas-input" style={{ width:160 }} value={c.operator} onChange={e=>patchCond(idx, { operator: e.target.value as Operator })}>
                {OPERATORS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>

              {op.needsValue !== false && (
                <input className="kirmas-input" style={{ flex:1 }} value={c.value ?? ''} list={listId} onChange={e=>patchCond(idx, { value: e.target.value })} />
              )}

              <button className="btn" onClick={()=>removeCond(idx)}>Entfernen</button>
            </div>
            {suggestions.length > 0 && op.needsValue !== false && (
              <datalist id={listId}>
                {suggestions.map(s => <option key={s} value={s} />)}
              </datalist>
            )}
          </div>
        )
      })}

      <div className="row" style={{ gap:8, marginTop:8 }}>
        <button className="btn" onClick={addCond}>+ Bedingung</button>
        <button className="btn" onClick={clearAll}>Regeln entfernen</button>
      </div>
    </div>
  )
}
