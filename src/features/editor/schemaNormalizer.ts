/** Schema-Normalisierung – bewahrt {value,label} bei Select/Radio-Optionen. */

export type SurveyField = {
  type: string;
  name?: string;
  label?: string;
  required?: boolean;
  multiple?: boolean;
  options?: Array<string | { value: string; label: string }>;
  colSpan?: number;
  [k: string]: any;
};
export type SurveyBlock = { title?: string; fields: SurveyField[] };
export type SurveySection = { title?: string; blocks: SurveyBlock[] };
export type SurveyPage = { title?: string; sections: SurveySection[] };
export type SurveySchema = { title?: string; pages: SurveyPage[] };

type AnyRec = Record<string, any>;

const toArr = (v: any): any[] => Array.isArray(v) ? v : (v ? [v] : []);

function slug(s?: string): string {
  if (!s) return '';
  return s.normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_-]+/g, '_')
    .toLowerCase();
}

function tinyId(len = 6) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random()*chars.length)];
  return out;
}

// Labels NICHT verwerfen -> konsistente Objektliste zurückgeben
function normalizeOptionsObjects(opts: any): Array<{value: string; label: string}> | undefined {
  if (!opts) return undefined;
  const arr = toArr(opts);
  const out: Array<{value: string; label: string}> = [];
  for (const o of arr) {
    if (o == null) continue;
    if (typeof o === 'string') {
      out.push({ value: o, label: o });
    } else if (typeof o === 'object') {
      const value = (o.value ?? o.label);
      const label = (o.label ?? o.value);
      if (value != null) out.push({ value: String(value), label: String(label ?? value) });
    } else {
      const s = String(o);
      out.push({ value: s, label: s });
    }
  }
  return out;
}

function normalizeField(f: AnyRec): SurveyField {
  const t0 = String(f?.type ?? 'text').toLowerCase();
  let type = t0;
  if (t0 === 'multiselect') { type = 'select'; f.multiple = true; }
  if (t0 === 'phone') type = 'tel';
  if (t0 === 'radiogroup') type = 'radio';
  if (t0 === 'dropdown') type = 'select';

  // Klammern wegen ?? und || Mischung
  const name = f?.name ?? (slug(f?.label) || `fld_${tinyId()}`);

  const base: SurveyField = {
    type,
    name,
    label: f?.label ?? name,
    required: Boolean(f?.required),
    multiple: Boolean(f?.multiple),
    colSpan: typeof f?.colSpan === 'number' ? Math.min(12, Math.max(1, f.colSpan)) : undefined
  };

  if (type === 'select' || type === 'radio') {
    base.options = normalizeOptionsObjects(f?.options) ?? [];
  }

  if (type === 'table') {
    const rawCols = toArr(f?.columns);
    const cols = rawCols.map((c: any, i: number) => {
      const cType = String(c?.type ?? 'text').toLowerCase();
      const key = c?.key ?? c?.name ?? (slug(c?.label) || `c_${i}`);
      const id = c?.id ?? `col_${i}_${tinyId()}`;
      const label = c?.label ?? key;
      const col: any = {
        id,
        key,
        label,
        type: cType,
        required: Boolean(c?.required)
      };
      if (cType === 'number') {
        if (typeof c?.min === 'number') col.min = c.min;
        if (typeof c?.max === 'number') col.max = c.max;
      }
      if (cType === 'select' || cType === 'radio') {
        col.options = normalizeOptionsObjects(c?.options) ?? [];
      }
      if (typeof c?.widthPct === 'number') col.widthPct = c.widthPct;
      return col;
    });
    (base as any).columns = cols;

    if (Array.isArray(f?.rows)) {
      (base as any).rows = (f.rows as any[]).map((r, i) => ({
        __rowid: r?.id ?? r?.key ?? `r_${i}_${tinyId()}`,
        ...r
      }));
    }
  }

  return { ...f, ...base };
}

function normalizeBlock(b: AnyRec): SurveyBlock {
  const fields = toArr(b?.fields).map(normalizeField);
  return { title: b?.title ?? 'Block', fields };
}

function normalizeSection(s: AnyRec): SurveySection {
  const blocks = toArr(s?.blocks).map(normalizeBlock);
  return { title: s?.title ?? 'Abschnitt', blocks };
}

function normalizePage(p: AnyRec): SurveyPage {
  return {
    title: p?.title ?? 'Seite',
    sections: toArr(p?.sections).map(normalizeSection),
  };
}

export function normalizeSurveySchema(input: AnyRec): SurveySchema {
  if (!input || typeof input !== 'object') return { title: 'Erhebung', pages: [] };
  const candidate = (input.survey ?? (Array.isArray(input.surveys) ? input.surveys[0] : input)) as AnyRec;
  const pages = toArr(candidate?.pages ?? candidate?.page).map(normalizePage);
  return { title: candidate?.title ?? 'Erhebung', pages };
}
