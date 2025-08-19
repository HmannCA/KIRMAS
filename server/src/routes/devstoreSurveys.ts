// server/src/routes/devstoreSurveys.ts
import type { Application, Request, Response } from 'express';
import { Router } from 'express';
import path from 'path';
import { promises as fs } from 'fs';

type Options = {
  /** Absolute Pfad zu server/data/surveys – optional (Default wird ermittelt) */
  rootDir?: string;
  /** Basisroute – optional (Default: /api/devstore/surveys) */
  routeBase?: string;
  /** Bei jedem LIST-Aufruf index.json mitschreiben (Default: true) */
  writeIndex?: boolean;
};

type SavedItem = { id: string; title: string; version?: number; updatedAt?: string };

function isJsonString(s: string) {
  try { JSON.parse(s); return true; } catch { return false; }
}

async function readJsonSafe(filePath: string): Promise<any | null> {
  try {
    const text = await fs.readFile(filePath, 'utf8');
    if (!isJsonString(text)) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function listJsonFiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  return entries
    .filter(e => e.isFile() && e.name.toLowerCase().endsWith('.json'))
    .map(e => path.join(dir, e.name));
}

async function writeIndexFile(dir: string, items: SavedItem[]) {
  try {
    const indexPath = path.join(dir, 'index.json');
    await fs.writeFile(indexPath, JSON.stringify(items, null, 2), 'utf8');
  } catch {
    // non-fatal
  }
}

function extractTitle(obj: any): string | undefined {
  if (!obj || typeof obj !== 'object') return undefined;
  return obj.title || obj.name || obj.schema?.title || obj.definition?.title || obj.data?.title;
}

function extractVersion(obj: any): number | undefined {
  const v = obj?.version ?? obj?.schema?.version ?? obj?.definition?.version;
  if (typeof v === 'number') return v;
  const num = Number(v);
  return Number.isFinite(num) ? num : undefined;
}

export function attachDevstoreSurveyRoutes(app: Application, opts?: Options) {
  const rootDir = opts?.rootDir ?? path.join(process.cwd(), 'server', 'data', 'surveys');
  const base = opts?.routeBase ?? '/api/devstore/surveys';
  const writeIndex = opts?.writeIndex ?? true;

  const r = Router();

  // GET /api/devstore/surveys or /list → array
  const handleList = async (_req: Request, res: Response) => {
    try {
      await fs.mkdir(rootDir, { recursive: true });
      const files = await listJsonFiles(rootDir);
      const items: SavedItem[] = [];
      for (const file of files) {
        const id = path.basename(file).replace(/\.json$/i, '');
        const stat = await fs.stat(file);
        const json = await readJsonSafe(file);
        const title = extractTitle(json) || 'Ohne Titel';
        const version = extractVersion(json);
        items.push({
          id,
          title: String(title),
          version,
          updatedAt: stat.mtime.toISOString(),
        });
      }
      items.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
      if (writeIndex) await writeIndexFile(rootDir, items);
      res.json(items);
    } catch (e: any) {
      res.status(500).json({ error: 'LIST_FAILED', message: e?.message || String(e) });
    }
  };

  r.get('/', handleList);
  r.get('/list', handleList);

  // GET /api/devstore/surveys/:id → single JSON file as-is
  r.get('/:id', async (req: Request, res: Response) => {
    try {
      const id = String(req.params.id || '').trim();
      if (!id) return res.status(400).json({ error: 'MISSING_ID' });
      const file = path.join(rootDir, id + '.json');
      const data = await readJsonSafe(file);
      if (!data) return res.status(404).json({ error: 'NOT_FOUND' });
      res.json(data);
    } catch (e: any) {
      res.status(500).json({ error: 'GET_FAILED', message: e?.message || String(e) });
    }
  });

  app.use(base, r);
}
