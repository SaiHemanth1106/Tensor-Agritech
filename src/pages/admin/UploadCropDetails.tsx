import {
  useEffect,
  useMemo,
  useState,
} from "react";

import type { ChangeEvent } from "react";

import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  Typography,
} from "@mui/material";

import MapIcon from "@mui/icons-material/Map";

import {
  GeoJSON,
  MapContainer,
  TileLayer,
  useMap,
} from "react-leaflet";

import * as L from "leaflet";
import "leaflet/dist/leaflet.css";

import type {
  Feature,
  FeatureCollection,
  GeoJsonObject,
  Geometry,
} from "geojson";

import * as XLSX from "xlsx";

import {
  getRegions,
  saveRegionMappings,
  uploadCropDetailsExcel,
} from "../../services/api";

// ============================================================
// TYPES
// ============================================================

type Region = Record<string, unknown>;

interface UploadCropDetailsProps {
  onComplete: (regionName: string) => void;
}

interface ExcelRow {
  id: string;
  excelRowNumber: number;
  fieldReference: string;
  farmerName: string;
  cropName: string;
  variety: string;
  season: string;
  sowingDate: string;
  expectedHarvestDate: string;
  expectedYield: string;
  area: string;

  raw: Record<string, unknown>;
}

interface SelectedField {
  key: string;
  label: string;
  index: number;

  properties: Record<string, unknown>;
}

interface SavedMapping {
  fieldKey: string;
  fieldLabel: string;
  fieldIndex: number;
  mappedAt: string;
}

interface MappingSession {
  regionId: string;
  regionName: string;
  fileName: string;
  uploadedToTemp: boolean;

  rows: ExcelRow[];

  mappings: Record<
    string,
    SavedMapping
  >;

  completed: boolean;
}

// ============================================================
// REGION HELPERS
// ============================================================

const getRegionList = (
  response: unknown
): Region[] => {
  if (Array.isArray(response)) {
    return response as Region[];
  }

  if (
    response &&
    typeof response === "object"
  ) {
    const record =
      response as Record<
        string,
        unknown
      >;

    if (
      Array.isArray(
        record.regions
      )
    ) {
      return record.regions as Region[];
    }

    if (
      Array.isArray(
        record.data
      )
    ) {
      return record.data as Region[];
    }
  }

  return [];
};

const valueFor = (
  region: Region,
  ...keys: string[]
) => {
  for (const key of keys) {
    const value =
      region[key];

    if (
      value !== undefined &&
      value !== null &&
      value !== ""
    ) {
      return String(value);
    }
  }

  return "-";
};

const getRegionId = (
  region: Region
) => {
  const value =
    region.id ??
    region.region_id ??
    region.regionId ??
    region.regionID;

  if (
    value === undefined ||
    value === null
  ) {
    return "";
  }

  return String(value);
};

// ============================================================
// PENDING REGION
// ============================================================

const readPendingRegion = () => {
  try {
    const value =
      localStorage.getItem(
        "pendingCropRegion"
      );

    if (!value) {
      return null;
    }

    const parsed =
      JSON.parse(value);

    if (!parsed?.regionId) {
      return null;
    }

    return {
      regionId: String(
        parsed.regionId
      ),

      regionName: String(
        parsed.regionName || ""
      ),
    };
  } catch {
    return null;
  }
};

// ============================================================
// EXCEL HELPERS
// ============================================================

const normalizeKey = (
  value: string
) =>
  value
    .trim()
    .toLowerCase()
    .replace(
      /[\s_-]+/g,
      ""
    );

const readColumn = (
  row: Record<
    string,
    unknown
  >,

  aliases: string[]
) => {
  const lookup =
    new Map<
      string,
      unknown
    >();

  Object.entries(
    row
  ).forEach(
    ([key, value]) => {
      lookup.set(
        normalizeKey(key),
        value
      );
    }
  );

  for (
    const alias of aliases
  ) {
    const value =
      lookup.get(
        normalizeKey(alias)
      );

    if (
      value !== undefined &&
      value !== null &&
      String(value).trim() !== ""
    ) {
      return String(value);
    }
  }

  return "-";
};

