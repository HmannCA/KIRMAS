import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import path from 'path';
import { attachDevstoreSurveyRoutes } from './routes/devstoreSurveys.js';

import rateLimit from 'express-rate-limit';
import multer from 'multer';
import { z } from 'zod';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { surveysRouter } from './surveys.js';
import { repairJsonToString, stripCodeFences } from './jsonRepair.js';

const isProd = process.env.NODE_ENV === 'production';
const PORT = Number(process.env.PORT || 8787);

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: ['http://localhost:5173'], methods: ['GET','POST','PUT','DELETE'], allowedHeaders: ['Content-Type'] }));
app.use(express.json({ limit: '10mb' }));
app.use(rateLimit({ windowMs: 60_000, max: 120 }));

app.get('/health', (_req, res) => res.json({ ok: true, uptime: process.uptime(), env: isProd ? 'prod' : 'dev' }));

// Mount routes (points to server/data/surveys/*.json by default)
attachDevstoreSurveyRoutes(app, {
  // rootDir: path.join(process.cwd(), 'server', 'data', 'surveys'), // default
  // routeBase: '/api/devstore/surveys', // default
});

// ---- Dev persistence for surveys ----
app.use('/api/surveys', surveysRouter);

// ---- AI ingest ----
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10*1024*1024, files: 5 } });
type UpFile = Express.Multer.File;

async function extractTextFromFile(file: UpFile): Promise<string> {
  const name = file.originalname.toLowerCase();
  const mime = file.mimetype;
  const buf = file.buffer;
  if (mime === 'application/pdf' || name.endsWith('.pdf')) {
    const pdfParse = (await import('pdf-parse')).default;
    const res = await pdfParse(buf);
    return res.text || '';
  }
  if (mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || name.endsWith('.docx')
   || mime === 'application/msword' || name.endsWith('.doc')) {
    const mammoth = await import('mammoth') as any;
    const result = await mammoth.extractRawText({ buffer: buf });
    return (result?.value as string) || '';
  }
  if (mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || name.endsWith('.xlsx')
   || mime === 'application/vnd.ms-excel' || name.endsWith('.xls')) {
    const XLSX = await import('xlsx');
    const wb = XLSX.read(buf, { type: 'buffer' });
    const out: string[] = [];
    for (const sheetName of wb.SheetNames) {
      const sh = wb.Sheets[sheetName];
      const csv = XLSX.utils.sheet_to_csv(sh);
      out.push(`# Sheet: ${sheetName}\n${csv}`);
    }
    return out.join('\n\n');
  }
  if (mime === 'text/csv' || name.endsWith('.csv')) return buf.toString('utf8');
  if (mime === 'text/plain' || name.endsWith('.txt')) return buf.toString('utf8');
  return `[[Unsupported file: ${name} (${mime})]]`
}

app.post('/api/ai/ingest', upload.array('files', 5), async (req, res) => {
  try {
    const files = (req.files || []) as UpFile[];
    if (!files.length) return res.status(400).json({ error: 'NO_FILES', hint: 'Mindestens eine Datei hochladen.' });
    const parts: string[] = [];
    for (const f of files) {
      const text = await extractTextFromFile(f).catch(() => `[[parse failed: ${f.originalname}]]`);
      parts.push(`--- Datei: ${f.originalname} ---\n${(text||'').trim()}`);
    }
    const combined = parts.join('\n\n').slice(0, 50_000);
    res.json({ ok: true, text: combined, meta: files.map(f => ({ name: f.originalname, bytes: f.size, mime: f.mimetype })) });
  } catch (err: any) {
    console.error('ingest error:', err);
    res.status(500).json({ error: 'INGEST_FAILED', message: err?.message || String(err) });
  }
});

// ---- AI synthesize ----
const synthesizeSchema = z.object({
  provider: z.enum(['openai','gemini']).default('openai'),
  model: z.string().default('gpt-4o'),
  prompt: z.string().min(1),
  docText: z.string().optional().default(''),
  allowSplit: z.boolean().optional().default(false)
});

function normalizeSchema(obj: any): any {
  if (Array.isArray(obj)) return obj.map(normalizeSchema);
  if (obj && typeof obj === 'object') {
    if (obj.type === 'multiselect') { obj.type = 'select'; obj.multiple = true; }
    if (obj.type === 'phone') obj.type = 'tel';
    Object.keys(obj).forEach(k => obj[k] = normalizeSchema(obj[k]));
  }
  return obj;
}
function makeMockSurvey(prompt: string) {
  return {
    title: 'Beispielerhebung (MOCK)',
    pages: [{ title: 'Allgemeines', sections: [{ title: 'Metadaten', blocks: [{
      title: 'Stammdaten',
      fields: [
        { type: 'text', name: 'anlage_name', label: 'Name der Anlage', required: true, colSpan: 12 },
        { type: 'select', name: 'anlage_typ', label: 'Anlagentyp', multiple: false, options: ['Wasserwerk','Pumpwerk','Hochbehälter'], colSpan: 12 },
        { type: 'tel', name: 'notfall_tel', label: 'Notfallnummer', colSpan: 6 },
        { type: 'email', name: 'kontakt_mail', label: 'E-Mail', colSpan: 6 }
      ]
    }]}]}],
    _note: `Mock generiert – kein KI-Provider konfiguriert. Prompt: ${prompt.slice(0,160)}…`
  };
}

