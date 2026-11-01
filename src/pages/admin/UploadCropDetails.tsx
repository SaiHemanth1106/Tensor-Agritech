
import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent } from "react";

import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Typography,
} from "@mui/material";
import type { SelectChangeEvent } from "@mui/material";

import { GeoJSON, MapContainer, TileLayer, useMap } from "react-leaflet";
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { GeoJsonObject } from "geojson";

import * as XLSX from "xlsx";
import { Country, State } from "country-state-city";

import api, { getErrorMessage } from "../../services/api";
import {
  getFieldRegions,
  uploadCropDetailsExcel,
} from "../../services/regionApi";

type Region = Record<string, any>;

interface UploadCropDetailsProps {
  onComplete?: (regionName: string) => void;
}

interface CropRow {
  id: string;
  excelRowNumber: number;
  cropId: string;
  fieldId: string;
  cropName: string;
  cropType: string;
  season: string;
  farmerName: string;
  sowingDate: string;
  expectedHarvestDate: string;
  expectedYield: string;
  area: string;
  mappingStatus: "Pending" | "Mapped";
  raw: Record<string, any>;
}

interface FieldGeometry {
  geometryId: string;
  tempFieldId: string;
  geometry: GeoJsonObject;
  properties: Record<string, any>;
  label: string;
}

// ---------------------------------------------------------
// RESPONSE HELPERS
// ---------------------------------------------------------

const getRegionList = (response: any): Region[] => {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.regions)) return response.regions;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.data?.regions)) {
    return response.data.regions;
  }
  return [];
};

const getRegionId = (region: Region): string =>
  String(region?.region_id ?? region?.id ?? region?.regionId ?? "");

const getRegionName = (region: Region): string =>
  String(region?.name ?? region?.region_name ?? region?.regionName ?? "");

const getCountry = (region: Region): string =>
  String(region?.country ?? "").trim();

const getState = (region: Region): string =>
  String(region?.state ?? "").trim();

const normalizeKey = (value: string) =>
  value.trim().toLowerCase().replace(/[\s_-]+/g, "");

const getValue = (
  row: Record<string, any>,
  aliases: string[],
): string => {
  const normalized = new Map<string, any>();

  Object.entries(row).forEach(([key, value]) => {
    normalized.set(normalizeKey(key), value);
  });

  for (const alias of aliases) {
    const value = normalized.get(normalizeKey(alias));

    if (value !== undefined && value !== null && String(value).trim() !== "") {
      if (value instanceof Date) {
        return value.toISOString().slice(0, 10);
      }
      return String(value);
    }
  }

  return "";
};

// ---------------------------------------------------------
// EXCEL HELPERS
// ---------------------------------------------------------

const makeCropRow = (
  row: Record<string, any>,
  index: number,
): CropRow => ({
  id: `row-${index + 2}`,
  excelRowNumber: index + 2,
  cropId: "",
  fieldId: "",
  cropName: getValue(row, [
    "crop_name",
    "crop name",
    "crop_type",
    "crop type",
  ]),
  cropType: getValue(row, [
    "crop_type",
    "crop type",
    "crop_name",
    "crop name",
  ]),
  season: getValue(row, ["season"]),
  farmerName: getValue(row, [
    "farmer_name",
    "farmer name",
    "farmer",
  ]),
  sowingDate: getValue(row, ["sowing_date", "sowing date"]),
  expectedHarvestDate: getValue(row, [
    "expected_harvest_date",
    "expected harvest date",
  ]),
  expectedYield: getValue(row, ["expected_yield", "expected yield"]),
  area: getValue(row, ["area", "field area"]),
  mappingStatus: "Pending",
  raw: row,
});

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("Unable to read Excel file."));
        return;
      }

      const base64 = reader.result.includes(",")
        ? reader.result.split(",")[1]
        : reader.result;

      if (!base64) {
        reject(new Error("Invalid Excel file."));
        return;
      }

      resolve(base64);
    };

    reader.onerror = () =>
      reject(new Error("Unable to read Excel file."));

    reader.readAsDataURL(file);
  });

