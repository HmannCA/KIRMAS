# KIRMAS – Architektur- & Datenkonzept (v1.0, 2025-08-15)

Dieses Dokument beschreibt eine robuste Basis für den **Katastrophenschutz-Editor** und das spätere **KIRMAS-Gesamtsystem**.
Ziele: (1) beliebig tiefe/variable Strukturen, (2) frei kombinierbare Auswertungen, (3) saubere Governance (IDs, Versionen, Audit).

---

## 1. Leitplanken & Anforderungen

- **Entitäten-Universum:** Krankenhäuser, Träger, Versorger, Verwaltungen, Polizeiorganisationen, Kitas/Schulen, Stationen, Verteiler, Sirenen, usw.
- **Hierarchien & Netzwerke:** Entitäten können hierarchisch (Träger → Einrichtung → Station …) **und** lateral (z. B. „operated_by“, „located_in“) verbunden sein.
- **Unbegrenzte Tiefe & Variabilität** der Unterstrukturen.
- **Erhebungen** definieren dynamische Felder (mit Typen, Regeln, Optionen) und werden versioniert veröffentlicht.
- **Antworten** müssen über Entitäten & Zeit auswertbar sein; Kombinationen sind **nicht vorab festlegbar**.
- **Behördenkontext:** Datenschutz, Revisionssicherheit, Mandantentrennung (Landkreise), RBAC, Audit-Logs, spätere On-Prem-DB (MS SQL Server).

**Design-Prinzipien:** Stabile IDs, „Graph + Closure“, typisiertes EAV für Antworten, versionierte Survey-Definitionen, Semantik-Tags, Publish‑Snapshots.

---

## 2. IDs & Identitäts-Strategie

**Empfehlung:** IDs als **UUID v7** (zeit-sortierbar). Speicherung in SQL Server zunächst pragmatisch als `UNIQUEIDENTIFIER` (string-GUID).
*Hinweis:* Später optional Umstieg auf `BINARY(16)` mit Funktion für v7-Binary‑Sort, ohne API‑Bruch.

**Primär-IDs (alle global eindeutig & stabil):**
- `Entity.id`, `EntityType.id`, `RelationType.id`, `Relation.id`
- `Survey.id` (kanonisch), `SurveyVersion.id` (veröffentlichte Version)
- `SurveyField.id` (stabil über *alle* Versionen der Survey), `SurveyOption.id` (stabil)
- `SurveyResponse.id`, `Answer.id`

**Short Codes (optional):** Menschlich lesbare Kürzel als Zweitkennung (z. B. „E-8K0Z2K“) – nie fachlich maßgeblich.

**Frontend/Backend:** IDs immer **bei Neuanlage** vergeben und **nie** bei Bearbeitung ersetzen.

---

## 3. Entitäten als Graph + Closure

**Tabellen (vereinfacht):**
- `Entity(id, type_id, tenant_id, name, geo_lat, geo_lng, meta_json, created_at, updated_at)`
- `EntityType(id, key, title, meta_json)`  → z. B. `utility.water`, `hospital`, `police.station`
- `Relation(id, src_id, relation_type_id, dst_id, valid_from, valid_to, note)`  (gerichtet)
- `RelationType(id, key, title)`
- **Closure:** `EntityClosure(ancestor_id, descendant_id, depth)` – materialisierte Transitive Hülle für schnelle Tiefensuchen.

**Vorteil:** Beliebige Tiefe/Netzwerke, Mehrfach-Zugehörigkeiten (fachlich/organisatorisch), performante Queries.

---

## 4. Erhebungen: Modell & Versionierung

