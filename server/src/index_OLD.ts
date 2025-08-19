import 'dotenv/config'
import express, { type Request, type Response } from 'express'
import cors from 'cors'
import OpenAI from 'openai'
import { Survey as SurveyZ, surveyJsonSchema } from './schema.js'
import { mergeSchemas } from './merge.js'

const app = express()
app.use(cors())
app.use(express.json({ limit: '2mb' }))

const API_KEY = process.env.OPENAI_API_KEY
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-2024-08-06'
const PORT = Number(process.env.PORT || 8787)

if (!API_KEY) {
  console.warn('[AI] OPENAI_API_KEY fehlt – /api/ai/synthesize wird 500 liefern')
}
const client = new OpenAI({ apiKey: API_KEY })

app.get('/health', (req: Request, res: Response) => {
  res.json({ ok: true, model: MODEL, hasKey: !!API_KEY })
})

function postProcess(s: any) {
  for (const p of s.pages || [])
    for (const sec of p.sections || [])
      for (const b of sec.blocks || []){

        const ctrlNames = new Set(['notstrom_vorhanden','notfallplaene_vorhanden','krisenfall_betreuung'])
        const ctrl = (b.fields||[]).find((x:any)=> ctrlNames.has(String(x.name||'').toLowerCase()))

        for (const f of b.fields || []) {
          if (f.colSpan === undefined) f.colSpan = 12
          if (typeof f.colSpan === 'number') f.colSpan = Math.max(1, Math.min(12, f.colSpan))

          if (f.type === 'map') f.type = 'geo'

          if (f.type === 'select_multi' || f.type === 'multi-select') {
            f.type = 'select'; f.multiple = true
          }

          if (Array.isArray(f.options)) {
            f.options = f.options.map((o: any) => typeof o === 'string' ? ({ label: o, value: o }) : o)
          }
        }

        if (ctrl) {
          for (const f of b.fields || []) {
            if (f === ctrl) continue
            f.visibility = f.visibility || {}
            if (!f.visibility.all) f.visibility.all = []
            f.visibility.all.push({ field: ctrl.name, eq: 'ja' })
          }
        }
      }
  return s
}

function extractJsonOrText(resp: any): { json?: any; text?: string } {
  const outputs = resp.output ?? resp.outputs ?? []

  for (const out of outputs) {
    const content = out?.content ?? []
    for (const c of content) {
      if ((c?.type === 'json' && c.json !== undefined) || ('json' in c && c.json !== undefined)) {
        return { json: c.json }
      }
    }
  }

  if (typeof resp.output_text === 'string' && resp.output_text) {
    return { text: resp.output_text }
  }

  for (const out of outputs) {
    const content = out?.content ?? []
    for (const c of content) {
      if ((c?.type === 'output_text' && typeof c.text === 'string') || (typeof c?.text === 'string')) {
        return { text: c.text as string }
      }
    }
  }

  return {}
}

app.post('/api/ai/synthesize', async (req: Request, res: Response) => {
  try {
    const prompt = String(req.body?.prompt ?? '')
    const baseSchema = req.body?.baseSchema
    const mode = String(req.query?.mode || 'merge')

    if (!prompt.trim()) {
      return res.status(400).json({ error: 'prompt (string) required' })
    }
    if (!API_KEY) {
      return res.status(500).json({ error: 'Server missing OPENAI_API_KEY' })
    }

    const systemPrompt = [
      'Du bist ein Assistenzsystem, das JSON-Erhebungen für einen Formular-Editor erzeugt.',
      'Gib ausschließlich ein JSON-Objekt im geforderten Schema zurück.',
      'Nutze sinnvolle Titel für Seiten/Bereiche/Blöcke und sprechende Feldnamen (name).',
      'Verteile Felder mit colSpan 3/4/6/12 für gute Lesbarkeit.',
      'Tabellen-Felder nur wenn nötig.',
      baseSchema ? 'Erweitere das bestehende Schema (baseSchema) inhaltlich passgenau und vermeide Duplikate.' : ''
    ].join(' ')

    const input = [
      { role: 'system', content: [{ type: 'input_text', text: systemPrompt }] },
      { role: 'user',   content: [{ type: 'input_text', text: prompt }] }
    ] as const

    let response: any
    try {
      response = await client.responses.create({
        model: MODEL,
        input,
        text: {
          format: {
            type: 'json_schema',
            name: surveyJsonSchema.name,
            schema: surveyJsonSchema.schema,
            strict: surveyJsonSchema.strict
          }
        }
      } as any)
    } catch (err:any) {
      const msg = String(err?.message || '')
      const unsupported = /unsupported model|not found|not available|Unknown model/i.test(msg)
      if (unsupported && MODEL !== 'gpt-4o') {
        console.warn(`[AI] Modell ${MODEL} nicht verfügbar → Fallback auf gpt-4o`)
        response = await client.responses.create({
          model: 'gpt-4o',
          input,
          text: {
            format: {
              type: 'json_schema',
              name: surveyJsonSchema.name,
              schema: surveyJsonSchema.schema,
              strict: surveyJsonSchema.strict
            }
          }
        } as any)
      } else {
        throw err
      }
    }


    const { json, text } = extractJsonOrText(response)

    const material = (json !== undefined)
      ? json
      : (()=>{ try { return JSON.parse(text || '') } catch { return null } })()

    if (!material) return res.status(502).json({ error: 'Leere Modellantwort' })

    const processed = postProcess(material)
    const parsed = SurveyZ.parse(processed)

    if (mode === 'merge' && baseSchema) {
      const merged = mergeSchemas(baseSchema, parsed)
      return res.json(merged)
    }
    return res.json(parsed)
  } catch (err: any) {
    const status = err.status ?? err.statusCode ?? 500
    const detail =
      err?.response?.data ??
      err?.error ??
      err?.message ??
      'AI failed'
    console.error('[AI ERROR]', detail)
    return res.status(status).json({ error: detail })
  }
})

app.listen(PORT, () => {
  console.log(`KIRMAS AI server listening on http://localhost:${PORT}`)
})