const makeExcelRow = (
  raw: Record<
    string,
    unknown
  >,

  index: number
): ExcelRow => {
  return {
    id: `excel-row-${index + 2}`,

    // Excel first row = header
    excelRowNumber:
      index + 2,

    fieldReference:
      readColumn(
        raw,
        [
          "Field ID",
          "Field Id",
          "Field_ID",
          "Field",
          "Field Name",
          "Plot ID",
          "Plot",
          "Survey Number",
          "Survey No",
        ]
      ),

    farmerName:
      readColumn(
        raw,
        [
          "Farmer Name",
          "Farmer",
          "Owner Name",
          "Owner",
        ]
      ),

    cropName:
      readColumn(
        raw,
        [
          "Crop Name",
          "Crop",
          "Crop Type",
        ]
      ),

    variety:
      readColumn(
        raw,
        [
          "Variety",
          "Crop Variety",
        ]
      ),

    season:
      readColumn(
        raw,
        [
          "Season",
          "Crop Season",
        ]
      ),

    sowingDate:
      readColumn(
        raw,
        [
          "Sowing Date",
          "Planting Date",
          "Sowing_Date",
        ]
      ),

    expectedHarvestDate:
      readColumn(
        raw,
        [
          "Expected Harvest Date",
          "Expected Harvested Date",
          "Expected Harvesting Date",
          "Harvest Date",
          "Harvesting Date",
        ]
      ),

    expectedYield:
      readColumn(
        raw,
        [
          "Expected Yield",
          "Expected Yeild",
          "Expected Yeid",
          "Yield",
        ]
      ),

    area:
      readColumn(
        raw,
        [
          "Area",
          "Field Area",
          "Field_Area",
          "Acres",
          "Acre",
          "Hectares",
          "Hectare",
        ]
      ),

    raw,
  };
};

// ============================================================
// FILE TO BASE64
// ============================================================

const fileToBase64 = (
  file: File
): Promise<string> => {
  return new Promise(
    (
      resolve,
      reject
    ) => {
      const reader =
        new FileReader();

      reader.onload = () => {
        const result =
          reader.result;

        if (
          typeof result !==
          "string"
        ) {
          reject(
            new Error(
              "Unable to read Excel file."
            )
          );

          return;
        }

        const base64 =
          result.includes(",")
            ? result.split(",")[1]
            : result;

        if (!base64) {
          reject(
            new Error(
              "Invalid Excel file."
            )
          );

          return;
        }

        resolve(base64);
      };

      reader.onerror = () =>
        reject(
          new Error(
            "Unable to read Excel file."
          )
        );

      reader.readAsDataURL(
        file
      );
    }
  );
};

// ============================================================
// RESUME SESSION
// ============================================================

const sessionKey = (
  regionId: string
) =>
  `cropMappingSession:${regionId}`;

const loadSession = (
  regionId: string
): MappingSession | null => {
  try {
    const stored =
      localStorage.getItem(
        sessionKey(
          regionId
        )
      );

    if (!stored) {
      return null;
    }

    return JSON.parse(
      stored
    ) as MappingSession;
  } catch {
    return null;
  }
};

const saveSession = (
  session: MappingSession
) => {
  try {
    localStorage.setItem(
      sessionKey(
        session.regionId
      ),

      JSON.stringify(
        session
      )
    );
  } catch (
    storageError
  ) {
    console.warn(
      "Unable to save mapping progress:",
      storageError
    );
  }
};

// ============================================================
// REGION GEOMETRY
// ============================================================

const getRegionGeometry = (
  region: Region | null,
  regionId: string
): GeoJsonObject | null => {
  // First try geometry returned from backend

  if (region) {
    const source =
      region.geometry ??
      region.geojson ??
      region.geo_json;

    if (
      typeof source ===
      "string"
    ) {
      try {
        return JSON.parse(
          source
        ) as GeoJsonObject;
      } catch {
        // Try local fallback below
      }
    }

    if (
      source &&
      typeof source ===
        "object" &&
      "type" in source
    ) {
      return source as GeoJsonObject;
    }
  }

  // Fallback saved during CreateRegion

  try {
    const local =
      localStorage.getItem(
        `regionGeometry:${regionId}`
      );

    if (!local) {
      return null;
    }

    return JSON.parse(
      local
    ) as GeoJsonObject;
  } catch {
    return null;
  }
};

// ============================================================
// NORMALIZE GEOMETRY
// ============================================================

const normalizeGeometry = (
  geometry: GeoJsonObject
): FeatureCollection => {
  if (
    geometry.type ===
    "FeatureCollection"
  ) {
    const collection =
      geometry as FeatureCollection;

    return {
      ...collection,

      features:
        collection.features.map(
          (
            feature,
            index
          ) => ({
            ...feature,

            properties: {
              ...(feature.properties ??
                {}),

              __ui_field_index:
                index,
            },
          })
        ),
    };
  }

  if (
    geometry.type ===
    "Feature"
  ) {
    const feature =
      geometry as Feature;

    return {
      type:
        "FeatureCollection",

      features: [
        {
          ...feature,

          properties: {
            ...(feature.properties ??
              {}),

            __ui_field_index:
              0,
          },
        },
      ],
    };
  }

  return {
    type:
      "FeatureCollection",

    features: [
      {
        type:
          "Feature",

        properties: {
          __ui_field_index:
            0,
        },

        geometry:
          geometry as Geometry,
      },
    ],
  };
};

