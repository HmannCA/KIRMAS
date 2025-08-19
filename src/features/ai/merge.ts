import { nanoid } from 'nanoid'

type AnyObj = Record<string, any>
type Survey = AnyObj

const newId = (p='id') => `${p}_${nanoid(6)}`

function indexByTitle<T extends { title?:string }>(list:T[]){
  const map = new Map<string, number>()
  list.forEach((it, i)=>{
    const key = (it.title||'').toLowerCase().trim()
    if(key) map.set(key, i)
  })
  return map
}

function clone(x:any){ return structuredClone(x) }

export function mergeSchemas(base:Survey, add:Survey):Survey{
  const out = clone(base)

  if(!add?.pages?.length) return out
  if(!out.pages) out.pages = []

  const pageIdx = indexByTitle(out.pages)
  for(const p of add.pages as AnyObj[]){
    const key = (p.title||'').toLowerCase().trim()
    if(key && pageIdx.has(key)){
      const dst = out.pages[pageIdx.get(key)!]
      mergePage(dst, p)
    }else{
      out.pages.push(withFreshIds(p, 'page'))
    }
  }
  return out
}

function mergePage(dst:any, src:any){
  if(src.title && !dst.title) dst.title = src.title
  if(!dst.sections) dst.sections = []
  const secIdx = indexByTitle(dst.sections)
  for(const s of (src.sections||[])){
    const key = (s.title||'').toLowerCase().trim()
    if(key && secIdx.has(key)){
      const d = dst.sections[secIdx.get(key)!]
      mergeSection(d, s)
    }else{
      dst.sections.push(withFreshIds(s, 'section'))
    }
  }
}

function mergeSection(dst:any, src:any){
  if(src.title && !dst.title) dst.title = src.title
  if(!dst.blocks) dst.blocks = []
  const blkIdx = indexByTitle(dst.blocks)
  for(const b of (src.blocks||[])){
    const key = (b.title||'').toLowerCase().trim()
    if(key && blkIdx.has(key)){
      const d = dst.blocks[blkIdx.get(key)!]
      mergeBlock(d, b)
    }else{
      dst.blocks.push(withFreshIds(b, 'block'))
    }
  }
}

function mergeBlock(dst:any, src:any){
  if(src.title && !dst.title) dst.title = src.title
  if(!dst.fields) dst.fields = []
  const nameSet = new Set(dst.fields.map((f:any)=> (f.name||f.id||'').toLowerCase()))
  for(const f of (src.fields||[])){
    const nm = (f.name||f.id||'').toLowerCase()
    if(nm && nameSet.has(nm)){
      // falls gleicher Name existiert, optional leichte Aktualisierung: label übernehmen, wenn fehlt
      const tgt = dst.fields.find((x:any)=> (x.name||x.id||'').toLowerCase()===nm)
      if (tgt && f.label && !tgt.label) tgt.label = f.label
    }else{
      dst.fields.push(withFreshIds(f, 'field'))
    }
  }
}

function withFreshIds(node:any, prefix:string){
  const n = structuredClone(node)
  // neue IDs, um Kollisionen zu vermeiden
  if(n) n.id = newId(prefix)
  if(n?.sections) n.sections = n.sections.map((s:any)=> withFreshIds(s, 'section'))
  if(n?.blocks) n.blocks = n.blocks.map((b:any)=> withFreshIds(b, 'block'))
  if(n?.fields) n.fields = n.fields.map((f:any)=> ({ ...f, id: newId('field'), colSpan: f.colSpan ?? 12 }))
  return n
}
