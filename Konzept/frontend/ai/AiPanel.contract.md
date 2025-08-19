# AiPanel Prop-Vertrag (Variante B – onLoad)

```ts
export type AiPanelProps = {
  open: boolean;
  onClose: () => void;

  getSchema: () => SurveySchema;

  onApply: (next: SurveySchema, mode: 'replace'|'append'|'integrate') => void;

  onLoad?: (payload: { id: string; title: string; version?: number; schema: SurveySchema }) => void;
};
```
Liste:
```jsonc
GET /api/surveys
[
  { "id": "…", "title": "Wasserversorger 2025", "version": 3, "updatedAt": "2025-08-12T10:20:00Z" }
]
```
Ladefluss: Klick „Laden“ → AiPanel holt Definition → `onLoad({ id, title, version, schema })` → Editor setzt `currentId`, Toolbar-Titel, State.
