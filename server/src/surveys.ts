
import { Router } from 'express';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';

type SurveyRecord = {
  id: string;
  title: string;
  schema: any;
  createdAt: string;
  updatedAt: string;
};

const DATA_DIR = path.resolve(process.cwd(), 'data', 'surveys');

async function ensureDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

function fileOf(id: string) {
  return path.join(DATA_DIR, `${id}.json`);
}

async function readAllMeta(): Promise<Array<Pick<SurveyRecord, 'id'|'title'|'createdAt'|'updatedAt'>>> {
  await ensureDir();
  const files = await fs.readdir(DATA_DIR).catch(() => [] as string[]);
  const out: Array<Pick<SurveyRecord, 'id'|'title'|'createdAt'|'updatedAt'>> = [];
  for (const f of files) {
    if (!f.endsWith('.json')) continue;
    try {
      const raw = await fs.readFile(path.join(DATA_DIR, f), 'utf8');
      const rec = JSON.parse(raw) as SurveyRecord;
      out.push({ id: rec.id, title: rec.title, createdAt: rec.createdAt, updatedAt: rec.updatedAt });
    } catch { /* ignore broken file */ }
  }
  out.sort((a,b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  return out;
}

export const surveysRouter = Router();

surveysRouter.get('/', async (req, res) => {
  try {
    const q = (req.query.query as string | undefined)?.toLowerCase() ?? '';
    const list = await readAllMeta();
    const filtered = q ? list.filter(m => (m.title || '').toLowerCase().includes(q) || m.id.includes(q)) : list;
    res.json({ ok: true, items: filtered });
  } catch (err: any) {
    res.status(500).json({ error: 'LIST_FAILED', message: err?.message || String(err) });
  }
});

surveysRouter.get('/:id', async (req, res) => {
  try {
    await ensureDir();
    const p = fileOf(req.params.id);
    const raw = await fs.readFile(p, 'utf8');
    const rec = JSON.parse(raw) as SurveyRecord;
    res.json({ ok: true, record: rec });
  } catch (err: any) {
    if ((err as any)?.code === 'ENOENT') return res.status(404).json({ error: 'NOT_FOUND' });
    res.status(500).json({ error: 'READ_FAILED', message: err?.message || String(err) });
  }
});

surveysRouter.post('/', async (req, res) => {
  try {
    await ensureDir();
    const body = req.body || {};
    const id = crypto.randomUUID();
    const title = (body.title || body.schema?.title || 'Erhebung').toString();
    const now = new Date().toISOString();
    const rec: SurveyRecord = { id, title, schema: body.schema ?? {}, createdAt: now, updatedAt: now };
    await fs.writeFile(fileOf(id), JSON.stringify(rec, null, 2), 'utf8');
    res.status(201).json({ ok: true, id, record: rec });
  } catch (err: any) {
    res.status(500).json({ error: 'CREATE_FAILED', message: err?.message || String(err) });
  }
});

surveysRouter.put('/:id', async (req, res) => {
  try {
    await ensureDir();
    const p = fileOf(req.params.id);
    const rawOld = await fs.readFile(p, 'utf8').catch(() => null);
    if (!rawOld) return res.status(404).json({ error: 'NOT_FOUND' });
    const old = JSON.parse(rawOld) as SurveyRecord;
    const body = req.body || {};
    const updated: SurveyRecord = {
      id: old.id,
      title: (body.title ?? old.title) as string,
      schema: (body.schema ?? old.schema),
      createdAt: old.createdAt,
      updatedAt: new Date().toISOString()
    };
    await fs.writeFile(p, JSON.stringify(updated, null, 2), 'utf8');
    res.json({ ok: true, record: updated });
  } catch (err: any) {
    res.status(500).json({ error: 'UPDATE_FAILED', message: err?.message || String(err) });
  }
});

surveysRouter.delete('/:id', async (req, res) => {
  try {
    await ensureDir();
    await fs.unlink(fileOf(req.params.id));
    res.json({ ok: true });
  } catch (err: any) {
    if ((err as any)?.code === 'ENOENT') return res.status(404).json({ error: 'NOT_FOUND' });
    res.status(500).json({ error: 'DELETE_FAILED', message: err?.message || String(err) });
  }
});