// ---------------------------------------------------------
// MAP HELPERS
// ---------------------------------------------------------

function FitMapToGeometry({
  geometry,
}: {
  geometry: GeoJsonObject;
}) {
  const map = useMap();

  useEffect(() => {
    try {
      const bounds = L.geoJSON(geometry as any).getBounds();

      if (bounds.isValid()) {
        map.fitBounds(bounds, {
          padding: [24, 24],
          maxZoom: 17,
        });
      }
    } catch {
      // Leave the map available if geometry is invalid.
    }
  }, [geometry, map]);

  return null;
}

const normalizeGeometryRecords = (
  region: Region | null,
): FieldGeometry[] => {
  if (!region) return [];

  const records = Array.isArray(region.geometries)
    ? region.geometries
    : [];

  return records.flatMap((record: any, index: number) => {
    let geometry = record?.geometry;

    // Some API responses return GeoJSON as a JSON string.
    if (typeof geometry === "string") {
      try {
        geometry = JSON.parse(geometry);
      } catch {
        return [];
      }
    }

    // Also support a GeoJSON Feature response.
    if (geometry?.type === "Feature") {
      geometry = geometry.geometry;
    }

    if (
      !geometry ||
      typeof geometry !== "object" ||
      !geometry.type
    ) {
      return [];
    }

    const tempFieldId = String(
      record?.temp_field_id ??
      record?.tempFieldId ??
      record?.properties?.temp_field_id ??
      "",
    );

    const properties = {
      ...(record?.properties ?? {}),
      geometry_id:
        record?.geometry_reference_id ??
        record?.geometry_id ??
        record?.id ??
        null,
      temp_field_id: tempFieldId,
      field_name:
        record?.field_name ??
        record?.name ??
        record?.properties?.field_name ??
        `Field ${index + 1}`,
    };

    return [
      {
        geometryId: String(properties.geometry_id ?? ""),
        tempFieldId,
        geometry: geometry as GeoJsonObject,
        properties,
        label: String(properties.field_name),
      },
    ];
  });
};

const asFeatureCollection = (
  records: FieldGeometry[],
): GeoJsonObject =>
  ({
    type: "FeatureCollection",
    features: records.map((record) => ({
      type: "Feature",
      properties: {
        ...record.properties,
        geometry_id: record.geometryId,
        temp_field_id: record.tempFieldId,
        field_name: record.label,
      },
      geometry: record.geometry as any,
    })),
  }) as GeoJsonObject;

// ---------------------------------------------------------
// BACKEND CROP NORMALIZATION
// ---------------------------------------------------------

const mapBackendCrop = (
  crop: any,
  index: number,
): CropRow => {
  const cropId =
    crop?.crop_id == null ? "" : String(crop.crop_id);

  const fieldId =
    crop?.field_id == null ? "" : String(crop.field_id);

  const status = String(
    crop?.mapping_status ?? "",
  ).toLowerCase();

  return {
    id: `saved-${cropId || index}`,
    excelRowNumber: Number(
      crop?.excel_row_number ?? index + 2,
    ),
    cropId,
    fieldId,
    cropName: String(
      crop?.crop_name ?? crop?.cropName ?? "",
    ),
    cropType: String(
      crop?.crop_type ?? crop?.crop_name ?? "",
    ),
    season: String(crop?.season ?? ""),
    farmerName: String(crop?.farmer_name ?? ""),
    sowingDate: String(crop?.sowing_date ?? ""),
    expectedHarvestDate: String(
      crop?.expected_harvest_date ?? "",
    ),
    expectedYield:
      crop?.expected_yield == null
        ? ""
        : String(crop.expected_yield),
    area:
      crop?.area == null ? "" : String(crop.area),
    mappingStatus:
      status === "mapped" || fieldId !== ""
        ? "Mapped"
        : "Pending",
    raw: crop,
  };
};

// =========================================================
// MAIN COMPONENT
// =========================================================

