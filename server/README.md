# KIRMAS AI Server (OpenAI)

Ein leichter Node/Express-Server, der OpenAI's **Responses API** mit **Structured Outputs** aufruft,
um eine Erhebung (Survey) als JSON gemäß unserem Schema zu erzeugen.

## Setup

1) Ins Server-Verzeichnis wechseln und Abhängigkeiten installieren:
   ```bash
   cd server
   npm i
   ```

2) `.env` anlegen (siehe `.env.example`) und **OPENAI_API_KEY** eintragen:
   ```ini
   OPENAI_API_KEY=sk-....
   OPENAI_MODEL=gpt-4o-2024-08-06
   PORT=8787
   ```

3) Dev-Server starten:
   ```bash
   npm run dev
   ```

4) Frontend-Dev-Proxy (optional, empfohlen): In deinem `vite.config.ts` einen Proxy setzen,
   damit `/api` an `http://localhost:8787` geht. Beispiel:
   ```ts
   server: {
     proxy: { '/api': 'http://localhost:8787' }
   }
   ```

Danach nutzt der Editor das Endpoint **POST /api/ai/synthesize**.

## Endpunkt

**POST /api/ai/synthesize**
```json
{ "prompt": "string", "baseSchema": { ...optional aktuelles Schema... } }
```

Antwort: gültiges Survey-JSON (siehe Client).

## Hinweise
- Wir verwenden **Structured Outputs** (JSON Schema), damit die Antwort **immer** valides JSON ist.
- Zusätzlich wird die Antwort serverseitig mit **zod** validiert.
- Bei Bedarf kannst du Temperature erhöhen, oder das Systemprompt in `index.ts` anpassen.
