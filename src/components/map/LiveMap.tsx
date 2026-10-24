// Browser-only Leaflet map. Load with React.lazy behind <ClientOnly>.
import { useEffect, useRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import L from "leaflet";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import { ArchetypeAvatar } from "@/components/ArchetypeAvatar";
import type { Bounds, LiveSession } from "@/lib/live";

export type Pin = { lat: number; lng: number; session: LiveSession };

const MILAN: [number, number] = [45.4642, 9.19];

function pinIcon(s: LiveSession, selected: boolean) {
  const html = renderToStaticMarkup(
    <div
      className={`rounded-full bg-card p-0.5 shadow-soft ring-2 ${selected ? "ring-primary scale-125" : s.is_mine ? "ring-secondary" : "ring-card"} transition-transform`}
      style={{ opacity: s.open_to_invitations ? 1 : 0.75 }}
    >
      <ArchetypeAvatar archetype={s.archetype} social={s.social ?? undefined} className="h-8 w-8" />
    </div>,
  );
  return L.divIcon({ html, className: "", iconSize: [36, 36], iconAnchor: [18, 18] });
}

function clusterIcon(c: L.MarkerCluster) {
  const n = c.getChildCount();
  const size = n < 10 ? 38 : n < 30 ? 46 : 54;
  return L.divIcon({
    html: `<div class="flex h-full w-full items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground ring-4 ring-primary/25 shadow-soft">${n}</div>`,
    className: "",
    iconSize: [size, size],
  });
}

function Clusters({ pins, selectedId, onSelect }: { pins: Pin[]; selectedId: string | null; onSelect: (id: string) => void }) {
  const map = useMap();
  const groupRef = useRef<L.MarkerClusterGroup | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      (window as unknown as { L: typeof L }).L = L;
      await import("leaflet.markercluster");
      if (cancelled) return;
      const g = L.markerClusterGroup({ iconCreateFunction: clusterIcon, showCoverageOnHover: false, maxClusterRadius: 50, spiderfyOnMaxZoom: true });
      groupRef.current = g;
      map.addLayer(g);
      map.fire("clusters-ready");
    })();
    return () => {
      cancelled = true;
      if (groupRef.current) map.removeLayer(groupRef.current);
      groupRef.current = null;
    };
  }, [map]);

  useEffect(() => {
    const draw = () => {
      const g = groupRef.current;
      if (!g) return;
      g.clearLayers();
      g.addLayers(
        pins.map((p) => {
          const m = L.marker([p.lat, p.lng], {
            icon: pinIcon(p.session, p.session.session_id === selectedId),
            title: p.session.first_name,
            keyboard: true,
          });
          m.on("click", () => onSelectRef.current(p.session.session_id));
          return m;
        }),
      );
    };
    draw();
    map.on("clusters-ready", draw);
    return () => {
      map.off("clusters-ready", draw);
    };
  }, [map, pins, selectedId]);

  return null;
}

function Watcher({ onMoved, flyTo }: { onMoved: (b: Bounds, center: { lat: number; lng: number }) => void; flyTo: { lat: number; lng: number; zoom: number } | null }) {
  const map = useMap();
  const cb = useRef(onMoved);
  cb.current = onMoved;
  useEffect(() => {
    const h = () => {
      const b = map.getBounds();
      const c = map.getCenter();
      cb.current({ south: b.getSouth(), west: b.getWest(), north: b.getNorth(), east: b.getEast() }, { lat: c.lat, lng: c.lng });
    };
    map.on("moveend", h);
    return () => {
      map.off("moveend", h);
    };
  }, [map]);
  useEffect(() => {
    if (flyTo) map.flyTo([flyTo.lat, flyTo.lng], flyTo.zoom, { duration: 0.8 });
  }, [map, flyTo]);
  return null;
}

export default function LiveMap(props: {
  pins: Pin[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onMoved: (b: Bounds, center: { lat: number; lng: number }) => void;
  flyTo: { lat: number; lng: number; zoom: number } | null;
}) {
  return (
    <MapContainer center={MILAN} zoom={12} minZoom={11} maxZoom={19} zoomSnap={0.5} wheelPxPerZoomLevel={90} className="h-full w-full" zoomControl>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
      />
      <Clusters pins={props.pins} selectedId={props.selectedId} onSelect={props.onSelect} />
      <Watcher onMoved={props.onMoved} flyTo={props.flyTo} />
    </MapContainer>
  );
}
