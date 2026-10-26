import { useCallback, useEffect, useMemo, useState } from "react";

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

import { getFieldRegions } from "../../services/regionApi";

import { saveRegionMappings } from "../../services/api";

import { Country, State } from "country-state-city";

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
  // /region-field returns region geometry in geometries[].geometry.
  const geometries = region.geometries;

  if (Array.isArray(geometries)) {
    for (const item of geometries) {
      if (!item || typeof item !== "object") continue;

      const candidate = (item as Record<string, unknown>).geometry;

      if (typeof candidate === "string") {
        try {
          const parsed = JSON.parse(candidate) as GeoJsonObject;
          if (parsed && typeof parsed === "object" && "type" in parsed) {
            return parsed;
          }
        } catch {
          // Ignore malformed geometry and try the next item.
        }
      } else if (
        candidate &&
        typeof candidate === "object" &&
        "type" in candidate
      ) {
        return candidate as GeoJsonObject;
      }
    }
  }

  // Backward compatibility for endpoints returning direct GeoJSON.
  const geometry = region.geometry ?? region.geojson ?? region.geo_json;

  if (typeof geometry === "string") {
    try {
      return JSON.parse(geometry) as GeoJsonObject;
    } catch {
      return null;
    }
  }

  if (geometry && typeof geometry === "object" && "type" in geometry) {
    return geometry as GeoJsonObject;
  }

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

const getCountry = (region: Region): string => valueFor(region, "country", "country_name");

const getState = (region: Region): string => valueFor(region, "state", "state_name");

const getRegionId = (region: Region): string => valueFor(region, "id", "region_id", "regionId", "regionID");

export default function RegionManagement() {

const [regions, setRegions] = useState<Region[]>([]);

const [selectedCountry, setSelectedCountry] = useState("");

const [selectedState, setSelectedState] = useState("");

const [selectedRegionId, setSelectedRegionId] = useState("");

const [fieldRows, setFieldRows] = useState<RegionFieldRow[]>([]);

const [mapRegion, setMapRegion] = useState<Region | null>(null);

const [selectedField, setSelectedField] = useState<Record<string, unknown> | null>(null);

const [loading, setLoading] = useState(true);

const [error, setError] = useState("");

const [saving, setSaving] = useState(false);

const [saveMessage, setSaveMessage] = useState("");

const [saveError, setSaveError] = useState("");

const countries = useMemo(() => Country.getAllCountries().sort((a, b) => a.name.localeCompare(b.name)), []);

const selectedCountryData = useMemo(() => countries.find((country) => country.name === selectedCountry), [countries, selectedCountry]);

const states = useMemo(

    () => selectedCountryData ? State.getStatesOfCountry(selectedCountryData.isoCode).sort((a, b) => a.name.localeCompare(b.name)) : [],

    [selectedCountryData]

  );

const loadRegions = useCallback(async () => {

  try {

    setLoading(true);

    setError("");

    // Global admin: organization_id is intentionally omitted.

const response = await getFieldRegions({} as Parameters<typeof getFieldRegions>[0]);

const nextRegions = getRegionList(response);

    setRegions(nextRegions);

    setSelectedRegionId((current) =>

      nextRegions.some(

        (region) => getRegionId(region) === current

      )

        ? current

        : ""

    );

  } catch (loadError: unknown) {

const message =

      loadError instanceof Error

        ? loadError.message

        : "Failed to load saved regions.";

    setError(message);

    setRegions([]);

    setSelectedRegionId("");

  } finally {

    setLoading(false);

  }

}, []);

  useEffect(() => { void loadRegions(); }, [loadRegions]);

const filteredRegions = useMemo(

    () => regions.filter((region) => getCountry(region) === selectedCountry && getState(region) === selectedState),

    [regions, selectedCountry, selectedState]

  );

const selectedRegion = filteredRegions.find((region) => getRegionId(region) === selectedRegionId) ?? null;

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

      region_name: valueFor(selectedRegion, "name", "region_name"),

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

          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={() => void loadRegions()} disabled={loading}>

            Refresh

          </Button>

        </Box>

      </Box>

      <Box display="grid" gridTemplateColumns={{ xs: "1fr", sm: "repeat(3, minmax(0, 1fr))" }} gap={2} mb={3}>

        <FormControl size="small" fullWidth>

          <InputLabel id="country-select-label">Country</InputLabel>

          <Select labelId="country-select-label" label="Country" value={selectedCountry} onChange={(event) => {

            setSelectedCountry(event.target.value); setSelectedState(""); setSelectedRegionId(""); setFieldRows([]); setSaveMessage(""); setSaveError("");

          }}>

            {countries.map((country) => <MenuItem key={country.isoCode} value={country.name}>{country.name}</MenuItem>)}

          </Select>

        </FormControl>

        <FormControl size="small" fullWidth disabled={!selectedCountry}>

          <InputLabel id="state-select-label">State</InputLabel>

          <Select labelId="state-select-label" label="State" value={selectedState} onChange={(event) => {

            setSelectedState(event.target.value); setSelectedRegionId(""); setFieldRows([]); setSaveMessage(""); setSaveError("");

          }}>

            {states.map((state) => <MenuItem key={`${state.countryCode}-${state.isoCode}`} value={state.name}>{state.name}</MenuItem>)}

          </Select>

        </FormControl>

        <FormControl size="small" fullWidth disabled={!selectedCountry || !selectedState || loading}>

          <InputLabel id="region-select-label">Region</InputLabel>

          <Select labelId="region-select-label" label="Region" value={selectedRegionId} onChange={(event) => {

            setSelectedRegionId(event.target.value); setSaveMessage(""); setSaveError("");

          }}>

            {filteredRegions.length === 0 ? <MenuItem value="" disabled>No regions available for this country and state</MenuItem> : filteredRegions.map((region) => (

              <MenuItem key={getRegionId(region)} value={getRegionId(region)}>{valueFor(region, "name", "region_name")}</MenuItem>

            ))}

          </Select>

        </FormControl>

      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {saveMessage && <Alert severity="success" sx={{ mb: 2 }}>{saveMessage}</Alert>}

      {saveError && <Alert severity="error" sx={{ mb: 2 }}>{saveError}</Alert>}

      <Paper variant="outlined">

        {loading ? (

          <Box display="flex" justifyContent="center" p={5}><CircularProgress /></Box>

        ) : filteredRegions.length === 0 ? (

          <Box p={4}><Typography color="text.secondary">No regions available for the selected country and state. Select a country and state with saved regions.</Typography></Box>

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
