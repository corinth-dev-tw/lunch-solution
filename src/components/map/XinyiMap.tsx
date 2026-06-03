'use client'

import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { XINYI_LOCATIONS, XINYI_CENTER } from '@/lib/constants/locations'
import { Location } from '@/types'

interface XinyiMapProps {
  selectedLocation: Location | null
  onSelectLocation: (location: Location) => void
}

export default function XinyiMap({ selectedLocation, onSelectLocation }: XinyiMapProps) {
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const markersRef = useRef<mapboxgl.Marker[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: XINYI_CENTER,
      zoom: 15.5,
      pitch: 55,
      bearing: -20,
      antialias: true,
    })

    mapRef.current = map

    map.on('load', () => {
      // 3D buildings layer
      const layers = map.getStyle().layers
      const labelLayerId = layers?.find(
        (l) => l.type === 'symbol' && (l.layout as { 'text-field'?: unknown })['text-field']
      )?.id

      map.addLayer(
        {
          id: '3d-buildings',
          source: 'composite',
          'source-layer': 'building',
          filter: ['==', 'extrude', 'true'],
          type: 'fill-extrusion',
          minzoom: 13,
          paint: {
            'fill-extrusion-color': [
              'interpolate',
              ['linear'],
              ['get', 'height'],
              0, '#e5e7eb',
              50, '#d1d5db',
              100, '#9ca3af',
              200, '#6b7280',
              400, '#4b5563',
            ],
            'fill-extrusion-height': ['get', 'height'],
            'fill-extrusion-base': ['get', 'min_height'],
            'fill-extrusion-opacity': 0.75,
          },
        },
        labelLayerId
      )

      // Add location markers
      XINYI_LOCATIONS.forEach((loc) => {
        const el = document.createElement('div')
        el.className = 'location-marker'
        el.innerHTML = `
          <div class="marker-pin ${selectedLocation?.id === loc.id ? 'selected' : ''}">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#f59e0b"/>
              <circle cx="12" cy="9" r="2.5" fill="white"/>
            </svg>
          </div>
          <div class="marker-label">${loc.name_zh}</div>
        `
        el.addEventListener('click', () => onSelectLocation(loc))

        const marker = new mapboxgl.Marker(el)
          .setLngLat(loc.coordinates)
          .addTo(map)

        markersRef.current.push(marker)
      })

      setLoaded(true)
    })

    // Smooth intro animation
    setTimeout(() => {
      map.easeTo({ pitch: 60, bearing: -15, zoom: 15.8, duration: 2000 })
    }, 800)

    return () => {
      markersRef.current.forEach((m) => m.remove())
      markersRef.current = []
      map.remove()
      mapRef.current = null
    }
  }, [])

  // Fly to selected location
  useEffect(() => {
    if (selectedLocation && mapRef.current) {
      mapRef.current.flyTo({
        center: selectedLocation.coordinates,
        zoom: 16.5,
        pitch: 65,
        bearing: -10,
        duration: 1200,
      })
    }
    // Update marker styles
    document.querySelectorAll('.marker-pin').forEach((el, i) => {
      const loc = XINYI_LOCATIONS[i]
      el.classList.toggle('selected', selectedLocation?.id === loc?.id)
    })
  }, [selectedLocation])

  return (
    <>
      <style>{`
        .location-marker { cursor: pointer; display: flex; flex-direction: column; align-items: center; }
        .marker-pin { transition: transform 0.2s; }
        .marker-pin:hover { transform: scale(1.2); }
        .marker-pin.selected { transform: scale(1.3); }
        .marker-pin.selected path { fill: #22c55e !important; }
        .marker-label {
          background: rgba(255,255,255,0.9);
          color: #374151;
          font-size: 11px;
          padding: 2px 6px;
          border-radius: 4px;
          white-space: nowrap;
          margin-top: 2px;
          font-family: system-ui, sans-serif;
          pointer-events: none;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
      `}</style>
      <div ref={containerRef} className="w-full h-full" />
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <div className="text-gray-500 text-lg animate-pulse">載入地圖中...</div>
        </div>
      )}
    </>
  )
}
