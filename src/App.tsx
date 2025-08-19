import React from 'react'
import KirmasEditor from './features/editor/KirmasEditor'
import './index.css'

export default function App(){
  return (
    <>
      <header>
        <h1 style={{margin:0, fontSize:20}}>KIRMAS – Erhebungs-Editor</h1>
        <div><small>Mehrseitige Erhebungen · Drag&Drop · Leaflet-Geopicker · Regel-Engine</small></div>
      </header>
      <div className="container">
        <KirmasEditor />
      </div>
    </>
  )
}
