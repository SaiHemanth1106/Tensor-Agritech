import { useCallback, useEffect, useState } from "react";
import type { GeoJsonObject, FeatureCollection, Feature } from "geojson";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import MapIcon from "@mui/icons-material/Map";
import { GeoJSON, MapContainer, TileLayer, useMap } from "react-leaflet";
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import { getRegions, saveRegionMappings } from "../../services/api";

type Region = Record<string, unknown>;
type MappedValue = "yes" | "no";

type RegionFieldRow = {
  id: string;
  regionName: string;
  fieldId: string;
  farmerName: string;
  area: string;
  isMonitoring: string;
  mapped: MappedValue;
  feature: Record<string, unknown> | null;
};

const sampleGeometry = (longitude: number, latitude: number): GeoJsonObject => ({
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { field_id: "FLD-01", farmer_name: "Ravi Kumar", area: "12.0 ha", is_monitoring: true, mapped: "yes" },
      geometry: { type: "Polygon", coordinates: [[[longitude, latitude], [longitude + 0.012, latitude], [longitude + 0.012, latitude + 0.01], [longitude, latitude + 0.01], [longitude, latitude]]] }
    },
    {
      type: "Feature",
      properties: { field_id: "FLD-02", farmer_name: "Sita Patel", area: "12.5 ha", is_monitoring: false, mapped: "yes" },
      geometry: { type: "Polygon", coordinates: [[[longitude + 0.014, latitude], [longitude + 0.026, latitude], [longitude + 0.026, latitude + 0.01], [longitude + 0.014, latitude + 0.01], [longitude + 0.014, latitude]]] }
    }
  ]
} as FeatureCollection as GeoJsonObject);

const sampleRegions: Region[] = [
  { organization_id: "ORG-001", region_id: "REG-001", name: "North Field", region_area: 24.5, is_monitoring: true, geometry: sampleGeometry(73.84, 18.51) },
  { organization_id: "ORG-001", region_id: "REG-002", name: "River Plot", region_area: 18.2, is_monitoring: false, geometry: sampleGeometry(73.88, 18.55) },
  { organization_id: "ORG-002", region_id: "REG-003", name: "East Farm", region_area: 31.8, is_monitoring: true, geometry: sampleGeometry(73.8, 18.48) }
];

const getRegionList = (response: unknown): Region[] => {
  if (Array.isArray(response)) return response as Region[];
  if (response && typeof response === "object") {
    const record = response as Record<string, unknown>;
    if (Array.isArray(record.regions)) return record.regions as Region[];
    if (Array.isArray(record.data)) return record.data as Region[];
  }
  return [];
};

const valueFor = (region: Region, ...keys: string[]) => {
  for (const key of keys) {
    const value = region[key];
    if (value !== undefined && value !== null && value !== "") return String(value);
  }
  return "-";
};

const formatValue = (value: unknown) => {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
};

const monitoringValue = (region: Region) => {
  const value = region.is_monitoring ?? region.monitoring_enabled;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (value && typeof value === "object" && "enabled" in value) return value.enabled ? "Yes" : "No";
  return value === undefined || value === null ? "-" : String(value);
};

const regionGeometry = (region: Region): GeoJsonObject | null => {
  const geometry = region.geometry ?? region.geojson ?? region.geo_json;
  if (typeof geometry === "string") {
    try { return JSON.parse(geometry) as GeoJsonObject; }
    catch { return null; }
  }
  if (geometry && typeof geometry === "object" && "type" in geometry) return geometry as GeoJsonObject;
  return null;
};

const normalizeMapped = (value: unknown): MappedValue => {
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "no") return "no";
    return "yes";
  }
  return "yes";
};

const buildFieldRows = (region: Region): RegionFieldRow[] => {
  const regionName = valueFor(region, "name", "region_name");
  const geometry = regionGeometry(region);
  const featureCollection: Feature[] = geometry && geometry.type === "FeatureCollection"
    ? (geometry as FeatureCollection).features
    : [];

  if (!featureCollection.length) {
    const rowArea = valueFor(region, "region_area", "area");
    return [{
      id: `${regionName}-default`,
      regionName,
      fieldId: "-",
      farmerName: "-",
      area: rowArea,
      isMonitoring: monitoringValue(region),
      mapped: "yes",
      feature: null
    }];
  }

  return featureCollection.map((feature, index) => {
    const properties = (feature && typeof feature === "object" && "properties" in feature ? feature.properties : {}) as Record<string, unknown>;
    const fieldId = String(properties.field_id ?? properties.fieldId ?? properties.fieldid ?? properties.field_name ?? properties.id ?? `Field-${index + 1}`);
    const farmerName = String(properties.farmer_name ?? properties.farmerName ?? properties.owner_name ?? properties.owner ?? properties.name ?? `Farmer ${index + 1}`);
    const area = String(properties.area ?? properties.field_area ?? properties.fieldArea ?? properties.size ?? valueFor(region, "region_area", "area"));
    const isMonitoring = monitoringValue({
      ...region,
      is_monitoring: properties.is_monitoring ?? properties.monitoring ?? region.is_monitoring ?? region.monitoring_enabled
    });

    return {
      id: `${regionName}-${fieldId}`,
      regionName,
      fieldId,
      farmerName,
      area,
      isMonitoring,
      mapped: normalizeMapped(properties.mapped ?? properties.is_mapped ?? "yes"),
      feature: properties
    };
  });
};