// ============================================================
// FIT MAP
// ============================================================

function FitMap({
  geometry,
}: {
  geometry: GeoJsonObject;
}) {
  const map =
    useMap();

  useEffect(() => {
    try {
      const bounds =
        L.geoJSON(
          geometry as any
        ).getBounds();

      if (
        bounds.isValid()
      ) {
        map.fitBounds(
          bounds,
          {
            padding: [
              20,
              20,
            ],
          }
        );
      }
    } catch (
      mapError
    ) {
      console.error(
        mapError
      );
    }
  }, [
    geometry,
    map,
  ]);

  return null;
}

// ============================================================
// COMPONENT
// ============================================================

export default function UploadCropDetails({
  onComplete,
}: UploadCropDetailsProps) {
  const [
    regions,
    setRegions,
  ] =
    useState<
      Region[]
    >([]);

  const [
    selectedRegionId,
    setSelectedRegionId,
  ] =
    useState("");

  const [
    pendingRegionName,
    setPendingRegionName,
  ] =
    useState("");

  const [
    rows,
    setRows,
  ] =
    useState<
      ExcelRow[]
    >([]);

  const [
    mappings,
    setMappings,
  ] =
    useState<
      Record<
        string,
        SavedMapping
      >
    >({});

  const [
    fileName,
    setFileName,
  ] =
    useState("");

  const [
    fileContent,
    setFileContent,
  ] =
    useState<
      string | null
    >(null);

  const [
    uploadedToTemp,
    setUploadedToTemp,
  ] =
    useState(false);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    uploading,
    setUploading,
  ] =
    useState(false);

  const [
    savingMapping,
    setSavingMapping,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState("");

  const [
    success,
    setSuccess,
  ] =
    useState("");

  const [
    mappingRow,
    setMappingRow,
  ] =
    useState<
      ExcelRow | null
    >(null);

  const [
    selectedField,
    setSelectedField,
  ] =
    useState<
      SelectedField | null
    >(null);

  const [
    filter,
    setFilter,
  ] =
    useState<
      | "all"
      | "pending"
      | "mapped"
    >("all");

  const [
    page,
    setPage,
  ] =
    useState(0);

  const [
    rowsPerPage,
    setRowsPerPage,
  ] =
    useState(20);

  // ============================================================
  // LOAD REGIONS
  // ============================================================

  useEffect(() => {
    const loadRegions =
      async () => {
        setLoading(
          true
        );

        const pending =
          readPendingRegion();

        let nextRegions:
          Region[] = [];

        try {
          const response =
            await getRegions();

          nextRegions =
            getRegionList(
              response
            );
        } catch (
          loadError:
            unknown
        ) {
          if (!pending) {
            setError(
              loadError instanceof
                Error
                ? loadError.message
                : "Failed to load regions."
            );
          }
        }

        // Newly-created region auto select

        if (pending) {
          setPendingRegionName(
            pending.regionName
          );

          const exists =
            nextRegions.some(
              (region) =>
                getRegionId(
                  region
                ) ===
                pending.regionId
            );

          if (!exists) {
            nextRegions = [
              ...nextRegions,

              {
                region_id:
                  pending.regionId,

                name:
                  pending.regionName,
              },
            ];
          }

          setSelectedRegionId(
            pending.regionId
          );
        } else if (
          nextRegions.length >
          0
        ) {
          setSelectedRegionId(
            getRegionId(
              nextRegions[0]
            )
          );
        }

        setRegions(
          nextRegions
        );

        setLoading(
          false
        );
      };

    void loadRegions();
  }, []);

  // ============================================================
  // RESTORE PREVIOUS MAPPING PROGRESS
  // ============================================================

  useEffect(() => {
    if (
      !selectedRegionId
    ) {
      return;
    }

    const session =
      loadSession(
        selectedRegionId
      );

    if (!session) {
      setRows([]);
      setMappings({});
      setFileName("");
      setFileContent(
        null
      );
      setUploadedToTemp(
        false
      );
      setSuccess("");
      setError("");
      setPage(0);

      return;
    }

    setRows(
      (
        session.rows ?? []
      ).map(
        (
          row,
          index
        ) => {
          const normalized =
            makeExcelRow(
              row.raw,
              index
            );

          return {
            ...normalized,
            ...row,

            expectedHarvestDate:
              row.expectedHarvestDate ??
              normalized.expectedHarvestDate,

            expectedYield:
              row.expectedYield ??
              normalized.expectedYield,
          };
        }
      )
    );

    setMappings(
      session.mappings ??
        {}
    );

    setFileName(
      session.fileName ??
        ""
    );

    setFileContent(
      null
    );

    setUploadedToTemp(
      Boolean(
        session.uploadedToTemp
      )
    );

    setSuccess(
      session.completed
        ? "This region mapping was already completed."
        : "Previous mapping progress restored. Continue from the pending rows."
    );

    setError("");
    setPage(0);
  }, [
    selectedRegionId,
  ]);

  // ============================================================
  // CURRENT REGION
  // ============================================================

  const currentRegion =
    useMemo(
      () =>
        regions.find(
          (region) =>
            getRegionId(
              region
            ) ===
            selectedRegionId
        ) ??
        null,

      [
        regions,
        selectedRegionId,
      ]
    );

  const regionName =
    currentRegion
      ? valueFor(
          currentRegion,
          "name",
          "region_name"
        )
      : pendingRegionName ||
        "-";

  // ============================================================
  // GEOMETRY
  // ============================================================

  const geometry =
    useMemo(() => {
      if (
        !selectedRegionId
      ) {
        return null;
      }

      const source =
        getRegionGeometry(
          currentRegion,
          selectedRegionId
        );

      if (!source) {
        return null;
      }

      return normalizeGeometry(
        source
      );
    }, [
      currentRegion,
      selectedRegionId,
    ]);

  // ============================================================
  // COUNTS
  // ============================================================

  const mappedCount =
    Object.keys(
      mappings
    ).length;

  const pendingCount =
    Math.max(
      0,
      rows.length -
        mappedCount
    );

  // ============================================================
  // SAVE SESSION
  // ============================================================

  const persistSession = (
    nextRows:
      ExcelRow[] =
      rows,

    nextMappings:
      Record<
        string,
        SavedMapping
      > =
      mappings,

    nextUploaded:
      boolean =
      uploadedToTemp,

    completed = false,

    nextFileName =
      fileName
  ) => {
    if (
      !selectedRegionId
    ) {
      return;
    }

    saveSession({
      regionId:
        selectedRegionId,

      regionName,

      fileName:
        nextFileName,

      uploadedToTemp:
        nextUploaded,

      rows:
        nextRows,

      mappings:
        nextMappings,

      completed,
    });
  };

  // ============================================================
  // READ EXCEL
  // ============================================================

  const handleFileChange =
    async (
      event:
        ChangeEvent<HTMLInputElement>
    ) => {
      const selectedFile =
        event.target
          .files?.[0];

      if (!selectedFile) {
        return;
      }

      // Lambda supports only .xlsx

      if (
        !/\.xlsx$/i.test(
          selectedFile.name
        )
      ) {
        setError(
          "Please upload a valid Excel file (.xlsx)."
        );

        event.target.value =
          "";

        return;
      }

      try {
        setError("");
        setSuccess("");

        const buffer =
          await selectedFile.arrayBuffer();

        const workbook =
          XLSX.read(
            buffer,
            {
              type:
                "array",

              cellDates:
                true,
            }
          );

        // Lambda requires exact sheet name: crops

        if (
          !workbook.SheetNames.includes(
            "crops"
          )
        ) {
          throw new Error(
            "Excel file must contain a sheet named 'crops'."
          );
        }

        const sheet =
          workbook.Sheets[
            "crops"
          ];

        if (!sheet) {
          throw new Error(
            "Unable to read the 'crops' sheet."
          );
        }

        const rawRows =
          XLSX.utils.sheet_to_json<
            Record<
              string,
              unknown
            >
          >(sheet, {
            defval: "",
            raw: false,
          });

        if (
          rawRows.length ===
          0
        ) {
          throw new Error(
            "The crops sheet contains no crop rows."
          );
        }

        const parsedRows =
          rawRows.map(
            makeExcelRow
          );

        const base64 =
          await fileToBase64(
            selectedFile
          );

        setRows(
          parsedRows
        );

        // New Excel = fresh mapping session

        setMappings({});

        setFileName(
          selectedFile.name
        );

        setFileContent(
          base64
        );

        setUploadedToTemp(
          false
        );

        setPage(0);

        persistSession(
          parsedRows,
          {},
          false,
          false,
          selectedFile.name
        );

        setSuccess(
          `${parsedRows.length} crop row(s) loaded. Review the grid and upload the Excel.`
        );
      } catch (
        fileError:
          unknown
      ) {
        setRows([]);
        setMappings({});
        setFileName("");
        setFileContent(
          null
        );

        setUploadedToTemp(
          false
        );

        setError(
          fileError instanceof
            Error
            ? fileError.message
            : "Unable to process Excel file."
        );

        event.target.value =
          "";
      }
    };

  // ============================================================
  // UPLOAD EXCEL TO BACKEND
  // ============================================================

  const handleUploadExcel =
    async () => {
      if (
        !selectedRegionId
      ) {
        setError(
          "Please select a region."
        );

        return;
      }

      if (
        rows.length === 0
      ) {
        setError(
          "Please select an Excel file."
        );

        return;
      }

      if (
        !fileContent
      ) {
        setError(
          "Mapping progress was restored, but the original Excel file is not loaded. If it was already uploaded previously, continue mapping. Otherwise select the Excel again."
        );

        return;
      }

      try {
        setUploading(
          true
        );

        setError("");
        setSuccess("");

        const response =
          await uploadCropDetailsExcel(
            selectedRegionId,
            {
              region_id:
                selectedRegionId,

              region_name:
                regionName,

              crop_data_file:
                fileContent,

              crop_data_file_name:
                fileName,

              crop_data_content_type:
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            }
          );

        if (
          response &&
          typeof response ===
            "object" &&
          "success" in
            response &&
          response.success ===
            false
        ) {
          throw new Error(
            String(
              response.error ??
                response.message ??
                "Excel upload failed."
            )
          );
        }

        setUploadedToTemp(
          true
        );

        persistSession(
          rows,
          mappings,
          true
        );

        setSuccess(
          "Excel uploaded successfully. Start mapping crop rows to field polygons."
        );
      } catch (
        uploadError:
          unknown
      ) {
        setError(
          uploadError instanceof
            Error
            ? uploadError.message
            : typeof uploadError ===
                  "object" &&
                uploadError &&
                "message" in
                  uploadError
              ? String(
                  (
                    uploadError as {
                      message?: unknown;
                    }
                  ).message
                )
              : "Failed to upload Excel."
        );
      } finally {
        setUploading(
          false
        );
      }
    };

  // ============================================================
  // OPEN MAP
  // ============================================================

  const handleOpenMap = (
    row: ExcelRow
  ) => {
    setError("");

    if (
      !uploadedToTemp
    ) {
      setError(
        "First upload the Excel file before mapping."
      );

      return;
    }

    if (!geometry) {
      setError(
        "Field geometry is not available for this region."
      );

      return;
    }

    setMappingRow(
      row
    );

    setSelectedField(
      null
    );
  };

  // ============================================================
  // SELECT POLYGON
  // ============================================================

  const handleFeatureClick = (
    feature: Feature
  ) => {
    const properties =
      (feature.properties ??
        {}) as Record<
        string,
        unknown
      >;

    const index =
      Number(
        properties
          .__ui_field_index ??
          0
      );

    const backendKey =
      properties.field_id ??
      properties.fieldId ??
      properties.fieldid ??
      properties.id;

    const key =
      backendKey !==
        undefined &&
      backendKey !== null
        ? String(
            backendKey
          )
        : `TEMP-FIELD-${index + 1}`;

    const label =
      String(
        properties.field_name ??
          properties.name ??
          properties.field_id ??
          properties.fieldId ??
          `Field ${index + 1}`
      );

    setSelectedField({
      key,
      label,
      index,
      properties,
    });
  };

  // ============================================================
  // SAVE ONE ROW MAPPING
  // ============================================================

  const confirmMapping =
    async () => {
      if (
        !mappingRow ||
        !selectedField
      ) {
        return;
      }

      if (
        selectedField.key.startsWith(
          "TEMP-FIELD-"
        )
      ) {
        setError(
          "This polygon has no database field ID. Load field geometry with field_id from the backend before saving this mapping."
        );

        return;
      }

      // Prevent same field being used twice

      const duplicate =
        Object.entries(
          mappings
        ).find(
          ([
            rowId,
            mapping,
          ]) =>
            rowId !==
              mappingRow.id &&
            mapping.fieldKey ===
              selectedField.key
        );

      if (duplicate) {
        setError(
          `${selectedField.label} is already mapped to another Excel row.`
        );

        return;
      }

      try {
        setSavingMapping(
          true
        );

        setError("");

        const payload = {
          region_id:
            selectedRegionId,

          region_name:
            regionName,

          mapping_type:
            "crop_to_field",

          mappings: [
            {
              excel_row_number:
                mappingRow.excelRowNumber,

              excel_field_reference:
                mappingRow.fieldReference,

              field_id:
                selectedField.key,

              field_index:
                selectedField.index,

              field_properties:
                selectedField.properties,

              farmer_name:
                mappingRow.farmerName,

              crop_name:
                mappingRow.cropName,

              variety:
                mappingRow.variety,

              season:
                mappingRow.season,

              sowing_date:
                mappingRow.sowingDate,

              area:
                mappingRow.area,

              crop_data:
                mappingRow.raw,

              mapped:
                true,
            },
          ],
        };

        const response =
          await saveRegionMappings(
            selectedRegionId,
            payload
          );

        if (
          response &&
          typeof response ===
            "object" &&
          "success" in
            response &&
          response.success ===
            false
        ) {
          throw new Error(
            String(
              response.error ??
                response.message ??
                "Mapping failed."
            )
          );
        }

        const mapping:
          SavedMapping = {
          fieldKey:
            selectedField.key,

          fieldLabel:
            selectedField.label,

          fieldIndex:
            selectedField.index,

          mappedAt:
            new Date()
              .toISOString(),
        };

        const nextMappings = {
          ...mappings,

          [mappingRow.id]:
            mapping,
        };

        setMappings(
          nextMappings
        );

        // Save progress for resume

        persistSession(
          rows,
          nextMappings,
          true
        );

        setSuccess(
          `Excel row ${mappingRow.excelRowNumber} mapped to ${selectedField.label}.`
        );

        setMappingRow(
          null
        );

        setSelectedField(
          null
        );
      } catch (
        mappingError:
          unknown
      ) {
        setError(
          mappingError instanceof
            Error
            ? mappingError.message
            : typeof mappingError ===
                  "object" &&
                mappingError &&
                "message" in
                  mappingError
              ? String(
                  (
                    mappingError as {
                      message?: unknown;
                    }
                  ).message
                )
              : "Failed to save field mapping."
        );
      } finally {
        setSavingMapping(
          false
        );
      }
    };

  // ============================================================
  // FILTER
  // ============================================================

  const filteredRows =
    rows.filter(
      (row) => {
        const mapped =
          Boolean(
            mappings[
              row.id
            ]
          );

        if (
          filter ===
          "mapped"
        ) {
          return mapped;
        }

        if (
          filter ===
          "pending"
        ) {
          return !mapped;
        }

        return true;
      }
    );

  const visibleRows =
    filteredRows.slice(
      page *
        rowsPerPage,

      page *
          rowsPerPage +
        rowsPerPage
    );

  // ============================================================
  // COMPLETE
  // ============================================================

  const handleComplete =
    () => {
      if (
        rows.length ===
        0
      ) {
        setError(
          "No crop rows are available."
        );

        return;
      }

      if (
        mappedCount !==
        rows.length
      ) {
        setError(
          `${pendingCount} row(s) are still pending mapping.`
        );

        setFilter(
          "pending"
        );

        setPage(0);

        return;
      }

      persistSession(
        rows,
        mappings,
        true,
        true
      );

      localStorage.removeItem(
        "pendingCropRegion"
      );

      localStorage.setItem(
        "lastCompletedRegionName",
        regionName
      );

      onComplete(
        regionName
      );
    };

  // ============================================================
  // LOADING
  // ============================================================

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

  // ============================================================
  // UI
  // ============================================================

  return (
    <Box>
      <Paper
        sx={{
          p: 3,
          borderRadius: 3,
        }}
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
          Stage 2: upload Excel → preview required
          columns → map every crop row to the
          correct field.
        </Typography>

        {error && (
          <Alert
            severity="error"
            sx={{
              mb: 2,
            }}
          >
            {error}
          </Alert>
        )}

        {success && (
          <Alert
            severity="success"
            sx={{
              mb: 2,
            }}
          >
            {success}
          </Alert>
        )}

        {/* REGION */}

        <FormControl
          fullWidth
          sx={{
            mb: 2,
          }}
        >
          <InputLabel>
            Region
          </InputLabel>

          <Select
            value={
              selectedRegionId
            }
            label="Region"
            onChange={(
              event
            ) => {
              setSelectedRegionId(
                String(
                  event.target
                    .value
                )
              );

              setFileContent(
                null
              );
            }}
          >
            {regions.map(
              (region) => {
                const id =
                  getRegionId(
                    region
                  );

                return (
                  <MenuItem
                    key={id}
                    value={id}
                  >
                    {id} —{" "}
                    {valueFor(
                      region,
                      "name",
                      "region_name"
                    )}
                  </MenuItem>
                );
              }
            )}
          </Select>
        </FormControl>

        {/* PROGRESS */}

        <Box
          display="flex"
          gap={1}
          flexWrap="wrap"
          mb={2}
        >
          <Chip
            label={`Total: ${rows.length}`}
          />

          <Chip
            color="success"
            label={`Mapped: ${mappedCount}`}
          />

          <Chip
            color={
              pendingCount >
              0
                ? "warning"
                : "success"
            }
            label={`Pending: ${pendingCount}`}
          />

          <Chip
            color={
              uploadedToTemp
                ? "success"
                : "default"
            }
            label={
              uploadedToTemp
                ? "Excel staged"
                : "Excel not staged"
            }
          />
        </Box>

        {/* EXCEL */}

        <Button
          component="label"
          variant="outlined"
          fullWidth
          sx={{
            mb: 2,
          }}
        >
          Upload Excel Format File

          <input
            hidden
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={
              handleFileChange
            }
          />
        </Button>

        {fileName && (
          <Typography
            variant="body2"
            mb={2}
          >
            Selected file:{" "}
            <strong>
              {fileName}
            </strong>
          </Typography>
        )}

        {/* SEND TO TEMP TABLE */}

        <Button
          variant="contained"
          fullWidth
          disabled={
            uploading ||
            rows.length ===
              0 ||
            uploadedToTemp
          }
          onClick={() =>
            void handleUploadExcel()
          }
          sx={{
            mb: 3,
          }}
        >
          {uploading
            ? "Uploading..."
            : uploadedToTemp
              ? "Excel Uploaded"
              : "Upload Excel"}
        </Button>

        {/* GRID */}

        {rows.length >
          0 && (
          <>
            <Box
              display="flex"
              alignItems="center"
              justifyContent="space-between"
              flexWrap="wrap"
              gap={2}
              mb={2}
            >
              <Typography
                variant="h6"
                fontWeight="bold"
              >
                Excel Preview
              </Typography>

              <FormControl
                size="small"
                sx={{
                  minWidth: 160,
                }}
              >
                <InputLabel>
                  Show
                </InputLabel>

                <Select
                  value={
                    filter
                  }
                  label="Show"
                  onChange={(
                    event
                  ) => {
                    setFilter(
                      event.target
                        .value as
                        | "all"
                        | "pending"
                        | "mapped"
                    );

                    setPage(
                      0
                    );
                  }}
                >
                  <MenuItem value="all">
                    All Rows
                  </MenuItem>

                  <MenuItem value="pending">
                    Pending Only
                  </MenuItem>

                  <MenuItem value="mapped">
                    Mapped Only
                  </MenuItem>
                </Select>
              </FormControl>
            </Box>

            <TableContainer
              sx={{
                border:
                  "1px solid",

                borderColor:
                  "divider",

                borderRadius:
                  1,
              }}
            >
              <Table
                size="small"
              >
                <TableHead>
                  <TableRow>
                    <TableCell>
                      Field ID
                    </TableCell>

                    <TableCell>
                      Crop Type
                    </TableCell>

                    <TableCell>
                      Season
                    </TableCell>

                    <TableCell>
                      Farmer Name
                    </TableCell>

                    <TableCell>
                      Sowing Date
                    </TableCell>

                    <TableCell>
                      Expected Harvest Date
                    </TableCell>

                    <TableCell>
                      Expected Yield
                    </TableCell>

                    <TableCell>
                      Area
                    </TableCell>

                    <TableCell>
                      Map
                    </TableCell>
                  </TableRow>
                </TableHead>

                <TableBody>
                  {visibleRows.map(
                    (row) => {
                      const saved =
                        mappings[
                          row.id
                        ];

                      return (
                        <TableRow
                          key={
                            row.id
                          }
                          hover
                        >
                          <TableCell>
                            {saved
                              ? saved.fieldKey
                              : row.fieldReference}
                          </TableCell>

                          <TableCell>
                            {
                              row.cropName
                            }
                          </TableCell>

                          <TableCell>
                            {
                              row.season
                            }
                          </TableCell>

                          <TableCell>
                            {
                              row.farmerName
                            }
                          </TableCell>

                          <TableCell>
                            {
                              row.sowingDate
                            }
                          </TableCell>

                          <TableCell>
                            {
                              row.expectedHarvestDate
                            }
                          </TableCell>

                          <TableCell>
                            {
                              row.expectedYield
                            }
                          </TableCell>

                          <TableCell>
                            {
                              row.area
                            }
                          </TableCell>

                          <TableCell
                            align="right"
                          >
                            <Button
                              size="small"
                              startIcon={
                                <MapIcon />
                              }
                              disabled={
                                !uploadedToTemp
                              }
                              onClick={() =>
                                handleOpenMap(
                                  row
                                )
                              }
                            >
                              {saved
                                ? "Remap"
                                : "Map"}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    }
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            <TablePagination
              component="div"
              count={
                filteredRows.length
              }
              page={
                page
              }
              onPageChange={(
                _,
                nextPage
              ) =>
                setPage(
                  nextPage
                )
              }
              rowsPerPage={
                rowsPerPage
              }
              onRowsPerPageChange={(
                event
              ) => {
                setRowsPerPage(
                  Number(
                    event.target
                      .value
                  )
                );

                setPage(
                  0
                );
              }}
              rowsPerPageOptions={[
                10,
                20,
                50,
                100,
              ]}
            />

            <Box
              display="flex"
              justifyContent="flex-end"
              mt={3}
            >
              <Button
                variant="contained"
                color="success"
                disabled={
                  rows.length ===
                    0 ||
                  mappedCount !==
                    rows.length
                }
                onClick={
                  handleComplete
                }
              >
                Complete Mapping & View Region
              </Button>
            </Box>
          </>
        )}
      </Paper>

      {/* ====================================================== */}
      {/* MAP POPUP */}
      {/* ====================================================== */}

      <Dialog
        open={
          Boolean(
            mappingRow
          )
        }
        fullWidth
        maxWidth="lg"
        disableEscapeKeyDown
      >
        <DialogTitle
          sx={{
            pr: 7,
          }}
        >
          <IconButton
            aria-label="Close map"
            disabled={
              savingMapping
            }
            onClick={() => {
              setMappingRow(
                null
              );

              setSelectedField(
                null
              );
            }}
            sx={{
              position:
                "absolute",

              top: 8,
              right: 8,
            }}
          >
            ×
          </IconButton>

          Map Excel Row{" "}
          {
            mappingRow
              ?.excelRowNumber
          }{" "}
          to Field
        </DialogTitle>

        <DialogContent
          dividers
        >
          {error && (
            <Alert
              severity="error"
              sx={{
                mb: 2,
              }}
            >
              {error}
            </Alert>
          )}

          {mappingRow && (
            <Alert
              severity="info"
              sx={{
                mb: 2,
              }}
            >
              Crop:{" "}

              <strong>
                {
                  mappingRow
                    .cropName
                }
              </strong>

              {" | "}

              Farmer:{" "}

              <strong>
                {
                  mappingRow
                    .farmerName
                }
              </strong>

              {" | "}

              Excel Field Ref:{" "}

              <strong>
                {
                  mappingRow
                    .fieldReference
                }
              </strong>
            </Alert>
          )}

          {geometry ? (
            <>
              <Typography
                mb={2}
                variant="body2"
              >
                Click the correct field polygon.
              </Typography>

              <MapContainer
                center={[
                  20.5937,
                  78.9629,
                ]}
                zoom={5}
                style={{
                  width:
                    "100%",

                  height:
                    "500px",
                }}
              >
                <TileLayer
                  attribution="&copy; OpenStreetMap contributors"
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                <GeoJSON
                  data={
                    geometry
                  }
                  style={(
                    feature:
                      any
                  ) => {
                    const index =
                      Number(
                        feature
                          ?.properties
                          ?.__ui_field_index ??
                          -1
                      );

                    const selected =
                      selectedField
                        ?.index ===
                      index;

                    return {
                      color:
                        selected
                          ? "#d32f2f"
                          : "#1976d2",

                      weight:
                        selected
                          ? 4
                          : 2,

                      fillOpacity:
                        selected
                          ? 0.45
                          : 0.2,
                    };
                  }}
                  onEachFeature={(
                    feature:
                      any,
                    layer:
                      L.Layer
                  ) => {
                    layer.on(
                      "click",
                      () =>
                        handleFeatureClick(
                          feature
                        )
                    );
                  }}
                />

                <FitMap
                  geometry={
                    geometry
                  }
                />
              </MapContainer>

              <Box
                mt={2}
                p={2}
                sx={{
                  backgroundColor:
                    "action.hover",

                  borderRadius:
                    1,
                }}
              >
                <Typography
                  fontWeight="bold"
                >
                  Selected Field
                </Typography>

                {selectedField ? (
                  <>
                    <Typography>
                      {
                        selectedField
                          .label
                      }
                    </Typography>

                    <Typography
                      variant="caption"
                      color="text.secondary"
                    >
                      Field key:{" "}
                      {
                        selectedField
                          .key
                      }
                    </Typography>
                  </>
                ) : (
                  <Typography
                    color="text.secondary"
                    variant="body2"
                  >
                    No field selected.
                  </Typography>
                )}
              </Box>
            </>
          ) : (
            <Alert
              severity="warning"
            >
              Field geometry is unavailable for this region.
            </Alert>
          )}
        </DialogContent>

        <DialogActions>
          <Button
            disabled={
              savingMapping
            }
            onClick={() => {
              setMappingRow(
                null
              );

              setSelectedField(
                null
              );
            }}
          >
            Close
          </Button>

          <Button
            variant="contained"
            disabled={
              !selectedField ||
              savingMapping
            }
            onClick={() =>
              void confirmMapping()
            }
          >
            {savingMapping
              ? "SAVING..."
              : "CONFIRM MAP"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}