**Kanonische Survey & Versionen:**
- `Survey(id, key, current_version, created_at)`
- `SurveyVersion(id, survey_id, version, title, status, published_at, snapshot_json)` → veröffentlichte, **immutable** Snapshot‑JSON für Revisionssicherheit.
- **Stabile Felder/Optionen über Versionen:**
  - `SurveyField(id, survey_id)` – stabil
  - `SurveyFieldVersion(id, field_id, survey_version_id, section, key, label, type, required, width, visibility_rule, semantic_tag, meta_json)`
  - `SurveyOption(id, field_id)` – stabil
  - `SurveyOptionVersion(id, option_id, field_version_id, value_code, label, sort_order, active)`

**Semantik-Tags:** Optionales Feld je `SurveyFieldVersion` (z. B. `contact.email`, `facility.beds.total`). Erlaubt survey‑übergreifende Auswertungen.

**Editor-Regeln (UI):**
- Feld‑IDs & Option‑IDs **beibehalten** (auch bei Umbennenungen).
- Select‑Optionen: `value_code` eindeutig (UI erzwingt Uniqueness), Label änderbar.
- Sichtbarkeitsregeln (`visibility_rule`) evaluierbar im Client (Editor) und Server (Validierung).

---

## 5. Antworten (EAV typisiert)

**Warum typisiert?** Bessere Indizes & SARGability als reines JSON.

- `SurveyResponse(id, survey_version_id, entity_id, period_from, period_to, submitted_by, submitted_at, status, meta_json)`
- Werte getrennt nach Typ:
  - `AnswerText(id, response_id, field_id, value_text)`
  - `AnswerNumber(id, response_id, field_id, value_num, unit)`
  - `AnswerDate(id, response_id, field_id, value_date)`
  - `AnswerSelect(id, response_id, field_id, option_id, value_code)`
  - `AnswerMultiSelect(id, response_id, field_id, option_id)` (mehrere Zeilen pro Antwort)

**Indexierung (Beispiele):**
- `IX_Answer*_Field` (`field_id, value_*`)
- `IX_Response_Entity` (`entity_id`), `IX_Response_SurveyVersion`
- Optional: Mapping‑View `FieldByTag(semantic_tag → field_id)` für cross‑survey‑Queries.

---

## 6. Dev‑Store (Dateibasiert) → Migration SQL Server

**Dev‑Store-Struktur (JSON, heute):**
```
devstore/
  surveys/
    <surveyId>/
      versions/
        <version>/definition.json            # Snapshot (immutable)
    drafts/
      <surveyId>.json                        # bearbeitbarer Stand (Editor)
  responses/
    <surveyVersionId>/
      <responseId>.json
  entities/
    <entityId>.json
  index/
    surveys.json  # Liste (id, title, version, updatedAt)
    entities.json # Liste (id, type, name)
```
**Repositories** kapseln IO. Umstieg auf SQL Server: gleiche API, andere Implementierung.

---

## 7. API (aus Frontend-Sicht, REST)

```
GET  /api/surveys             → Liste publizierter Surveys (id, title, version, updatedAt)
GET  /api/surveys/:id/versions/:ver → Snapshot JSON

POST /api/surveys/drafts      → Draft anlegen/aktualisieren (id stabil)
GET  /api/surveys/drafts/:id  → Draft lesen
POST /api/surveys/:id/publish → neue Version erzeugen

GET  /api/entities            → Liste/Filter
POST /api/entities            → neu
PUT  /api/entities/:id        → ändern

GET  /api/responses?entity_id=…&survey_version_id=…
POST /api/responses
PUT  /api/responses/:id
```

**AiPanel (Laden):** `GET /api/surveys` liefert `[{ id, title, version, updatedAt }]` → Klick „Laden“ ruft `onLoad({ id, title, version, schema })` im Frontend auf.

---

## 8. Frontend-Bausteine (heute vorhanden / erweitert)

