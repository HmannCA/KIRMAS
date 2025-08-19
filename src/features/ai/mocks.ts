// Sehr einfache "Schein-KI": erkennt einige Schlüsselwörter aus dem Prompt
// und gibt ein Survey-JSON zurück. Für echte KI: Backend anbinden (siehe README).
import { nanoid } from 'nanoid'

type Survey = any

const id = (p='id') => p + '_' + nanoid(6)

export async function synthesizeFromPrompt(prompt:string, base?:Survey):Promise<Survey>{
  const p = prompt.toLowerCase()

  if(p.includes('kindergarten') || p.includes('kita')){
    return kindergartenSurvey()
  }
  if((p.includes('wasserversorger') || p.includes('wasserwerk')) && base){
    // Ergänzt Seite 2 in vorhandener Erhebung
    return extendWaterworks()
  }
  // Fallback: Mini-Beispiel
  return {
    id: id('survey'),
    title: 'Neue Erhebung',
    pages: [
      {
        id: id('page'),
        title: 'Allgemein',
        sections: [{
          id: id('section'),
          title: 'Stammdaten',
          blocks: [{
            id: id('block'),
            title: 'Grunddaten',
            fields: [
              { id: id('field'), type:'text',  label:'Bezeichnung', name:'bezeichnung', colSpan:12 },
              { id: id('field'), type:'text',  label:'Ansprechpartner', name:'ansprechpartner', colSpan:6 },
              { id: id('field'), type:'email', label:'E-Mail', name:'email', colSpan:6 }
            ]
          }]
        }]
      }
    ]
  }
}

function kindergartenSurvey():Survey{
  return {
    id: id('survey'),
    title: 'Kitas im Landkreis – Stammdaten & Krisenfall',
    pages:[
      {
        id:id('page'), title:'Stammdaten (Träger)',
        sections:[{
          id:id('section'), title:'Trägerdaten',
          blocks:[{
            id:id('block'), title:'Basis',
            fields:[
              { id:id('field'), type:'text', label:'Trägername', name:'traeger_name', colSpan:8, required:true },
              { id:id('field'), type:'text', label:'Rechtsform', name:'traeger_rechtsform', colSpan:4 },
              { id:id('field'), type:'text', label:'Straße', name:'traeger_strasse', colSpan:8 },
              { id:id('field'), type:'number', label:'Haus-Nr.', name:'traeger_hausnr', colSpan:4 },
              { id:id('field'), type:'text', label:'PLZ', name:'traeger_plz', colSpan:3 },
              { id:id('field'), type:'text', label:'Ort', name:'traeger_ort', colSpan:9 },
              { id:id('field'), type:'text', label:'Telefon', name:'traeger_tel', colSpan:6 },
              { id:id('field'), type:'email', label:'E-Mail', name:'traeger_email', colSpan:6 }
            ]
          }]
        }]
      },
      {
        id:id('page'), title:'Kita (je Einrichtung)',
        sections:[{
          id:id('section'), title:'Stammdaten Kita',
          blocks:[{
            id:id('block'), title:'Adresse & Standort',
            fields:[
              { id:id('field'), type:'text', label:'Kita-Name', name:'kita_name', colSpan:8, required:true },
              { id:id('field'), type:'text', label:'Straße', name:'kita_strasse', colSpan:8 },
              { id:id('field'), type:'number', label:'Haus-Nr.', name:'kita_hausnr', colSpan:4 },
              { id:id('field'), type:'text', label:'PLZ', name:'kita_plz', colSpan:3 },
              { id:id('field'), type:'text', label:'Ort', name:'kita_ort', colSpan:9 },
              { id:id('field'), type:'geo',  label:'Geolokalisierung', name:'kita_geo', colSpan:12 }
            ]
          },
          {
            id:id('block'), title:'Kontakte & Zuständigkeiten',
            fields:[
              { id:id('field'), type:'text', label:'Leitung', name:'kita_leitung', colSpan:6 },
              { id:id('field'), type:'text', label:'Stellv. Leitung', name:'kita_leitung_stv', colSpan:6 },
              { id:id('field'), type:'text', label:'Notfallkontakt', name:'kita_notfallkontakt', colSpan:6 },
              { id:id('field'), type:'text', label:'Telefon Notfall', name:'kita_tel_notfall', colSpan:6 }
            ]
          }]
        }]
      },
      {
        id:id('page'), title:'Kapazitäten & Notstrom',
        sections:[{
          id:id('section'), title:'Betrieb im Krisenfall',
          blocks:[{
            id:id('block'), title:'Kapazitäten',
            fields:[
              { id:id('field'), type:'number', label:'Max. Kinderzahl', name:'kita_max_kinder', colSpan:6, min:0 },
              { id:id('field'), type:'checkbox', label:'Notstromaggregat vorhanden?', name:'kita_has_genset', colSpan:6 }
            ]
          },
          {
            id:id('block'), title:'Notstrom Details',
            fields:[
              { id:id('field'), type:'text', label:'Leistung (kVA)', name:'genset_kw', colSpan:4 },
              { id:id('field'), type:'text', label:'Tankvolumen (l)', name:'genset_tank', colSpan:4 },
              { id:id('field'), type:'text', label:'Laufzeit (h)', name:'genset_runtime', colSpan:4 }
            ]
          }]
        }]
      },
      {
        id:id('page'), title:'Heizung & Krisenpläne',
        sections:[{
          id:id('section'), title:'Heizung',
          blocks:[{
            id:id('block'), title:'Energie & Betrieb',
            fields:[
              { id:id('field'), type:'select', label:'Energieträger', name:'heiz_energietraeger', colSpan:6, options:['Gas','Öl','Fernwärme','Wärmepumpe','Strom','Sonstiges'] },
              { id:id('field'), type:'checkbox', label:'Betreuung im Krisenfall möglich?', name:'krise_betreuung_moeglich', colSpan:6 }
            ]
          },
          {
            id:id('block'), title:'Notfallpläne',
            fields:[
              { id:id('field'), type:'checkbox', label:'Eigene Notfallpläne vorhanden?', name:'has_notfallplaene', colSpan:6 },
              { id:id('field'), type:'textarea', label:'Kurzbeschreibung Notfallkonzept', name:'notfall_kurz', colSpan:12 }
            ]
          }]
        }]
      }
    ]
  }
}