export default function UploadCropDetails({
  onComplete,
}: UploadCropDetailsProps) {
  const [regions, setRegions] = useState<Region[]>([]);

  const [selectedCountryCode, setSelectedCountryCode] =
    useState("");

  const [selectedState, setSelectedState] = useState("");

  const [selectedRegionId, setSelectedRegionId] =
    useState("");

  const [rows, setRows] = useState<CropRow[]>([]);

  const [fileName, setFileName] = useState("");

  const [fileContent, setFileContent] =
    useState<string | null>(null);

  const [uploaded, setUploaded] = useState(false);

  const [loading, setLoading] = useState(true);

  const [loadingCrops, setLoadingCrops] = useState(false);

  const [uploading, setUploading] = useState(false);

  const [error, setError] = useState("");

  const [success, setSuccess] = useState("");

  // Mapping dialog state
  const [mappingRow, setMappingRow] =
    useState<CropRow | null>(null);

  const [selectedGeometryId, setSelectedGeometryId] =
    useState("");

  const [selectedRegionGeometries, setSelectedRegionGeometries] =
    useState<FieldGeometry[]>([]);

  const [loadingGeometries, setLoadingGeometries] =
    useState(false);

  const [savingMapping, setSavingMapping] = useState(false);

  const countries = useMemo(
    () => Country.getAllCountries(),
    [],
  );

  const selectedCountry = useMemo(
    () =>
      countries.find(
        (country) => country.isoCode === selectedCountryCode,
      ) ?? null,
    [countries, selectedCountryCode],
  );

  const states = useMemo(
    () =>
      selectedCountryCode
        ? State.getStatesOfCountry(selectedCountryCode)
        : [],
    [selectedCountryCode],
  );

  // -------------------------------------------------------
  // LOAD REGION DROPDOWN DATA
  // This request intentionally loads lightweight regions.
  // -------------------------------------------------------

  useEffect(() => {
    let active = true;

    const loadRegions = async () => {
      setLoading(true);
      setError("");

      try {
        const response = await getFieldRegions();

        if (active) {
          setRegions(getRegionList(response));
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to load regions.",
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadRegions();

    return () => {
      active = false;
    };
  }, []);

  const filteredRegions = useMemo(
    () =>
      regions
        .filter(
          (region) =>
            selectedCountry &&
            getCountry(region).toLowerCase() ===
              selectedCountry.name.toLowerCase() &&
            getState(region).toLowerCase() ===
              selectedState.toLowerCase(),
        )
        .sort((a, b) =>
          getRegionName(a).localeCompare(getRegionName(b)),
        ),
    [regions, selectedCountry, selectedState],
  );

  const selectedRegion = useMemo(
    () =>
      regions.find(
        (region) => getRegionId(region) === selectedRegionId,
      ) ?? null,
    [regions, selectedRegionId],
  );

  const regionName = selectedRegion
    ? getRegionName(selectedRegion)
    : "";

  // IMPORTANT:
  // Mapping uses separately fetched geometries, not the
  // lightweight initial region dropdown response.
  const fieldGeometries = selectedRegionGeometries;

  const fieldGeometryCollection = useMemo(
    () => asFeatureCollection(fieldGeometries),
    [fieldGeometries],
  );

  const selectedFieldGeometry =
    fieldGeometries.find(
      (field) => field.tempFieldId === selectedGeometryId,
    ) ?? null;

  const mappedCount = rows.filter(
    (row) => row.mappingStatus === "Mapped",
  ).length;

  const pendingCount = rows.length - mappedCount;

  // -------------------------------------------------------
  // LOAD SAVED CROPS FOR SELECTED REGION
  // Keep the existing GET /s1/map endpoint.
  // -------------------------------------------------------

  const loadSavedCrops = async (regionId: string) => {
    if (!regionId) return;

    setLoadingCrops(true);
    setError("");
    setSuccess("");

    try {
      const response = await api.get(`/s1/region/crops/map?region_id=${regionId}`);

      const result = response.data?.data ?? response.data;

      if (result?.success === false) {
        throw new Error(
          result?.error ??
            result?.message ??
            "Unable to load saved crop records.",
        );
      }

      const savedCrops = Array.isArray(result?.crops)
        ? result.crops
        : [];

      setRows(savedCrops.map(mapBackendCrop));
      setUploaded(savedCrops.length > 0);
      setFileName("");
      setFileContent(null);

      if (savedCrops.length > 0) {
        setSuccess(
          `Loaded ${savedCrops.length} saved crop record(s) for this region.`,
        );
      } else {
        setSuccess(
          "No temporary crop records were returned for this region. Upload an Excel file if needed.",
        );
      }
    } catch (err) {
      setRows([]);
      setUploaded(false);

      setError(
        err instanceof Error
          ? err.message
          : getErrorMessage(err),
      );
    } finally {
      setLoadingCrops(false);
    }
  };

  // -------------------------------------------------------
  // DROPDOWN HANDLERS
  // -------------------------------------------------------

  const handleCountryChange = (
    event: SelectChangeEvent,
  ) => {
    setSelectedCountryCode(event.target.value);
    setSelectedState("");
    setSelectedRegionId("");
    setRows([]);
    setUploaded(false);
    setFileName("");
    setFileContent(null);
    setSelectedRegionGeometries([]);
    setMappingRow(null);
    setError("");
    setSuccess("");
  };

  const handleStateChange = (
    event: SelectChangeEvent,
  ) => {
    setSelectedState(event.target.value);
    setSelectedRegionId("");
    setRows([]);
    setUploaded(false);
    setFileName("");
    setFileContent(null);
    setSelectedRegionGeometries([]);
    setMappingRow(null);
    setError("");
    setSuccess("");
  };

  const handleRegionChange = (
    event: SelectChangeEvent,
  ) => {
    const regionId = event.target.value;

    setSelectedRegionId(regionId);
    setRows([]);
    setUploaded(false);
    setFileName("");
    setFileContent(null);
    setSelectedRegionGeometries([]);
    setMappingRow(null);
    setSelectedGeometryId("");
    setError("");
    setSuccess("");

    void loadSavedCrops(regionId);
  };

  // -------------------------------------------------------
  // READ EXCEL FILE
  // -------------------------------------------------------

  const handleExcelFile = async (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    setError("");
    setSuccess("");

    const file = event.target.files?.[0];

    if (!file) return;

    if (!selectedRegionId) {
      setError(
        "Please select a country, state and region first.",
      );
      event.target.value = "";
      return;
    }

    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      setError("Please upload a valid .xlsx Excel file.");
      event.target.value = "";
      return;
    }

    try {
      const buffer = await file.arrayBuffer();

      const workbook = XLSX.read(buffer, {
        type: "array",
        cellDates: true,
      });

      if (!workbook.SheetNames.length) {
        throw new Error("Excel file contains no sheets.");
      }

      const sheetName =
        workbook.SheetNames.find(
          (name) => name.trim().toLowerCase() === "crops",
        ) ?? workbook.SheetNames[0];

      const rawRows = XLSX.utils.sheet_to_json<
        Record<string, any>
      >(workbook.Sheets[sheetName], {
        defval: "",
        raw: false,
      });

      if (!rawRows.length) {
        throw new Error("Excel contains no crop rows.");
      }

      setRows(rawRows.map(makeCropRow));
      setFileName(file.name);
      setFileContent(await fileToBase64(file));
      setUploaded(false);

      setSuccess(
        `${rawRows.length} crop row(s) loaded. Click UPLOAD EXCEL to save them.`,
      );
    } catch (err) {
      setRows([]);
      setFileName("");
      setFileContent(null);
      setUploaded(false);

      setError(
        err instanceof Error
          ? err.message
          : "Failed to read Excel file.",
      );
    } finally {
      event.target.value = "";
    }
  };

  // -------------------------------------------------------
  // UPLOAD EXCEL
  // -------------------------------------------------------

  const handleUpload = async () => {
    setError("");
    setSuccess("");

    if (!selectedRegionId || !fileName || !fileContent) {
      setError("Select a region and an Excel file first.");
      return;
    }

    try {
      setUploading(true);

      const result = await uploadCropDetailsExcel(
        selectedRegionId,
        {
          region_id: selectedRegionId,
          file_name: fileName,
          file_content: fileContent,
        },
      );

      if (result?.success === false) {
        throw new Error(
          result?.details ??
            result?.error ??
            "Excel upload failed.",
        );
      }

      const backendRows =
        result?.crops?.rows ?? result?.rows ?? [];

      const uploadedRows: CropRow[] = rows.map(
        (row, index) => ({
          ...row,
          cropId:
            backendRows[index]?.crop_id == null
              ? ""
              : String(backendRows[index].crop_id),
          mappingStatus: "Pending",
          fieldId: "",
        }),
      );

      if (
        uploadedRows.some((row) => !row.cropId)
      ) {
        throw new Error(
          "Excel was uploaded, but one or more crop IDs were missing in the upload response. Reload saved crops before mapping.",
        );
      }

      setRows(uploadedRows);
      setUploaded(true);

      setSuccess(
        result?.message ??
          `${uploadedRows.length} crop row(s) uploaded successfully.`,
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : getErrorMessage(err),
      );
    } finally {
      setUploading(false);
    }
  };

  // -------------------------------------------------------
  // FETCH GEOMETRIES WHEN MAP IS CLICKED
  // This is the main mapping fix.
  // -------------------------------------------------------

  const openMapping = async (row: CropRow) => {
    if (!uploaded) {
      setError(
        "Upload the Excel file or load saved crop records first.",
      );
      return;
    }

    if (!row.cropId) {
      setError(
        "This row has no crop ID from the backend. Reload saved crops or inspect the upload response.",
      );
      return;
    }

    if (!selectedRegionId) {
      setError("Please select a region first.");
      return;
    }

    setError("");
    setSuccess("");
    setSelectedGeometryId("");
    setSelectedRegionGeometries([]);
    setMappingRow(row);
    setLoadingGeometries(true);

    try {
      // Request geometries for this region only.
      const response = await getFieldRegions({
        region_id: Number(selectedRegionId),
        include_geometries: true,
      });

      const regionsWithGeometry = getRegionList(response);

      const regionWithGeometry = regionsWithGeometry.find(
        (region) =>
          getRegionId(region) === selectedRegionId,
      );

      if (!regionWithGeometry) {
        throw new Error(
          "The selected region was not returned by the region API.",
        );
      }

      const geometries =
        normalizeGeometryRecords(regionWithGeometry);

      if (geometries.length === 0) {
        throw new Error(
          "No field geometries were returned for this region. Check the region API response and the region_field_geometries table.",
        );
      }

      const geometriesWithoutTempId = geometries.filter(
        (geometry) => !geometry.tempFieldId,
      );

      if (geometriesWithoutTempId.length > 0) {
        throw new Error(
          "Some field geometries do not contain temp_field_id. The mapping API requires this ID.",
        );
      }

      setSelectedRegionGeometries(geometries);
    } catch (err) {
      setMappingRow(null);

      setError(
        err instanceof Error
          ? err.message
          : getErrorMessage(err),
      );
    } finally {
      setLoadingGeometries(false);
    }
  };

  // -------------------------------------------------------
  // SELECT A FIELD POLYGON
  // -------------------------------------------------------

  const handleFieldFeatureClick = (
    feature: any,
    layer: any,
  ) => {
    const properties = feature?.properties ?? {};

    if (layer?.bindTooltip) {
      layer.bindTooltip(
        String(properties.field_name ?? "Field"),
        { sticky: true },
      );
    }

    layer.on("click", () => {
      const tempFieldId = String(
        properties.temp_field_id ?? "",
      );

      if (!tempFieldId) {
        setError(
          "This geometry has no temp_field_id and cannot be mapped.",
        );
        return;
      }

      setSelectedGeometryId(tempFieldId);
      setError("");
    });
  };

  // -------------------------------------------------------
  // CONFIRM CROP-TO-FIELD MAPPING
  // -------------------------------------------------------

  const confirmMapping = async () => {
    if (
      !mappingRow ||
      !selectedRegionId ||
      !selectedGeometryId
    ) {
      setError(
        "Select a field polygon on the map before confirming.",
      );
      return;
    }

    if (!mappingRow.cropId) {
      setError(
        "The selected crop has no valid backend crop ID.",
      );
      return;
    }

    try {
      setSavingMapping(true);
      setError("");

      const response = await api.post(
        "/s1/region/crops/map",
        {
          action: "map",
          region_id: Number(selectedRegionId),
          crop_id: mappingRow.cropId,
          temp_field_id: selectedGeometryId,
        },
      );

      const result =
        response.data?.data ?? response.data;

      if (result?.success === false) {
        throw new Error(
          result?.message ??
            result?.error ??
            "Failed to map crop to field.",
        );
      }

      setMappingRow(null);
      setSelectedGeometryId("");

      setSuccess(
        "Mapping saved. Refreshing the saved crop records...",
      );

      await loadSavedCrops(selectedRegionId);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : getErrorMessage(err),
      );
    } finally {
      setSavingMapping(false);
    }
  };

  // -------------------------------------------------------
  // COMPLETE MAPPING
  // -------------------------------------------------------

  const handleComplete = async () => {
    if (!uploaded || rows.length === 0) {
      setError("No uploaded crop records are available.");
      return;
    }

    if (pendingCount > 0) {
      setError(
        `Map all crop records before completing. ${pendingCount} record(s) remain pending.`,
      );
      return;
    }

    try {
      setError("");

      await api.post("/s1/map", {
        action: "complete",
        region_id: Number(selectedRegionId),
      });

      setSuccess(
        "Crop mapping completed successfully.",
      );

      if (onComplete) {
        onComplete(regionName);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : getErrorMessage(err),
      );
    }
  };

  // -------------------------------------------------------
  // LOADING SCREEN
  // -------------------------------------------------------

  if (loading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        py={6}
      >
        <CircularProgress />
      </Box>
    );
  }

  // =========================================================
  // UI
  // =========================================================

  return (
    <Box>
      <Paper
        elevation={3}
        sx={{ p: 3, borderRadius: 3 }}
      >
        <Typography
          variant="h5"
          fontWeight="bold"
          mb={1}
        >
          🌾 Upload Crop Details
        </Typography>

        <Typography
          variant="body2"
          color="text.secondary"
          mb={3}
        >
          Select a country, state and region, upload crop
          details, then map each crop to a field.
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity="success" sx={{ mb: 2 }}>
            {success}
          </Alert>
        )}

        {/* COUNTRY, STATE AND REGION */}

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              sm: "1fr 1fr",
            },
            gap: 2,
            mb: 2,
          }}
        >
          <FormControl fullWidth required>
            <InputLabel id="crop-country-label">
              Country
            </InputLabel>

            <Select
              labelId="crop-country-label"
              value={selectedCountryCode}
              label="Country"
              onChange={handleCountryChange}
            >
              {countries.map((country) => (
                <MenuItem
                  key={country.isoCode}
                  value={country.isoCode}
                >
                  {country.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl
            fullWidth
            required
            disabled={!selectedCountryCode}
          >
            <InputLabel id="crop-state-label">
              State
            </InputLabel>

            <Select
              labelId="crop-state-label"
              value={selectedState}
              label="State"
              onChange={handleStateChange}
            >
              {states.map((state) => (
                <MenuItem
                  key={`${state.countryCode}-${state.isoCode}-${state.name}`}
                  value={state.name}
                >
                  {state.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl
            fullWidth
            required
            disabled={
              !selectedCountryCode || !selectedState
            }
            sx={{
              gridColumn: {
                xs: "auto",
                sm: "1 / -1",
              },
            }}
          >
            <InputLabel id="crop-region-label">
              Region
            </InputLabel>

            <Select
              labelId="crop-region-label"
              value={selectedRegionId}
              label="Region"
              onChange={handleRegionChange}
            >
              {filteredRegions.map((region) => {
                const id = getRegionId(region);

                return (
                  <MenuItem key={id} value={id}>
                    {getRegionName(region)}
                  </MenuItem>
                );
              })}
            </Select>
          </FormControl>
        </Box>

        {selectedRegion && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Selected region: <strong>{regionName}</strong>
          </Alert>
        )}

        {loadingCrops && (
          <Box
            display="flex"
            alignItems="center"
            gap={1}
            mb={2}
          >
            <CircularProgress size={20} />

            <Typography variant="body2">
              Loading saved crop records...
            </Typography>
          </Box>
        )}

        {/* COUNTS */}

        <Box
          display="flex"
          gap={1}
          flexWrap="wrap"
          mb={2}
        >
          <Chip label={`Total: ${rows.length}`} />

          <Chip
            label={`Mapped: ${mappedCount}`}
            color="success"
            variant="outlined"
          />

          <Chip
            label={`Pending: ${pendingCount}`}
            color="warning"
            variant="outlined"
          />
        </Box>

        {/* EXCEL FILE */}

        <Button
          component="label"
          fullWidth
          variant="outlined"
          disabled={
            !selectedRegionId ||
            uploading ||
            loadingCrops
          }
          sx={{ mb: 1 }}
        >
          SELECT EXCEL FILE

          <input
            hidden
            type="file"
            accept=".xlsx"
            onChange={handleExcelFile}
          />
        </Button>

        {fileName && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mb: 2 }}
          >
            Selected file: {fileName}
          </Typography>
        )}

        <Button
          fullWidth
          variant="contained"
          disabled={
            uploading ||
            !selectedRegionId ||
            !fileContent
          }
          onClick={handleUpload}
          sx={{
            mb: 3,
            backgroundColor: "#075d16",
            "&:hover": {
              backgroundColor: "#064d12",
            },
          }}
        >
          {uploading ? (
            <CircularProgress
              size={21}
              color="inherit"
            />
          ) : (
            "UPLOAD EXCEL"
          )}
        </Button>

        {/* EXCEL PREVIEW */}

        {rows.length > 0 && (
          <>
            <Typography
              variant="h6"
              fontWeight="bold"
              mb={1}
            >
              Excel Preview
            </Typography>

            <Box sx={{ overflowX: "auto" }}>
              <Box
                component="table"
                sx={{
                  width: "100%",
                  minWidth: 1050,
                  borderCollapse: "collapse",
                  "& th, & td": {
                    borderBottom: "1px solid",
                    borderColor: "divider",
                    textAlign: "left",
                    p: 1.25,
                    fontSize: 14,
                    whiteSpace: "nowrap",
                  },
                  "& th": {
                    backgroundColor: "action.hover",
                    fontWeight: 700,
                  },
                }}
              >
                <thead>
                  <tr>
                    <th>Crop Type</th>
                    <th>Season</th>
                    <th>Farmer Name</th>
                    <th>Sowing Date</th>
                    <th>Expected Harvest</th>
                    <th>Expected Yield</th>
                    <th>Area</th>
                    <th>Mapping</th>
                    <th>Is Mapped</th>
                  </tr>
                </thead>

                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td>
                        {row.cropType ||
                          row.cropName ||
                          "-"}
                      </td>

                      <td>{row.season || "-"}</td>

                      <td>{row.farmerName || "-"}</td>

                      <td>{row.sowingDate || "-"}</td>

                      <td>
                        {row.expectedHarvestDate || "-"}
                      </td>

                      <td>{row.expectedYield || "-"}</td>

                      <td>{row.area || "-"}</td>

                      <td>
                        <Button
                          size="small"
                          variant="contained"
                          disabled={
                            !uploaded ||
                            row.mappingStatus === "Mapped" ||
                            loadingGeometries
                          }
                          onClick={() => openMapping(row)}
                          sx={{
                            backgroundColor: "#075d16",
                            "&:hover": {
                              backgroundColor: "#064d12",
                            },
                          }}
                        >
                          {row.mappingStatus === "Mapped"
                            ? "MAPPED"
                            : "MAP"}
                        </Button>
                      </td>

                      <td>
                        <Chip
                          size="small"
                          label={
                            row.mappingStatus === "Mapped"
                              ? "Yes"
                              : "No"
                          }
                          color={
                            row.mappingStatus === "Mapped"
                              ? "success"
                              : "warning"
                          }
                          variant="outlined"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Box>
            </Box>

            <Button
              fullWidth
              variant="outlined"
              disabled={
                !uploaded || pendingCount > 0
              }
              onClick={handleComplete}
              sx={{ mt: 2 }}
            >
              COMPLETE MAPPING
            </Button>
          </>
        )}
      </Paper>

      {/* ===================================================
          MAP CROP TO FIELD DIALOG
         =================================================== */}

      <Dialog
        open={Boolean(mappingRow)}
        onClose={() => {
          if (!savingMapping && !loadingGeometries) {
            setMappingRow(null);
            setSelectedGeometryId("");
            setSelectedRegionGeometries([]);
          }
        }}
        fullWidth
        maxWidth="lg"
      >
        <DialogTitle>
          Map Crop to Field
        </DialogTitle>

        <DialogContent dividers>
          {mappingRow && (
            <Box sx={{ py: 1 }}>
              <Typography>
                <strong>Crop:</strong>{" "}
                {mappingRow.cropType ||
                  mappingRow.cropName ||
                  "-"}
              </Typography>

              <Typography>
                <strong>Season:</strong>{" "}
                {mappingRow.season || "-"}
              </Typography>

              <Typography>
                <strong>Farmer:</strong>{" "}
                {mappingRow.farmerName || "-"}
              </Typography>

              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mt: 1, mb: 2 }}
              >
                Click the correct field polygon on the map,
                then confirm the mapping.
              </Typography>

              {loadingGeometries ? (
                <Box
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  gap={2}
                  py={5}
                >
                  <CircularProgress />

                  <Typography>
                    Loading field geometries...
                  </Typography>
                </Box>
              ) : fieldGeometries.length > 0 ? (
                <Box
                  sx={{
                    height: 500,
                    width: "100%",
                    borderRadius: 1,
                    overflow: "hidden",
                  }}
                >
                  <MapContainer
                    center={[20.5937, 78.9629]}
                    zoom={5}
                    style={{
                      height: "100%",
                      width: "100%",
                    }}
                  >
                    <TileLayer
                      attribution="&copy; OpenStreetMap contributors"
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />

                    <GeoJSON
                      key={`${selectedRegionId}-${fieldGeometries.length}-${selectedGeometryId}`}
                      data={fieldGeometryCollection as any}
                      style={(feature: any) => {
                        const selected =
                          String(
                            feature?.properties?.temp_field_id ?? "",
                          ) === selectedGeometryId;

                        return {
                          color: selected
                            ? "#ff9800"
                            : "#075d16",
                          weight: selected ? 4 : 2,
                          fillColor: selected
                            ? "#ffcc80"
                            : "#66bb6a",
                          fillOpacity: selected
                            ? 0.55
                            : 0.25,
                        };
                      }}
                      onEachFeature={handleFieldFeatureClick}
                    />

                    <FitMapToGeometry
                      geometry={fieldGeometryCollection}
                    />
                  </MapContainer>
                </Box>
              ) : (
                <Alert severity="warning">
                  No field geometries were returned for
                  this region. Check the region API
                  response and saved field geometries.
                </Alert>
              )}

              {selectedFieldGeometry && (
                <Alert
                  severity="success"
                  sx={{ mt: 2 }}
                >
                  Selected field:{" "}
                  <strong>
                    {selectedFieldGeometry.label}
                  </strong>
                </Alert>
              )}
            </Box>
          )}
        </DialogContent>

        <DialogActions>
          <Button
            onClick={() => {
              setMappingRow(null);
              setSelectedGeometryId("");
              setSelectedRegionGeometries([]);
            }}
            disabled={
              savingMapping || loadingGeometries
            }
          >
            CANCEL
          </Button>

          <Button
            variant="contained"
            onClick={confirmMapping}
            disabled={
              !selectedGeometryId ||
              !mappingRow ||
              savingMapping ||
              loadingGeometries
            }
            sx={{
              backgroundColor: "#075d16",
              "&:hover": {
                backgroundColor: "#064d12",
              },
            }}
          >
            {savingMapping
              ? "SAVING..."
              : "CONFIRM MAPPING"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
