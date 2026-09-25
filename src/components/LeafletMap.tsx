// src/components/LeafletMap.tsx

import { MapContainer, TileLayer, GeoJSON, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useState } from "react";
import * as toGeoJSON from "@tmcw/togeojson";
import * as L from "leaflet";
// 🔹 Auto zoom to geometry
function FitBounds({ geoData }: any) {
  const map = useMap();

  useEffect(() => {
    if (!geoData) return;

    const layer = L.geoJSON(geoData);
    map.fitBounds(layer.getBounds());
  }, [geoData]);

  return null;
}

export default function LeafletMap({ kmlUrl }: any) {
  const [geoData, setGeoData] = useState<any>(null);

  useEffect(() => {
    if (!kmlUrl) return;

    fetch(kmlUrl)
      .then((res) => res.text())
      .then((kmlText) => {
        const parser = new DOMParser();
        const kml = parser.parseFromString(kmlText, "text/xml");

        const geojson = toGeoJSON.kml(kml);
        setGeoData(geojson);
      })
      .catch((err) => console.error("KML load error:", err));
  }, [kmlUrl]);

  return (
    <MapContainer
      style={{ height: "600px", width: "100%" }}
      zoom={5}
      center={[20, 0]} // temporary fallback
    >
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

      {geoData && (
        <>
          <GeoJSON
            data={geoData}
            // ✅ FIX: use proper Leaflet style function
            style={() => ({
              color: "green",
              weight: 2,
              fillOpacity: 0.1
            })}
          />

          {/* ✅ Auto fit */}
          <FitBounds geoData={geoData} />
        </>
      )}
    </MapContainer>
  );
}