function extendWaterworks():Survey{
  return {
    id: id('survey'),
    title: 'Wasserversorger – Ergänzung Seite 2',
    pages:[
      {
        id:id('page'), title:'Seite 2',
        sections:[{
          id:id('section'), title:'Wasserwerke (Krisenfall)',
          blocks:[{
            id:id('block'), title:'Lage & Erreichbarkeit',
            fields:[
              { id:id('field'), type:'geo', label:'Genauer Standort', name:'wasserwerk_geo', colSpan:12 },
              { id:id('field'), type:'textarea', label:'Zufahrt/Besonderheiten', name:'wasserwerk_zufahrt', colSpan:12 }
            ]
          },
          {
            id:id('block'), title:'Notfallpläne & Kommunikation',
            fields:[
              { id:id('field'), type:'checkbox', label:'Notfallpläne vorhanden?', name:'ww_has_plans', colSpan:6 },
              { id:id('field'), type:'textarea', label:'Pläne zur Bevölkerungsinformation', name:'ww_info_plaene', colSpan:12 }
            ]
          },
          {
            id:id('block'), title:'Notstrom',
            fields:[
              { id:id('field'), type:'checkbox', label:'Notstrom vorhanden?', name:'ww_has_genset', colSpan:6 },
              { id:id('field'), type:'text', label:'Leistung (kVA)', name:'ww_genset_kw', colSpan:3 },
              { id:id('field'), type:'text', label:'Tankvolumen (l)', name:'ww_genset_tank', colSpan:3 },
              { id:id('field'), type:'text', label:'Laufzeit (h)', name:'ww_genset_runtime', colSpan:3 }
            ]
          },
          {
            id:id('block'), title:'Szenarien',
            fields:[
              { id:id('field'), type:'checkbox', label:'Vorbereitung Cyberangriff', name:'sz_cyber', colSpan:4 },
              { id:id('field'), type:'checkbox', label:'Vorbereitung Stromausfall', name:'sz_blackout', colSpan:4 },
              { id:id('field'), type:'checkbox', label:'Vorbereitung Biokontamination', name:'sz_bio', colSpan:4 },
              { id:id('field'), type:'checkbox', label:'Vorbereitung chemische Kontamination', name:'sz_chem', colSpan:12 },
              { id:id('field'), type:'textarea', label:'Versorgungspläne bei Ausfall der Leitungen', name:'sz_leitungsausfall', colSpan:12 }
            ]
          }]
        }]
      }
    ]
  }
}
