import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { Map as MapLibreMap, Marker, Popup } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';

// Configure MapLibre Web Worker for Vite
maplibregl.setWorkerUrl(maplibreWorkerUrl);
import {
  Maximize2,
  AlertTriangle,
  Key,
  Layers,
  MapPin,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react';
import type { PilotZone, IncidentRecord } from '../../data/dashboardData';
import { api } from '../../services/api';
import {
  buildCartoStyleUrl,
  calculatePilotBounds,
  prepareIncidentMarkers,
  prepareZoneMarkers,
} from '../../utils/geoUtils';

interface MapLibreRiskMapProps {
  zones: PilotZone[];
  incidents: IncidentRecord[];
  selectedZoneId: string;
  selectedIncidentId: string;
  onSelectZone: (zoneId: string) => void;
  onSelectIncident: (incidentId: string) => void;
  layerState?: {
    relativeRisk: boolean;
    recentIncidents: boolean;
    rainfallRadar: boolean;
    drainageAssets: boolean;
    criticalRoutes: boolean;
  };
  variant?: 'overview' | 'full';
  onOpenFullMap?: () => void;
  onSwitchToSvgFallback?: () => void;
}

export const MapLibreRiskMap: React.FC<MapLibreRiskMapProps> = ({
  zones,
  incidents,
  selectedZoneId,
  selectedIncidentId,
  onSelectZone,
  onSelectIncident,
  layerState,
  variant = 'full',
  onOpenFullMap: _onOpenFullMap,
  onSwitchToSvgFallback,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const popupsRef = useRef<Popup[]>([]);
  const featurePopupRef = useRef<Popup | null>(null);

  // State
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [activeLayerFilter, setActiveLayerFilter] = useState<'all' | 'high' | 'recurrence'>('all');
  const [geoStats, setGeoStats] = useState<{ total: number; official: number; curated: number }>({
    total: 8,
    official: 0,
    curated: 8,
  });

  const zonesRef = useRef(zones);
  const incidentsRef = useRef(incidents);
  useEffect(() => {
    zonesRef.current = zones;
    incidentsRef.current = incidents;
  }, [zones, incidents]);

  // Read CARTO key safely
  const cartoApiKey = (import.meta.env.VITE_CARTO_API_KEY as string | undefined)?.trim();
  const cartoConfig = buildCartoStyleUrl(cartoApiKey);

  // Clear existing markers & popups
  const clearMapOverlays = useCallback(() => {
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];
    popupsRef.current.forEach((popup) => popup.remove());
    popupsRef.current = [];
  }, []);

  const handleRetry = useCallback(() => {
    setMapError(null);
    setMapLoaded(false);
    setRetryCount((c) => c + 1);
  }, []);

  // Fit to pilot extent
  const handleFitPilotExtent = useCallback(
    (animate = true) => {
      if (!mapRef.current) return;
      const allCoords: [number, number][] = [
        ...zones.map((z) => z.coordinates),
        ...incidents.map((i) => i.coordinates),
      ];
      const bounds = calculatePilotBounds(allCoords);
      if (bounds) {
        mapRef.current.fitBounds(bounds, {
          padding: { top: 50, bottom: 50, left: 50, right: 50 },
          maxZoom: 14.5,
          duration: animate ? 800 : 0,
        });
      }
    },
    [zones, incidents]
  );

  // 1. Initialize MapLibre
  useEffect(() => {
    if (!containerRef.current || !cartoConfig.hasKey) return;

    // Destroy existing instance if any
    if (mapRef.current) {
      clearMapOverlays();
      mapRef.current.remove();
      mapRef.current = null;
    }

    try {
      const map = new maplibregl.Map({
        container: containerRef.current,
        style: cartoConfig.url,
        center: [73.015, 19.045], // Navi Mumbai (Nerul & Sanpada pilot center)
        zoom: 12.8,
        minZoom: 10,
        maxZoom: 18,
        attributionControl: false, // custom control added below with full attribution
        transformRequest: (url: string) => {
          if (cartoApiKey && url.includes('cartocdn.com')) {
            const hasKey = url.includes('key=') || url.includes('api_key=');
            if (!hasKey) {
              const sep = url.includes('?') ? '&' : '?';
              return {
                url: `${url}${sep}key=${encodeURIComponent(cartoApiKey)}`,
              };
            }
          }
          return { url };
        },
      });

      // Navigation Controls
      map.addControl(
        new maplibregl.NavigationControl({
          showCompass: true,
          showZoom: true,
          visualizePitch: false,
        }),
        'top-right'
      );

      // Attribution Control per CARTO & OSM guidelines
      map.addControl(
        new maplibregl.AttributionControl({
          compact: false,
          customAttribution: cartoConfig.attribution,
        }),
        'bottom-right'
      );

      map.on('load', () => {
        map.resize();
        if (map.isStyleLoaded()) {
          setMapLoaded(true);
          setMapError(null);
        }
        // Automatically frame the pilot area on initial load
        const allCoords: [number, number][] = [
          ...zonesRef.current.map((z) => z.coordinates),
          ...incidentsRef.current.map((i) => i.coordinates),
        ];
        const bounds = calculatePilotBounds(allCoords);
        if (bounds) {
          map.fitBounds(bounds, {
            padding: { top: 55, bottom: 55, left: 55, right: 55 },
            maxZoom: 14.2,
            duration: 0,
          });
        }
      });

      map.on('error', (e: { error?: { message?: string; status?: number } }) => {
        const errorMsg = e.error?.message || '';
        const status = e.error?.status;
        if (
          status === 401 ||
          status === 403 ||
          errorMsg.includes('401') ||
          errorMsg.includes('403') ||
          errorMsg.includes('Unauthorized') ||
          errorMsg.includes('Forbidden')
        ) {
          setMapError(
            'CARTO Positron authentication failed (HTTP 401/403). Please verify VITE_CARTO_API_KEY in .env.local.'
          );
        } else if (errorMsg.includes('Worker') || errorMsg.includes('worker')) {
          setMapError('MapLibre Web Worker failed to load. Check worker configuration.');
        } else if (errorMsg.includes('Failed to fetch') || errorMsg.includes('NetworkError')) {
          setMapError('Unable to load CARTO vector tiles. Check network connectivity.');
        }
      });

      mapRef.current = map;

      // Container ResizeObserver to prevent canvas skewing
      const resizeObserver = new ResizeObserver(() => {
        map.resize();
      });
      resizeObserver.observe(containerRef.current);

      return () => {
        resizeObserver.disconnect();
        clearMapOverlays();
        map.remove();
        mapRef.current = null;
        setMapLoaded(false);
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'WebGL initialization failed';
      setMapError(`MapLibre initialization error: ${msg}`);
    }
  }, [cartoConfig.hasKey, cartoConfig.url, cartoConfig.attribution, cartoApiKey, retryCount, clearMapOverlays]);

  // 2. Render Markers when map is loaded or records change
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    const map = mapRef.current;
    clearMapOverlays();

    // Prepare zones
    const showZones = layerState?.relativeRisk !== false;
    if (showZones) {
      const { mappedZones } = prepareZoneMarkers(zones);

      mappedZones.forEach(({ zone, lngLat }) => {
        if (activeLayerFilter === 'recurrence' && !zone.has_recurrence_flag) return;
        if (activeLayerFilter === 'high' && zone.risk_band !== 'high') return;

        const isSelected = zone.zone_id === selectedZoneId;

        // Custom DOM Marker for Zone
        const el = document.createElement('div');
        el.className = `group cursor-pointer flex flex-col items-center transition-transform hover:scale-105 ${
          isSelected ? 'z-40' : 'z-20'
        }`;

        const riskBorder =
          zone.risk_band === 'high'
            ? 'border-[#D94C55] text-red-900 bg-red-50'
            : zone.risk_band === 'moderate'
            ? 'border-[#D9952C] text-amber-900 bg-amber-50'
            : 'border-[#2879D8] text-blue-900 bg-blue-50';

        el.innerHTML = `
          <div class="px-2 py-0.5 rounded text-[10.5px] font-bold font-mono shadow-xs border flex items-center gap-1.5 ${riskBorder} ${
          isSelected ? 'ring-2 ring-[#1769C2]' : ''
        }">
            <span class="w-1.5 h-1.5 rounded-full ${
              zone.risk_band === 'high'
                ? 'bg-[#D94C55]'
                : zone.risk_band === 'moderate'
                ? 'bg-[#D9952C]'
                : 'bg-[#2879D8]'
            }"></span>
            <span>${zone.zone_id}</span>
            ${
              zone.has_recurrence_flag
                ? '<span class="text-[9px] font-bold text-red-700 bg-red-100 px-1 rounded">72h</span>'
                : ''
            }
          </div>
          <div class="w-px h-2 bg-[#10243B]/40"></div>
        `;

        el.addEventListener('click', (e) => {
          e.stopPropagation();
          onSelectZone(zone.zone_id);
        });

        // Zone Popup
        const popup = new maplibregl.Popup({ offset: 15, closeButton: false }).setHTML(`
          <div class="p-2 font-sans select-none text-[#10243B] max-w-xs">
            <div class="flex items-center justify-between gap-2 mb-1">
              <span class="font-mono text-[10.5px] font-bold text-[#1769C2]">${zone.zone_id}</span>
              <span class="text-[9.5px] font-bold px-1.5 py-0.2 rounded uppercase ${
                zone.risk_band === 'high'
                  ? 'bg-red-100 text-red-900'
                  : zone.risk_band === 'moderate'
                  ? 'bg-amber-100 text-amber-900'
                  : 'bg-blue-100 text-blue-900'
              }">${zone.risk_band} Risk</span>
            </div>
            <div class="text-[12px] font-bold leading-tight">${zone.name}</div>
            <div class="text-[10px] text-[#526984] mt-1">${zone.terrain_factor}</div>
            ${
              zone.has_recurrence_flag
                ? '<div class="mt-1 text-[10px] font-bold text-red-700">Recurring after recorded maintenance</div>'
                : ''
            }
          </div>
        `);

        el.addEventListener('mouseenter', () => {
          popup.setLngLat(lngLat).addTo(map);
        });
        el.addEventListener('mouseleave', () => {
          popup.remove();
        });

        const marker = new maplibregl.Marker({ element: el }).setLngLat(lngLat).addTo(map);
        markersRef.current.push(marker);
        popupsRef.current.push(popup);
      });
    }

    // Prepare incidents
    const showIncidents = layerState?.recentIncidents !== false;
    if (showIncidents) {
      const { mappedMarkers } = prepareIncidentMarkers(incidents);

      mappedMarkers.forEach(({ incident, lngLat, isApproximate }) => {
        if (activeLayerFilter === 'recurrence' && !incident.has_recurrence_flag) return;
        if (activeLayerFilter === 'high' && incident.visual_severity !== 'high') return;

        const isSelected = incident.incident_id === selectedIncidentId;

        const el = document.createElement('div');
        el.className = `cursor-pointer flex flex-col items-center transition-transform ${
          isSelected ? 'z-50 scale-110' : 'z-30 hover:scale-110'
        }`;

        const severityColor =
          incident.visual_severity === 'high'
            ? '#D94C55'
            : incident.visual_severity === 'moderate'
            ? '#D9952C'
            : incident.visual_severity === 'low'
            ? '#2879D8'
            : '#64748B';

        el.innerHTML = `
          <div class="relative flex items-center justify-center">
            <div class="w-6 h-6 rounded-full border-2 border-white shadow-xs flex items-center justify-center text-white ${
              isApproximate ? 'border-dashed border-amber-300' : ''
            } ${isSelected ? 'ring-2 ring-[#1769C2]' : ''}" style="background-color: ${severityColor};">
              <span class="text-[10px] font-bold font-mono leading-none">${incident.report_count}</span>
            </div>
            ${
              isApproximate
                ? '<div class="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-400 border border-white" title="Approximate Location (Missing GPS)"></div>'
                : ''
            }
          </div>
        `;

        el.addEventListener('click', (e) => {
          e.stopPropagation();
          onSelectIncident(incident.incident_id);
          onSelectZone(incident.zone_id);
        });

        // Incident Hover Popup
        const popup = new maplibregl.Popup({ offset: 16, closeButton: false }).setHTML(`
          <div class="p-2.5 font-sans select-none text-[#10243B] max-w-xs">
            <div class="flex items-center justify-between gap-2 mb-1">
              <span class="font-mono text-[10.5px] font-bold text-[#1769C2]">${incident.incident_id}</span>
              <span class="text-[9.5px] font-bold px-1.5 py-0.2 rounded uppercase ${
                incident.visual_severity === 'high'
                  ? 'bg-red-100 text-red-900'
                  : incident.visual_severity === 'moderate'
                  ? 'bg-amber-100 text-amber-900'
                  : 'bg-blue-100 text-blue-900'
              }">${incident.visual_severity}</span>
            </div>
            <div class="text-[12px] font-bold leading-tight">${incident.location_name}</div>
            <div class="text-[10px] text-[#526984] mt-0.5">${incident.category} &middot; ${incident.relative_time}</div>
            ${
              isApproximate
                ? '<div class="mt-1 text-[9.5px] text-amber-800 bg-amber-50 px-1 py-0.5 rounded border border-amber-200">Approximate Location: Landmark inferred from citizen text</div>'
                : '<div class="mt-1 text-[9.5px] text-emerald-800">Verified Citizen GPS Geotag</div>'
            }
            <div class="mt-1.5 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px]">
              <span class="font-semibold text-slate-700">Status: ${incident.review_state}</span>
              <span class="text-blue-600 font-bold">Click to inspect &rarr;</span>
            </div>
          </div>
        `);

        el.addEventListener('mouseenter', () => {
          popup.setLngLat(lngLat).addTo(map);
        });
        el.addEventListener('mouseleave', () => {
          popup.remove();
        });

        const marker = new maplibregl.Marker({ element: el }).setLngLat(lngLat).addTo(map);
        markersRef.current.push(marker);
        popupsRef.current.push(popup);
      });
    }
  }, [
    mapLoaded,
    zones,
    incidents,
    selectedZoneId,
    selectedIncidentId,
    layerState,
    activeLayerFilter,
    onSelectIncident,
    onSelectZone,
    clearMapOverlays,
  ]);

  // Center on selected incident or zone if changed
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    if (selectedIncidentId) {
      const target = incidents.find((i) => i.incident_id === selectedIncidentId);
      if (target && target.coordinates && target.coordinates[0] && target.coordinates[1]) {
        mapRef.current.easeTo({
          center: [target.coordinates[1], target.coordinates[0]],
          zoom: Math.max(mapRef.current.getZoom(), 14.2),
          duration: 700,
        });
      }
    } else if (selectedZoneId) {
      const target = zones.find((z) => z.zone_id === selectedZoneId);
      if (target && target.coordinates && target.coordinates[0] && target.coordinates[1]) {
        mapRef.current.easeTo({
          center: [target.coordinates[1], target.coordinates[0]],
          zoom: Math.max(mapRef.current.getZoom(), 13.5),
          duration: 700,
        });
      }
    }
  }, [selectedIncidentId, selectedZoneId, incidents, zones, mapLoaded]);

  // 3. Load & render geographic infrastructure layers (drainage, waterways, corridors, outfalls)
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    const map = mapRef.current;
    let isCancelled = false;

    const loadGeographicLayers = async () => {
      try {
        const geojson = await api.getGeographicFeaturesGeoJSON();
        if (isCancelled || !mapRef.current) return;

        // Calculate counts
        if (geojson && Array.isArray(geojson.features)) {
          const total = geojson.features.length;
          const official = geojson.features.filter((f: any) => f.properties?.data_origin === 'official').length;
          const curated = geojson.features.filter((f: any) => f.properties?.data_origin === 'curated').length;
          setGeoStats({ total, official, curated });
        }

        // Add or update source
        const existingSource = map.getSource('jaldrishti-features') as any;
        if (existingSource) {
          existingSource.setData(geojson);
        } else {
          map.addSource('jaldrishti-features', {
            type: 'geojson',
            data: geojson,
          });

          // 1. Official Drainage / Waterway Lines (Solid Bold Teal)
          map.addLayer({
            id: 'drainage-lines-official',
            type: 'line',
            source: 'jaldrishti-features',
            filter: [
              'all',
              ['in', ['get', 'category'], ['literal', ['drainage', 'waterway']]],
              ['in', '$type', ['literal', ['LineString', 'MultiLineString']]],
              ['in', ['get', 'data_origin'], ['literal', ['official', 'live-collected']]],
            ],
            paint: {
              'line-color': '#0D9488',
              'line-width': 3.5,
              'line-opacity': 0.9,
            },
          });

          // 2. Curated Baseline Drainage Lines (Dashed Teal)
          map.addLayer({
            id: 'drainage-lines-curated',
            type: 'line',
            source: 'jaldrishti-features',
            filter: [
              'all',
              ['in', ['get', 'category'], ['literal', ['drainage', 'waterway']]],
              ['in', '$type', ['literal', ['LineString', 'MultiLineString']]],
              ['==', ['get', 'data_origin'], 'curated'],
            ],
            paint: {
              'line-color': '#14B8A6',
              'line-width': 2.5,
              'line-dasharray': [3, 2],
              'line-opacity': 0.75,
            },
          });

          // 3. Transport Corridors (Highways & Railways)
          map.addLayer({
            id: 'corridor-lines',
            type: 'line',
            source: 'jaldrishti-features',
            filter: [
              'all',
              ['in', ['get', 'category'], ['literal', ['highway', 'railway']]],
              ['in', '$type', ['literal', ['LineString', 'MultiLineString']]],
            ],
            paint: {
              'line-color': [
                'match',
                ['get', 'category'],
                'railway',
                '#64748B',
                '#0284C7',
              ],
              'line-width': 2.5,
              'line-opacity': 0.7,
            },
          });

          // 4. Infrastructure Points (Outfalls, Sluices, Sump Pumps, Hospitals, Stations)
          map.addLayer({
            id: 'infrastructure-points',
            type: 'circle',
            source: 'jaldrishti-features',
            filter: ['==', '$type', 'Point'],
            paint: {
              'circle-radius': 6.5,
              'circle-color': [
                'match',
                ['get', 'category'],
                'drainage',
                '#0D9488',
                'amenity',
                '#E11D48',
                'railway',
                '#4F46E5',
                'waterway',
                '#0284C7',
                '#3B82F6',
              ],
              'circle-stroke-color': '#FFFFFF',
              'circle-stroke-width': [
                'match',
                ['get', 'data_origin'],
                'official',
                2.5,
                'live-collected',
                2.5,
                1.5,
              ],
            },
          });

          // Interactive Hover Popup for geographic features
          const featureLayers = [
            'drainage-lines-official',
            'drainage-lines-curated',
            'corridor-lines',
            'infrastructure-points',
          ];

          featureLayers.forEach((layerId) => {
            map.on('mouseenter', layerId, (e) => {
              map.getCanvas().style.cursor = 'pointer';
              if (!e.features || !e.features[0]) return;
              const feat = e.features[0];
              const props = feat.properties || {};
              const coords = e.lngLat;

              if (featurePopupRef.current) {
                featurePopupRef.current.remove();
              }

              const originBadge =
                props.data_origin === 'official'
                  ? '<span class="bg-emerald-100 text-emerald-800 text-[9px] font-bold px-1.5 py-0.2 rounded uppercase">Official Municipal Record</span>'
                  : props.data_origin === 'live-collected'
                  ? '<span class="bg-blue-100 text-blue-800 text-[9px] font-bold px-1.5 py-0.2 rounded uppercase">Live OpenStreetMap</span>'
                  : '<span class="bg-slate-100 text-slate-700 text-[9px] font-bold px-1.5 py-0.2 rounded uppercase">Curated Baseline Fixture</span>';

              const popupHtml = `
                <div class="p-2 font-sans select-none text-[#10243B] max-w-xs">
                  <div class="flex items-center justify-between gap-2 mb-1">
                    <span class="font-mono text-[9.5px] font-bold text-[#1769C2]">${props.osm_type || 'geo'}/${props.osm_id || ''}</span>
                    ${originBadge}
                  </div>
                  <div class="text-[11.5px] font-bold leading-tight">${props.name || props.feature_type || 'Feature'}</div>
                  <div class="text-[10px] text-[#526984] mt-0.5 capitalize">${props.category} &middot; ${props.feature_type}</div>
                  <div class="text-[9px] text-[#718BA3] mt-1 pt-1 border-t border-slate-100">${props.source_attribution || 'JalDrishti Geographic Baseline'}</div>
                </div>
              `;

              const popup = new maplibregl.Popup({ offset: 12, closeButton: false })
                .setLngLat(coords)
                .setHTML(popupHtml)
                .addTo(map);

              featurePopupRef.current = popup;
            });

            map.on('mouseleave', layerId, () => {
              map.getCanvas().style.cursor = '';
              if (featurePopupRef.current) {
                featurePopupRef.current.remove();
                featurePopupRef.current = null;
              }
            });
          });
        }

        // Apply layer visibility based on layerState
        const showDrainage = layerState?.drainageAssets !== false;
        const showCorridors = layerState?.criticalRoutes !== false;

        if (map.getLayer('drainage-lines-official')) {
          map.setLayoutProperty('drainage-lines-official', 'visibility', showDrainage ? 'visible' : 'none');
        }
        if (map.getLayer('drainage-lines-curated')) {
          map.setLayoutProperty('drainage-lines-curated', 'visibility', showDrainage ? 'visible' : 'none');
        }
        if (map.getLayer('infrastructure-points')) {
          map.setLayoutProperty('infrastructure-points', 'visibility', showDrainage ? 'visible' : 'none');
        }
        if (map.getLayer('corridor-lines')) {
          map.setLayoutProperty('corridor-lines', 'visibility', showCorridors ? 'visible' : 'none');
        }
      } catch (err) {
        console.warn('Failed to load geographic feature layers:', err);
      }
    };

    loadGeographicLayers();

    return () => {
      isCancelled = true;
      if (featurePopupRef.current) {
        featurePopupRef.current.remove();
        featurePopupRef.current = null;
      }
    };
  }, [mapLoaded, layerState?.drainageAssets, layerState?.criticalRoutes]);

  // Missing CARTO API Key Fallback Screen
  if (!cartoConfig.hasKey) {
    return (
      <div className="relative w-full h-[540px] bg-[#EEF4F8] rounded-xl border border-[#DCE6EF] overflow-hidden flex flex-col items-center justify-center p-6 text-center select-none shadow-xs">
        <div className="w-11 h-11 rounded-xl bg-amber-100 text-amber-900 flex items-center justify-center mb-3">
          <Key className="w-5 h-5 text-amber-800" />
        </div>

        <h3 className="font-serif text-[19px] font-normal text-[#10243B] mb-1.5">
          CARTO Positron Basemap Configuration Required
        </h3>

        <p className="text-[12.5px] text-[#526984] max-w-md mb-4 leading-relaxed">
          The vector GIS map requires a CARTO API key configured in <code className="font-mono text-[#10243B] bg-white px-1.5 py-0.5 rounded border border-[#CADDF0]">.env.local</code>.
        </p>

        <div className="bg-white px-4 py-2 rounded-md border border-[#CADDF0] font-mono text-[11.5px] text-[#10243B] select-all mb-4">
          VITE_CARTO_API_KEY=your_carto_key_here
        </div>

        <div className="flex items-center gap-2.5">
          {onSwitchToSvgFallback && (
            <button
              type="button"
              onClick={onSwitchToSvgFallback}
              className="px-3.5 py-1.5 bg-[#1769C2] hover:bg-[#1257A2] text-white rounded-lg text-[12px] font-semibold transition-colors flex items-center gap-1.5"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Use Illustrated Schematic Map</span>
            </button>
          )}

          <a
            href="https://carto.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-1.5 bg-white hover:bg-slate-50 border border-[#DCE6EF] text-[#10243B] rounded-lg text-[12px] font-medium transition-colors flex items-center gap-1.5"
          >
            <span>Get CARTO Key</span>
            <ExternalLink className="w-3.5 h-3.5 text-[#526984]" />
          </a>
        </div>

        <div className="mt-5 pt-3 border-t border-[#DCE6EF]/70 text-[11px] text-[#526984] max-w-sm">
          Live vector tiles remain offline until a key is supplied. The illustrated pilot schematic is available as a fallback.
        </div>
      </div>
    );
  }

  const containerHeight = variant === 'overview' ? 'h-[520px]' : 'h-[600px]';

  return (
    <div
      className={`relative w-full ${containerHeight} bg-[#EEF4F8] rounded-xl border border-[#DCE6EF] overflow-hidden select-none shadow-xs flex flex-col`}
    >
      {/* Top Map Action Bar */}
      <div className="absolute top-3 left-3 right-3 z-10 flex items-center justify-between pointer-events-none">
        {/* Map Context Badge */}
        <div className="pointer-events-auto bg-white/95 backdrop-blur-xs px-3 py-1.5 rounded-lg border border-[#DCE6EF] shadow-2xs flex items-center gap-2">
          <MapPin className="w-3.5 h-3.5 text-[#1769C2]" />
          <span className="text-[12px] font-semibold text-[#10243B]">
            {variant === 'overview'
              ? 'Nerul & Sanpada Catchment'
              : 'Vector GIS: Nerul & Sanpada'}
          </span>
          <span className="text-[10px] text-[#526984] font-mono">(CARTO Positron)</span>
        </div>

        {/* Map Tool Actions: Filters, Fit Extent, & Switch Map */}
        <div className="pointer-events-auto flex items-center gap-1.5">
          {/* Filter Pills (Full view only) */}
          {variant === 'full' && (
            <div className="bg-white/95 backdrop-blur-xs border border-[#DCE6EF] rounded-lg p-0.5 shadow-2xs flex items-center text-[11px] font-medium text-[#526984]">
              <button
                type="button"
                onClick={() => setActiveLayerFilter('all')}
                className={`px-2 py-1 rounded transition-colors ${
                  activeLayerFilter === 'all'
                    ? 'bg-[#1769C2] text-white font-semibold'
                    : 'hover:text-[#10243B]'
                }`}
              >
                All Pins
              </button>
              <button
                type="button"
                onClick={() => setActiveLayerFilter('high')}
                className={`px-2 py-1 rounded transition-colors ${
                  activeLayerFilter === 'high'
                    ? 'bg-[#D94C55] text-white font-semibold'
                    : 'hover:text-[#10243B]'
                }`}
              >
                High Risk
              </button>
              <button
                type="button"
                onClick={() => setActiveLayerFilter('recurrence')}
                className={`px-2 py-1 rounded transition-colors flex items-center gap-1 ${
                  activeLayerFilter === 'recurrence'
                    ? 'bg-red-700 text-white font-semibold'
                    : 'hover:text-[#10243B]'
                }`}
              >
                <ShieldAlert className="w-3 h-3" />
                <span>Recurring</span>
              </button>
            </div>
          )}

          {/* Fit Extent Button (Full view only) */}
          {variant === 'full' && (
            <button
              type="button"
              onClick={() => handleFitPilotExtent(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-white/95 backdrop-blur-xs border border-[#DCE6EF] rounded-lg text-[11.5px] font-medium text-[#10243B] hover:bg-white shadow-2xs transition-colors"
              title="Reset map view to frame all pilot zones and incidents"
            >
              <Maximize2 className="w-3.5 h-3.5 text-[#1769C2]" />
              <span className="hidden sm:inline">Fit Pilot</span>
            </button>
          )}
        </div>
      </div>

      {/* Error Banner if Tile Fetch Fails */}
      {mapError && (
        <div className="absolute top-14 left-3 right-3 z-10 bg-red-50 border border-red-200 text-red-900 px-3.5 py-2 rounded-lg text-[12px] flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{mapError}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleRetry}
              className="px-2 py-0.5 bg-red-100 hover:bg-red-200 text-red-800 rounded font-semibold text-[11px] transition-colors"
            >
              Retry Basemap
            </button>
            {onSwitchToSvgFallback && (
              <button
                type="button"
                onClick={onSwitchToSvgFallback}
                className="text-[11px] font-bold text-red-800 underline hover:text-red-950"
              >
                Switch to Schematic
              </button>
            )}
          </div>
        </div>
      )}

      {/* Map Canvas Container */}
      <div ref={containerRef} className="w-full flex-1 min-h-[300px]" />

      {/* Bottom Map Legend & Attribution Info */}
      <div className="absolute bottom-3 left-3 z-10 bg-white/95 backdrop-blur-xs border border-[#DCE6EF] rounded-lg px-3 py-1.5 shadow-2xs flex items-center gap-3 text-[11px] text-[#526984] flex-wrap max-w-[calc(100%-24px)]">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#D94C55]"></span>
          <span>High</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#D9952C]"></span>
          <span>Moderate</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#2879D8]"></span>
          <span>Low</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#64748B]"></span>
          <span>Unassessed</span>
        </div>
        <div className="hidden sm:block h-3 w-px bg-slate-200"></div>
        <div className="text-[10.5px] text-[#526984]">
          Pins indicate incident points &middot;{' '}
          <strong className="text-[#10243B] font-semibold">{geoStats.total} geographic features loaded</strong>{' '}
          ({geoStats.official > 0 ? `${geoStats.official} official municipal records, ` : ''}
          {geoStats.curated} curated baseline fixtures; live OSM collection unavailable) &middot; Not hydraulic flood boundaries
        </div>
      </div>
    </div>
  );
};