function FitMapToRegion({ geometry }: { geometry: GeoJsonObject }) {
  const map = useMap();

  useEffect(() => {
    const bounds = L.geoJSON(geometry).getBounds();
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [24, 24] });
  }, [geometry, map]);

  return null;
}

export default function RegionManagement() {
  const [regions, setRegions] = useState<Region[]>([]);
  const [selectedRegionName, setSelectedRegionName] = useState("");
  const [fieldRows, setFieldRows] = useState<RegionFieldRow[]>([]);
  const [mapRegion, setMapRegion] = useState<Region | null>(null);
  const [selectedField, setSelectedField] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [saveError, setSaveError] = useState("");

  const loadRegions = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const nextRegions = getRegionList(await getRegions());
      setRegions(nextRegions);
      if (nextRegions.length > 0) {
        const firstRegionName = valueFor(nextRegions[0], "name", "region_name");
        setSelectedRegionName((current) => current && nextRegions.some((region) => valueFor(region, "name", "region_name") === current)
          ? current
          : firstRegionName);
      } else {
        setSelectedRegionName("");
      }
    } catch (loadError: unknown) {
      const message = loadError instanceof Error
        ? loadError.message
        : typeof loadError === "object" && loadError && "message" in loadError
          ? String(loadError.message)
          : "Failed to load regions.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRegions();
  }, [loadRegions]);

  const showingSampleRegions = !loading && !error && regions.length === 0;
  const displayedRegions = showingSampleRegions ? sampleRegions : regions;
  const selectedRegion = displayedRegions.find((region) => valueFor(region, "name", "region_name") === selectedRegionName) ?? displayedRegions[0] ?? null;

  useEffect(() => {
    if (!selectedRegion) {
      setFieldRows([]);
      return;
    }
    setFieldRows(buildFieldRows(selectedRegion));
  }, [selectedRegion]);

  const updateMappedValue = (rowId: string, mapped: MappedValue) => {
    setFieldRows((currentRows) => currentRows.map((row) => row.id === rowId ? { ...row, mapped } : row));
    setSaveMessage("");
    setSaveError("");
  };

  const getSelectedRegionId = () => {
    if (!selectedRegion) return undefined;
    const regionId = selectedRegion.id ?? selectedRegion.region_id ?? selectedRegion.regionId ?? selectedRegion.regionID;
    if (typeof regionId === "number" || typeof regionId === "string") return String(regionId);
    return undefined;
  };

  const handleSave = async () => {
    if (!selectedRegion) {
      setSaveError("Please select a region before saving.");
      return;
    }

    const regionId = getSelectedRegionId();
    if (!regionId) {
      setSaveError("The selected region does not have a valid ID for saving.");
      return;
    }

    const payload = {
      region_id: regionId,
      region_name: selectedRegionName || valueFor(selectedRegion, "name", "region_name"),
      mappings: fieldRows.map((row) => ({
        field_id: row.feature && typeof row.feature === "object" && "field_id" in row.feature ? row.feature.field_id ?? row.feature.fieldId ?? row.fieldId : row.fieldId,
        farmer_name: row.farmerName === "-" ? null : row.farmerName,
        area: row.area === "-" ? null : row.area,
        is_monitoring: row.isMonitoring === "Yes",
        mapped: row.mapped === "yes"
      }))
    };

    try {
      setSaving(true);
      setSaveError("");
      setSaveMessage("");
      await saveRegionMappings(regionId, payload);
      setSaveMessage("Changes saved successfully.");
    } catch (saveError: unknown) {
      const message = saveError instanceof Error
        ? saveError.message
        : typeof saveError === "object" && saveError && "message" in saveError
          ? String(saveError.message)
          : "Failed to save mappings.";
      setSaveError(message);
    } finally {
      setSaving(false);
    }
  };

  const mapGeometry = mapRegion ? regionGeometry(mapRegion) : null;

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3} gap={2}>
        <Box>
          <Typography variant="h5" fontWeight="bold">Region Management</Typography>
          <Typography variant="body2" color="text.secondary">Review the active region and its mapped fields.</Typography>
        </Box>
        <Box display="flex" alignItems="center" gap={2}>
          {displayedRegions.length > 0 && (
            <FormControl size="small" sx={{ minWidth: 220 }}>
              <InputLabel id="region-select-label">Region</InputLabel>
              <Select
                labelId="region-select-label"
                label="Region"
                value={selectedRegionName || ""}
                onChange={(event) => setSelectedRegionName(event.target.value)}
              >
                {displayedRegions.map((region) => (
                  <MenuItem key={valueFor(region, "name", "region_name")} value={valueFor(region, "name", "region_name")}>
                    {valueFor(region, "name", "region_name")}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={() => void loadRegions()} disabled={loading}>
            Refresh
          </Button>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {showingSampleRegions && <Alert severity="info" sx={{ mb: 2 }}>Showing sample regions until the API returns created region records.</Alert>}
      {saveMessage && <Alert severity="success" sx={{ mb: 2 }}>{saveMessage}</Alert>}
      {saveError && <Alert severity="error" sx={{ mb: 2 }}>{saveError}</Alert>}

      <Paper variant="outlined">
        {loading ? (
          <Box display="flex" justifyContent="center" p={5}><CircularProgress /></Box>
        ) : displayedRegions.length === 0 ? (
          <Box p={4}><Typography color="text.secondary">No regions were returned by the API.</Typography></Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Region Name</TableCell>
                  <TableCell>Field Id</TableCell>
                  <TableCell>Farmer Name</TableCell>
                  <TableCell>Area</TableCell>
                  <TableCell>Is Monitoring</TableCell>
                  <TableCell>Mapped</TableCell>
                  <TableCell align="right">Map</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {fieldRows.map((row) => (
                  <TableRow key={row.id} hover>
                    <TableCell>{row.regionName}</TableCell>
                    <TableCell>{row.fieldId}</TableCell>
                    <TableCell>{row.farmerName}</TableCell>
                    <TableCell>{row.area}</TableCell>
                    <TableCell>{row.isMonitoring}</TableCell>
                    <TableCell>
                      <FormControl size="small" sx={{ minWidth: 120 }}>
                        <Select
                          value={row.mapped}
                          onChange={(event) => updateMappedValue(row.id, event.target.value as MappedValue)}
                          displayEmpty
                        >
                          <MenuItem value="yes">Yes</MenuItem>
                          <MenuItem value="no">No</MenuItem>
                        </Select>
                      </FormControl>
                    </TableCell>
                    <TableCell align="right">
                      <Button
                        size="small"
                        startIcon={<MapIcon />}
                        onClick={() => {
                          setSelectedField(row.feature ?? {});
                          setMapRegion(selectedRegion);
                        }}
                      >
                        Map
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {selectedRegion && (
        <Box display="flex" justifyContent="flex-end" mt={3}>
          <Button variant="contained" onClick={() => void handleSave()} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </Box>
      )}

      <Dialog open={Boolean(mapRegion)} onClose={() => setMapRegion(null)} fullWidth maxWidth="lg">
        <DialogTitle>Region Map: {mapRegion && valueFor(mapRegion, "name", "region_name")}</DialogTitle>
        <DialogContent dividers>
          {mapGeometry ? (
            <>
              <Typography variant="body2" color="text.secondary" mb={2}>Select a field by clicking its boundary on the map.</Typography>
              <MapContainer center={[20.5937, 78.9629]} zoom={5} style={{ height: 480, width: "100%" }}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <GeoJSON
                  data={mapGeometry}
                  style={() => ({ color: "#1976d2", weight: 2, fillColor: "#43a047", fillOpacity: 0.25 })}
                  onEachFeature={(feature, layer) => {
                    layer.on("click", () => setSelectedField((feature.properties ?? {}) as Record<string, unknown>));
                  }}
                />
                <FitMapToRegion geometry={mapGeometry} />
              </MapContainer>
              <Box mt={2} p={2} bgcolor="action.hover">
                <Typography variant="subtitle2" mb={1}>Selected Field</Typography>
                {selectedField ? Object.entries(selectedField).map(([key, value]) => (
                  <Typography key={key} variant="body2"><strong>{key.replaceAll("_", " ")}:</strong> {formatValue(value)}</Typography>
                )) : <Typography variant="body2" color="text.secondary">No field selected.</Typography>}
              </Box>
            </>
          ) : (
            <Alert severity="warning">No map geometry is available for this region.</Alert>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
}