async function callOpenAI(model: string, sys: string, user: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY missing');
  const openai = new OpenAI({ apiKey });
  // Versuche Responses API mit JSON-Format
  try {
    const resp: any = await openai.responses.create({
      model,
      input: [
        { role: 'system', content: sys + '\n\nDIE ANTWORT MUSS EIN JSON-OBJEKT SEIN.' },
        { role: 'user', content: user }
      ],
      response_format: { type: 'json_object' }
    } as any);
    const out = resp?.output_text || resp?.content?.map((c: any) => c?.text)?.join('\n');
    if (out) return out;
  } catch {}
  // Fallback: Chat Completions mit JSON-Format
  const chat: any = await (openai as any).chat.completions.create({
    model,
    messages: [
      { role: 'system', content: sys + '\n\nGib NUR JSON zurück.' },
      { role: 'user', content: user }
    ],
    response_format: { type: 'json_object' }
  });
  return chat.choices?.[0]?.message?.content ?? '';
}

async function callGemini(model: string, sys: string, user: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY missing');
  const genAI = new GoogleGenerativeAI(apiKey);
  const mdl = genAI.getGenerativeModel({ model, generationConfig: { responseMimeType: 'application/json' } as any });
  const result = await mdl.generateContent([{ text: sys }, { text: user }]);
  return result.response.text();
}

app.post('/api/ai/synthesize', async (req, res) => {
  try {
    const { provider, model, prompt, docText, allowSplit } = synthesizeSchema.parse(req.body);
    if (provider === 'openai' && !process.env.OPENAI_API_KEY) {
      return res.status(503).json({ error: 'OPENAI_NOT_CONFIGURED', hint: 'OPENAI_API_KEY fehlt', mock: makeMockSurvey(prompt) });
    }
    if (provider === 'gemini' && !process.env.GEMINI_API_KEY) {
      return res.status(503).json({ error: 'GEMINI_NOT_CONFIGURED', hint: 'GEMINI_API_KEY fehlt', mock: makeMockSurvey(prompt) });
    }

    const systemPrompt = `Du modellierst Erhebungen als **reines JSON-Schema** (Pages -> Sections -> Blocks -> Fields).
- Erlaube NUR JSON als Antwort, KEINEN Freitext.
- Feldtypen: text, textarea, number, date, datetime, time, checkbox, select (Mehrfach via "multiple": true), email, tel, geo, file, table.
- KEIN "multiselect", KEIN "phone".
- **Layout**: Nutze "colSpan" (1..12) für sinnvolle Anordnung in 12er-Grid.
  Muster:
  - Straße(9) + Hausnummer(3)
  - PLZ(4) + Ort(8)
  - Telefon(4) + Mobil(4) + E-Mail(4)
  - Zahlen nebeneinander (6/6)
- Verwende "name" in snake_case.`;

    const userPrompt = `Anforderung / Beschreibung:
${prompt}

Zusatzdokumente (gekürzt):
${(docText || '').slice(0, 4000)}

Wenn sinnvoll, kannst du mehrere Erhebungen als einzelne "pages" modellieren (allowSplit=${allowSplit}). Liefere EIN konsistentes JSON-Objekt.`;

    const raw = provider === 'openai'
      ? await callOpenAI(model, systemPrompt, userPrompt)
      : await callGemini(model, systemPrompt, userPrompt);

    const repaired = repairJsonToString(raw || '');
    if (!repaired) {
      return res.status(422).json({ error: 'INVALID_JSON_FROM_AI', preview: (raw || '').slice(0, 1200) });
    }
    let schema = JSON.parse(repaired);
    schema = normalizeSchema(schema);
    res.json({ ok: true, schema });
  } catch (err: any) {
    console.error('synthesize error:', err);
    res.status(500).json({ error: 'SYNTHESIS_FAILED', message: err?.message || String(err) });
  }
});


// Devstore static & routes
app.use('/devstore', express.static(path.join(process.cwd(), 'server', 'data')));

app.listen(PORT, () => {
  console.log(`[kirmas-ai-server] http://localhost:${PORT} (${isProd ? 'prod' : 'dev'})`);
});