- **KirmasEditor** – visuelles Authoring, DnD, Feld‑Eigenschaften, Leaflet‑Map, Save‑Toolbar.
- **AiPanel (Overlay rechts)** – Modellwahl (OpenAI/Google), Datei‑Upload (PDF/Word/Excel), Modi: *Neu/Anhängen/Intelligent integrieren*, Liste „Gespeicherte Erhebungen“ mit `onLoad({id,title,version,schema})`.
- **SelectOptionsEditor** – Label/Value, DnD, Header‑Sort, Import CSV/XLSX, **auto‑unique value**, Duplikat‑Warnung & Auto‑Fix, Insert‑Position.
- **ID‑Factory** – `newId()` (UUID v7), beim Erstellen von Sections/Fields/Options.
- **Schema‑Normalizer** – garantiert Feld‑/Option‑IDs, Breiten, Sichtbarkeitsregeln, Typkonsistenz (auch bei KI‑Import).

**UI‑Konventionen:**
- Keine Re‑Mounts bei Formular‑Edit (stabile Keys).
- Fehlerrobust: JSON‑Repair, Validation, sanfte Fehlermeldungen.
- Accessibility: Tastatur‑DnD, ARIA‑Labels auf Controls.

---

## 9. Sicherheit, Datenschutz, Audit

- **RBAC**: Rollen „Admin Kreis“, „Fachbereich“, „Betreiber“, „Prüfer“; Scopes via Entitäts‑Closure.
- **Mandantentrennung**: `tenant_id` in allen Kern‑Tabellen.
- **PII‑Flag** je Feld; Export/Ansicht/Retention politisch steuerbar.
- **Audit‑Trail**: `Audit(id, actor, ts, action, object_type, object_id, changes_json)` (inkl. Antwortänderungen).
- **Transport‑/At‑Rest‑Verschlüsselung**, API‑Keys, MFA/TOTP, Secret‑Rotation.
- **Logging/Monitoring**: strukturierte Logs, Rate‑Limits, DoS‑Schutz (helmet, limiter).

---

## 10. AI‑Integration

- **Modelle:** OpenAI (GPT‑5/GPT‑4.x), Google Gemini (2.5 Pro/Flash) – Runtime‑Schalter.
- **Prompts:** Steuerung, ob „Neu“, „Anhängen“ oder „Intelligent integrieren“. Splitting in Sub‑Erhebungen erlaubt.
- **Dokumenten‑Upload**: PDF/Docx/XLSX Parsing (pdf-parse, mammoth, xlsx) → Prompt‑Context.
- **JSON‑Garantie:** strikte „function calling“-ähnliche Vorgabe + JSON‑Repair; Validierung gegen Schema‑Zod vor Übernahme.

---

## 11. Migration: Schritte

1. Editor stabilisieren (IDs überall, Options‑Eindeutigkeit, AiPanel onLoad).
2. Dev-Store vervollständigen (Index, Draft/Publish‑Pfad).
3. SQL Server DDL deployen (dieses Paket, `sql/ddl_mssql_v1.sql`).
4. Repository‑Switch: Dev‑Store → SQL.
5. RBAC/Audit finalisieren.
6. BI‑Sichten & Reports (Materialized Views) + Semantik‑Tagging weiter ausbauen.

---

## 12. „Wie neue Chats anknüpfen?“ (Kurzbriefing für Upload)

- Projekt: **KIRMAS Katastrophenschutz‑Editor & Datenplattform**.
- IDs: **UUID v7**, stabil auf **Entity**, **Survey/Field/Option**, **Responses/Answers**.
- Datenmodell: **Graph + Closure**, **versionierte Surveys** (stabile Field/Option‑IDs), **typisiertes EAV** für Antworten.
- Frontend: **KirmasEditor**, **AiPanel (onLoad)**, **SelectOptionsEditor** (auto‑unique values).
- Dev‑Store: JSON, Repo‑abstraktion → später **MS SQL Server** (DDL liegt bei).
- Ziele: beliebige Tiefen/Beziehungen, frei kombinierbare Auswertungen, DSGVO, Audit, Mandantentrennung.
- Bitte **Variante B** für das Laden im AiPanel nutzen: `onLoad({ id, title, version, schema })`.
