export function mergeSchemas(base:any, add:any){
  const out = structuredClone(base || {})
  if (!add?.pages?.length) return out
  if (!out.pages) out.pages = []

  const idxBy = (arr:any[], key:(x:any)=>string) => {
    const m = new Map<string, number>()
    arr.forEach((x,i)=> { const k = key(x); if (k) m.set(k, i) })
    return m
  }
  const keyTitle = (x:any)=> (x?.title||'').toLowerCase().trim()
  const keyName  = (x:any)=> (x?.name || x?.id || '').toLowerCase().trim()

  const pageIdx = idxBy(out.pages, keyTitle)
  for (const p of add.pages) {
    const k = keyTitle(p)
    if (k && pageIdx.has(k)) {
      const dst = out.pages[pageIdx.get(k)!]
      if (!dst.sections) dst.sections = []
      const secIdx = idxBy(dst.sections, keyTitle)
      for (const s of (p.sections||[])) {
        const ks = keyTitle(s)
        if (ks && secIdx.has(ks)) {
          const d = dst.sections[secIdx.get(ks)!]
          if (!d.blocks) d.blocks = []
          const blkIdx = idxBy(d.blocks, keyTitle)
          for (const b of (s.blocks||[])) {
            const kb = keyTitle(b)
            if (kb && blkIdx.has(kb)) {
              const db = d.blocks[blkIdx.get(kb)!]
              if (!db.fields) db.fields = []
              const names = new Set(db.fields.map((f:any)=> keyName(f)))
              for (const f of (b.fields||[])) {
                const n = keyName(f)
                if (!n || !names.has(n)) db.fields.push(f)
              }
            } else {
              d.blocks.push(b)
            }
          }
        } else {
          dst.sections.push(s)
        }
      }
    } else {
      out.pages.push(p)
    }
  }
  return out
}
