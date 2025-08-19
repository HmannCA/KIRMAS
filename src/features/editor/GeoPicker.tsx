import React, { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

type LatLng = { lat:number, lng:number } | null

export default function GeoPicker({
  value, onChange, height = 280
}:{
  value: LatLng,
  onChange: (v:LatLng)=>void,
  height?: number
}){
  const mapRef = useRef<L.Map|null>(null)
  const markerRef = useRef<L.Marker|null>(null)
  const containerRef = useRef<HTMLDivElement|null>(null)

  useEffect(()=>{
    if (mapRef.current || !containerRef.current) return
    const map = L.map(containerRef.current, {
      center: value ? [value.lat, value.lng] : [51.163, 10.447],
      zoom: value ? 12 : 6,
      zoomControl: true
    })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    }).addTo(map)

    map.on('click', (e: L.LeafletMouseEvent) => {
      setMarker(e.latlng.lat, e.latlng.lng, true)
    })

    mapRef.current = map

    if (value) setMarker(value.lat, value.lng, false)

    return ()=>{
      map.remove()
      mapRef.current = null
      markerRef.current = null
    }
  }, [])

  useEffect(()=>{
    if (!mapRef.current) return
    if (value) {
      setMarker(value.lat, value.lng, false)
    } else {
      if (markerRef.current) {
        markerRef.current.remove()
        markerRef.current = null
      }
    }
  }, [value?.lat, value?.lng])

  function setMarker(lat:number, lng:number, pan:boolean){
    if (!mapRef.current) return
    const ll = L.latLng(lat, lng)
    if (!markerRef.current) {
      const m = L.marker(ll, { draggable: true })
      m.on('dragend', ()=>{
        const p = m.getLatLng()
        onChange({ lat: p.lat, lng: p.lng })
      })
      m.addTo(mapRef.current)
      markerRef.current = m
    } else {
      markerRef.current.setLatLng(ll)
    }
    if (pan) mapRef.current.setView(ll, Math.max(mapRef.current.getZoom(), 12))
    onChange({ lat, lng })
  }

  return (
    <div>
      <div ref={containerRef} style={{ height, border:'1px solid #e5e7eb', borderRadius:8, overflow:'hidden' }} />
      <div className="row" style={{ gap:8, marginTop:8, alignItems:'center' }}>
        <div className="cell" style={{ maxWidth:160 }}>
          <div><small className="muted">Lat</small></div>
          <input className="kirmas-input" type="number" step="0.000001"
            value={value?.lat ?? ''}
            onChange={e=>{
              const v = e.target.value === '' ? null : Number(e.target.value)
              if (v===null || value===null) onChange(v===null?null:{lat:0,lng:0})
              else onChange({ lat: v, lng: value.lng })
            }}
          />
        </div>
        <div className="cell" style={{ maxWidth:160 }}>
          <div><small className="muted">Lng</small></div>
          <input className="kirmas-input" type="number" step="0.000001"
            value={value?.lng ?? ''}
            onChange={e=>{
              const v = e.target.value === '' ? null : Number(e.target.value)
              if (v===null || value===null) onChange(v===null?null:{lat:0,lng:0})
              else onChange({ lat: value.lat, lng: v })
            }}
          />
        </div>
        <button className="btn" onClick={()=>{
          if (!mapRef.current) return
          mapRef.current.locate({ setView:true, maxZoom:14 })
        }}>Mich lokalisieren</button>
      </div>
    </div>
  )
}
