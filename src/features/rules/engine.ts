export type Operator = 'equals'|'notEquals'|'contains'|'gt'|'lt'|'gte'|'lte'|'isEmpty'|'isNotEmpty'|'isChecked'|'isNotChecked';

export interface Condition {
  fieldName: string;
  operator: Operator;
  value?: string;
}

export interface VisibilityRule {
  mode: 'show'|'hide';
  logic: 'all'|'any';
  conditions: Condition[];
}

export function valueToString(v: any): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return String(v);
}

function asNumber(x: any): number | null {
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

export function evalCondition(cond: Condition, values: Record<string, any>): boolean {
  const v = values[cond.fieldName];
  const s = valueToString(v).trim();
  switch (cond.operator) {
    case 'equals': return s === valueToString(cond.value ?? '').trim();
    case 'notEquals': return s !== valueToString(cond.value ?? '').trim();
    case 'contains': return s.includes(valueToString(cond.value ?? ''));
    case 'isEmpty': return s === '';
    case 'isNotEmpty': return s !== '';
    case 'isChecked': return !!v === true;
    case 'isNotChecked': return !!v === false;
    case 'gt': {
      const a = asNumber(s), b = asNumber(cond.value);
      return a !== null && b !== null && a > b;
    }
    case 'lt': {
      const a = asNumber(s), b = asNumber(cond.value);
      return a !== null && b !== null && a < b;
    }
    case 'gte': {
      const a = asNumber(s), b = asNumber(cond.value);
      return a !== null && b !== null && a >= b;
    }
    case 'lte': {
      const a = asNumber(s), b = asNumber(cond.value);
      return a !== null && b !== null && a <= b;
    }
    default: return false;
  }
}

export function isVisible(rule: VisibilityRule | undefined, values: Record<string, any>): boolean {
  if (!rule || rule.conditions.length === 0) return true;
  const results = rule.conditions.map(c => evalCondition(c, values));
  const matched = rule.logic === 'all' ? results.every(Boolean) : results.some(Boolean);
  return rule.mode === 'show' ? matched : !matched;
}
