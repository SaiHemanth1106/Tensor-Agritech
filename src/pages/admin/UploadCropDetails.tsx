import {
  useEffect,
  useMemo,
  useState,
} from "react";

import type {
  ChangeEvent,
} from "react";

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
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
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
} from "geojson";

import * as XLSX from "xlsx";

import {
  saveRegionMappings,
  uploadCropDetailsExcel,
} from "../../services/api";

// ============================================================
// TYPES
// ============================================================

interface UploadCropDetailsProps {
  onComplete: (
    regionName: string
  ) => void;
}

interface ExcelRow {
  id: string;

  excelRowNumber: number;

  cropId?:
    | number
    | string;

  fieldReference: string;

  farmerName: string;

  cropName: string;

  variety: string;

  season: string;

  sowingDate: string;

  expectedHarvestDate: string;

  expectedYield: string;

  area: string;

  mappingStatus:
    | "pending"
    | "mapped";

  raw: Record<
    string,
    unknown
  >;
}

interface SelectedField {
  key: string;

  label: string;

  index: number;

  tempFieldId?: string;

  geometryReferenceId?:
    | string
    | number;

  properties: Record<
    string,
    unknown
  >;
}

interface MappingInfo {
  fieldKey: string;

  fieldLabel: string;

  fieldIndex: number;

  tempFieldId?: string;

  mappedAt: string;
}

interface MappingSession {
  regionId: string;

  regionName: string;

  fileName: string;

  uploaded: boolean;

  completed: boolean;

  rows: ExcelRow[];

  mappings: Record<
    string,
    MappingInfo
  >;
}

// ============================================================
// HELPERS
// ============================================================

const normalizeKey = (
  value: string
) =>
  value
    .trim()
    .toLowerCase()
    .replace(
      /[^a-z0-9]+/g,
      "_"
    );

const normalizeRow = (
  row: Record<
    string,
    unknown
  >
) => {
  const output:
    Record<
      string,
      unknown
    > = {};

  Object.entries(
    row
  ).forEach(
    ([
      key,
      value,
    ]) => {
      output[
        normalizeKey(
          key
        )
      ] = value;
    }
  );

  return output;
};

const getString = (
  row: Record<
    string,
    unknown
  >,
  ...keys: string[]
) => {
  for (
    const key of keys
  ) {
    const value =
      row[
        normalizeKey(
          key
        )
      ];

    if (
      value !==
        undefined &&
      value !== null &&
      String(
        value
      ).trim() !== ""
    ) {
      return String(
        value
      ).trim();
    }
  }

  return "";
};

const fileToBase64 = (
  file: File
): Promise<string> =>
  new Promise(
    (resolve, reject) => {
      const reader =
        new FileReader();

      reader.onload =
        () => {
          if (
            typeof reader.result !==
            "string"
          ) {
            reject(
              new Error(
                "Unable to read Excel."
              )
            );

            return;
          }

          resolve(
            reader.result.includes(
              ","
            )
              ? reader.result.split(
                  ","
                )[1]
              : reader.result
          );
        };

      reader.onerror =
        () =>
          reject(
            new Error(
              "Unable to read Excel."
            )
          );

      reader.readAsDataURL(
        file
      );
    }
  );

const findBackendRows = (
  response: any
): any[] => {
  const candidates = [
    response?.rows,

    response?.items,

    response?.crops?.rows,

    response?.crops?.items,

    response?.temporary_crops,

    response?.data?.rows,

    response?.data?.items,

    response?.data
      ?.temporary_crops,
  ];

  return (
    candidates.find(
      Array.isArray
    ) ?? []
  );
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
    } catch (error) {
      console.error(
        "Unable to fit map:",
        error
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
    regionId,
    setRegionId,
  ] = useState("");

  const [
    regionName,
    setRegionName,
  ] = useState("");

  const [
    rows,
    setRows,
  ] = useState<
    ExcelRow[]
  >([]);

  const [
    mappings,
    setMappings,
  ] = useState<
    Record<
      string,
      MappingInfo
    >
  >({});

  const [
    fileName,
    setFileName,
  ] = useState("");

  const [
    fileContent,
    setFileContent,
  ] = useState("");

  const [
    uploaded,
    setUploaded,
  ] = useState(false);

  const [
    uploading,
    setUploading,
  ] = useState(false);

  const [
    mapping,
    setMapping,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    success,
    setSuccess,
  ] = useState("");

  const [
    currentRow,
    setCurrentRow,
  ] = useState<
    ExcelRow | null
  >(null);

  const [
    selectedField,
    setSelectedField,
  ] = useState<
    SelectedField | null
  >(null);

  // ==========================================================
  // CURRENT REGION
  //
  // IMPORTANT:
  // NO getRegions()
  // NO automatic region API fetch
  //
  // Region comes only from:
  // pendingCropRegion
  // ==========================================================

  useEffect(() => {
    const pending =
      localStorage.getItem(
        "pendingCropRegion"
      );

    if (!pending) {
      setError(
        "No region selected. Create fields first."
      );

      return;
    }

    try {
      const parsed =
        JSON.parse(
          pending
        );

      const storedRegionId =
        String(
          parsed.regionId ??
            ""
        );

      const storedRegionName =
        String(
          parsed.regionName ??
            ""
        );

      if (
        !storedRegionId
      ) {
        throw new Error(
          "Region ID missing."
        );
      }

      setRegionId(
        storedRegionId
      );

      setRegionName(
        storedRegionName
      );

      // ==========================================
      // RESTORE PARTIAL MAPPING SESSION
      // ==========================================

      const savedSession =
        localStorage.getItem(
          `cropMappingSession:${storedRegionId}`
        );

      if (
        savedSession
      ) {
        try {
          const session =
            JSON.parse(
              savedSession
            ) as MappingSession;

          if (
            session.regionId ===
            storedRegionId
          ) {
            setRows(
              session.rows ??
                []
            );

            setMappings(
              session.mappings ??
                {}
            );

            setFileName(
              session.fileName ??
                ""
            );

            setUploaded(
              Boolean(
                session.uploaded
              )
            );
          }
        } catch (
          sessionError
        ) {
          console.warn(
            "Unable to restore mapping session:",
            sessionError
          );
        }
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to read selected region."
      );
    }
  }, []);

  // ==========================================================
  // SAVE SESSION
  //
  // Allows 100+ row mapping to continue later.
  // ==========================================================

  const persistSession = (
    nextRows: ExcelRow[],
    nextMappings: Record<
      string,
      MappingInfo
    >,
    nextUploaded = uploaded,
    completed = false,
    nextFileName = fileName
  ) => {
    if (!regionId) {
      return;
    }

    const session:
      MappingSession = {
      regionId,

      regionName,

      fileName:
        nextFileName,

      uploaded:
        nextUploaded,

      completed,

      rows:
        nextRows,

      mappings:
        nextMappings,
    };

    localStorage.setItem(
      `cropMappingSession:${regionId}`,
      JSON.stringify(
        session
      )
    );
  };

  // ==========================================================
  // FIELD GEOMETRY
  //
  // Comes from Create Fields.
  // ==========================================================

  const geometry =
    useMemo(() => {
      if (!regionId) {
        return null;
      }

      const stored =
        localStorage.getItem(
          `regionGeometry:${regionId}`
        );

      if (!stored) {
        return null;
      }

      try {
        return JSON.parse(
          stored
        ) as FeatureCollection;
      } catch {
        return null;
      }
    }, [
      regionId,
    ]);

  // ==========================================================
  // COUNTS
  // ==========================================================

  const mappedCount =
    rows.filter(
      (row) =>
        row.mappingStatus ===
        "mapped"
    ).length;

  const pendingCount =
    rows.length -
    mappedCount;

  // ==========================================================
  // SELECT EXCEL
  // ==========================================================

  const handleExcel =
    async (
      event:
        ChangeEvent<HTMLInputElement>
    ) => {
      const file =
        event.target
          .files?.[0];

      if (!file) {
        return;
      }

      const lower =
        file.name
          .toLowerCase();

      if (
        !lower.endsWith(
          ".xlsx"
        ) &&
        !lower.endsWith(
          ".xls"
        )
      ) {
        setError(
          "Only Excel files (.xlsx or .xls) are allowed."
        );

        event.target.value =
          "";

        return;
      }

      try {
        setError("");
        setSuccess("");

        const base64 =
          await fileToBase64(
            file
          );

        const buffer =
          await file.arrayBuffer();

        const workbook =
          XLSX.read(
            buffer,
            {
              type:
                "array",
            }
          );

        const sheetName =
          workbook
            .SheetNames[0];

        const worksheet =
          workbook.Sheets[
            sheetName
          ];

        const rawRows =
          XLSX.utils.sheet_to_json<
            Record<
              string,
              unknown
            >
          >(
            worksheet,
            {
              defval: "",
              raw: false,
            }
          );

        const parsedRows:
          ExcelRow[] =
          rawRows.map(
            (
              raw,
              index
            ) => {
              const data =
                normalizeRow(
                  raw
                );

              return {
                id:
                  `row-${index + 2}`,

                excelRowNumber:
                  index +
                  2,

                fieldReference:
                  getString(
                    data,
                    "field_reference",
                    "field_id",
                    "field",
                    "plot_id"
                  ),

                farmerName:
                  getString(
                    data,
                    "farmer_name",
                    "farmer"
                  ),

                cropName:
                  getString(
                    data,
                    "crop_name",
                    "crop",
                    "crop_type"
                  ),

                variety:
                  getString(
                    data,
                    "variety",
                    "crop_variety"
                  ),

                season:
                  getString(
                    data,
                    "season"
                  ),

                sowingDate:
                  getString(
                    data,
                    "sowing_date"
                  ),

                expectedHarvestDate:
                  getString(
                    data,
                    "expected_harvest_date",
                    "harvest_date"
                  ),

                expectedYield:
                  getString(
                    data,
                    "expected_yield",
                    "yield"
                  ),

                area:
                  getString(
                    data,
                    "area",
                    "crop_area",
                    "field_area"
                  ),

                mappingStatus:
                  "pending",

                raw:
                  data,
              };
            }
          );

        setRows(
          parsedRows
        );

        setMappings(
          {}
        );

        setFileName(
          file.name
        );

        setFileContent(
          base64
        );

        setUploaded(
          false
        );

        persistSession(
          parsedRows,
          {},
          false,
          false,
          file.name
        );

        setSuccess(
          `${parsedRows.length} crop row(s) loaded. Review the grid and upload the Excel.`
        );
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to read Excel."
        );
      }
    };

  // ==========================================================
  // CANCEL EXCEL
  //
  // IMPORTANT:
  // Clears only Excel/mapping stage.
  // Does NOT remove Region.
  // Does NOT remove Create Fields geometry.
  // ==========================================================

  const handleCancelExcel =
    () => {
      setRows(
        []
      );

      setMappings(
        {}
      );

      setFileName(
        ""
      );

      setFileContent(
        ""
      );

      setUploaded(
        false
      );

      setCurrentRow(
        null
      );

      setSelectedField(
        null
      );

      setError(
        ""
      );

      setSuccess(
        "Excel selection cancelled. Region and fields were not changed."
      );

      if (
        regionId
      ) {
        localStorage.removeItem(
          `cropMappingSession:${regionId}`
        );
      }
    };

  // ==========================================================
  // UPLOAD EXCEL
  // ==========================================================

  const handleUploadExcel =
    async () => {
      if (
        !regionId
      ) {
        setError(
          "Region ID is missing."
        );

        return;
      }

      if (
        rows.length ===
        0
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
          "Please select the Excel file before uploading."
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
            regionId,
            {
              region_id:
                Number(
                  regionId
                ),

              file_name:
                fileName,

              file_content:
                fileContent,

              // Old helper compatibility
              crop_data_file_name:
                fileName,

              crop_data_file:
                fileContent,
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
                response.details ??
                response.message ??
                "Excel upload failed."
            )
          );
        }

        // ==========================================
        // If backend returns temporary crop IDs,
        // preserve them.
        //
        // Old mapping does NOT require cropId,
        // but keeping it is useful.
        // ==========================================

        const backendRows =
          findBackendRows(
            response
          );

        const nextRows =
          rows.map(
            (
              row,
              index
            ) => {
              const backend =
                backendRows[
                  index
                ];

              const cropId =
                backend?.crop_id ??
                backend
                  ?.temporary_crop_id ??
                backend
                  ?.temp_crop_id ??
                backend?.id;

              return {
                ...row,

                cropId:
                  cropId ??
                  row.cropId,
              };
            }
          );

        setRows(
          nextRows
        );

        setUploaded(
          true
        );

        persistSession(
          nextRows,
          mappings,
          true,
          false,
          fileName
        );

        setSuccess(
          "Excel uploaded successfully. Start mapping crop rows to field polygons."
        );
      } catch (err) {
        console.error(
          "Excel upload error:",
          err
        );

        setError(
          err instanceof Error
            ? err.message
            : "Excel upload failed."
        );
      } finally {
        setUploading(
          false
        );
      }
    };

  // ==========================================================
  // OPEN MAP
  // ==========================================================

  const openMap = (
    row: ExcelRow
  ) => {
    setError("");

    if (
      row.mappingStatus ===
      "mapped"
    ) {
      return;
    }

    if (!uploaded) {
      setError(
        "Upload Excel first."
      );

      return;
    }

    if (!geometry) {
      setError(
        "Field geometry is not available for this region."
      );

      return;
    }

    setCurrentRow(
      row
    );

    setSelectedField(
      null
    );
  };

  // ==========================================================
  // SELECT FIELD POLYGON
  //
  // Supports BOTH:
  //
  // Old geometry:
  // field_id
  //
  // New Create Fields geometry:
  // temp_field_id
  // geometry_reference_id
  // ==========================================================

  const selectFeature = (
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
          .field_index ??
          properties
            .__ui_field_index ??
          0
      );

    const fieldId =
      properties.field_id ??
      properties.fieldId ??
      properties.fieldid;

    const tempFieldId =
      properties
        .temp_field_id;

    const geometryReferenceId =
      properties
        .geometry_reference_id;

    const backendKey =
      fieldId ??
      tempFieldId ??
      geometryReferenceId ??
      properties.id ??
      properties.name;

    if (
      backendKey ===
        undefined ||
      backendKey ===
        null ||
      String(
        backendKey
      ).trim() === ""
    ) {
      setError(
        "Selected polygon does not contain a valid field reference."
      );

      return;
    }

    const key =
      String(
        backendKey
      );

    const label =
      String(
        properties.field_name ??
          properties.name ??
          properties.field_id ??
          properties.fieldId ??
          `Field ${index + 1}`
      );

    // ==========================================
    // SAME FIELD CANNOT BE USED TWICE
    // ==========================================

    const duplicate =
      Object.entries(
        mappings
      ).find(
        ([
          rowId,
          item,
        ]) =>
          rowId !==
            currentRow?.id &&
          item.fieldKey ===
            key
      );

    if (
      duplicate
    ) {
      setError(
        `${label} is already mapped to another Excel row.`
      );

      return;
    }

    setSelectedField({
      key,

      label,

      index,

      tempFieldId:
        tempFieldId !==
          undefined &&
        tempFieldId !==
          null
          ? String(
              tempFieldId
            )
          : undefined,

      geometryReferenceId:
        geometryReferenceId !==
          undefined &&
        geometryReferenceId !==
          null
          ? String(
              geometryReferenceId
            )
          : undefined,

      properties,
    });

    setError(
      ""
    );
  };

  // ==========================================================
  // CONFIRM MAPPING
  //
  // IMPORTANT:
  //
  // OLD WORKING MECHANISM:
  // saveRegionMappings()
  //
  // NOT:
  // mapCropToField()
  //
  // Therefore frontend will NOT call:
  // /s1/region/crops/map
  // ==========================================================

  const confirmMap =
    async () => {
      if (
        !currentRow ||
        !selectedField
      ) {
        return;
      }

      try {
        setMapping(
          true
        );

        setError("");
        setSuccess("");

        // ==========================================
        // OLD WORKING PAYLOAD
        // +
        // NEW FIELD REFERENCES INCLUDED
        // ==========================================

        const payload = {
          region_id:
            regionId,

          region_name:
            regionName,

          mapping_type:
            "crop_to_field",

          mappings: [
            {
              excel_row_number:
                currentRow
                  .excelRowNumber,

              excel_field_reference:
                currentRow
                  .fieldReference ||
                String(
                  currentRow
                    .excelRowNumber
                ),

              // Old mapping field reference
              field_id:
                selectedField
                  .key,

              // New Create Fields values
              temp_field_id:
                selectedField
                  .tempFieldId,

              geometry_reference_id:
                selectedField
                  .geometryReferenceId,

              field_index:
                selectedField
                  .index,

              field_properties:
                selectedField
                  .properties,

              crop_id:
                currentRow
                  .cropId,

              farmer_name:
                currentRow
                  .farmerName,

              crop_name:
                currentRow
                  .cropName,

              variety:
                currentRow
                  .variety,

              season:
                currentRow
                  .season,

              sowing_date:
                currentRow
                  .sowingDate,

              expected_harvest_date:
                currentRow
                  .expectedHarvestDate,

              expected_yield:
                currentRow
                  .expectedYield,

              area:
                currentRow
                  .area,

              crop_data:
                currentRow.raw,

              mapped:
                true,
            },
          ],
        };

        // ==========================================
        // OLD WORKING API HELPER
        // ==========================================

        const response =
          await saveRegionMappings(
            regionId,
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
                response.details ??
                response.message ??
                "Mapping failed."
            )
          );
        }

        // ==========================================
        // ONLY AFTER SAVE SUCCESS
        // PENDING -> MAPPED
        // ==========================================

        const nextRows =
          rows.map(
            (row) =>
              row.id ===
              currentRow.id
                ? {
                    ...row,

                    mappingStatus:
                      "mapped" as const,
                  }
                : row
          );

        const nextMappings:
          Record<
            string,
            MappingInfo
          > = {
          ...mappings,

          [currentRow.id]:
            {
              fieldKey:
                selectedField
                  .key,

              fieldLabel:
                selectedField
                  .label,

              fieldIndex:
                selectedField
                  .index,

              tempFieldId:
                selectedField
                  .tempFieldId,

              mappedAt:
                new Date()
                  .toISOString(),
            },
        };

        setRows(
          nextRows
        );

        setMappings(
          nextMappings
        );

        persistSession(
          nextRows,
          nextMappings,
          true,
          false,
          fileName
        );

        setSuccess(
          `Excel row ${currentRow.excelRowNumber} mapped to ${selectedField.label}.`
        );

        setCurrentRow(
          null
        );

        setSelectedField(
          null
        );
      } catch (err) {
        console.error(
          "Mapping error:",
          err
        );

        setError(
          err instanceof Error
            ? err.message
            : "Failed to save field mapping."
        );
      } finally {
        setMapping(
          false
        );
      }
    };

  // ==========================================================
  // COMPLETE MAPPING
  // ==========================================================

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
        pendingCount >
        0
      ) {
        setError(
          `${pendingCount} row(s) are still pending mapping.`
        );

        return;
      }

      persistSession(
        rows,
        mappings,
        true,
        true,
        fileName
      );

      localStorage.setItem(
        "lastCompletedRegionName",
        regionName
      );

      localStorage.removeItem(
        "pendingCropRegion"
      );

      onComplete(
        regionName
      );
    };

  // ==========================================================
  // UI
  // ==========================================================

  return (
    <Box
      sx={{
        maxWidth: 1400,
        mx: "auto",
      }}
    >
      <Paper
        elevation={3}
        sx={{
          p: 3,
          borderRadius: 3,
        }}
      >
        <Typography
          variant="h5"
          fontWeight="bold"
          sx={{
            mb: 1,
          }}
        >
          🌾 Upload Crop Details
        </Typography>

        <Typography
          variant="body2"
          color="text.secondary"
          sx={{
            mb: 3,
          }}
        >
          Upload the crop Excel file and map each crop row to the correct field polygon.
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

        {/* ========================================
            REGION
        ======================================== */}

        <Paper
          variant="outlined"
          sx={{
            p: 2,
            mb: 3,
          }}
        >
          <Typography>
            <strong>
              Region:
            </strong>{" "}
            {regionName ||
              "-"}
          </Typography>

          <Typography>
            <strong>
              Region ID:
            </strong>{" "}
            {regionId ||
              "-"}
          </Typography>
        </Paper>

        {/* ========================================
            EXCEL ACTIONS
        ======================================== */}

        <Box
          sx={{
            display:
              "flex",

            flexWrap:
              "wrap",

            gap: 2,

            mb: 2,
          }}
        >
          <Button
            component="label"
            variant="outlined"
            disabled={
              uploading ||
              mapping
            }
          >
            SELECT EXCEL

            <input
              hidden
              type="file"
              accept=".xlsx,.xls"
              onChange={
                handleExcel
              }
            />
          </Button>

          <Button
            variant="contained"
            disabled={
              uploaded ||
              uploading ||
              mapping ||
              !fileContent ||
              rows.length ===
                0
            }
            onClick={
              handleUploadExcel
            }
          >
            {uploading ? (
              <>
                <CircularProgress
                  size={18}
                  color="inherit"
                  sx={{
                    mr: 1,
                  }}
                />

                UPLOADING...
              </>
            ) : (
              "UPLOAD EXCEL"
            )}
          </Button>

          <Button
            variant="outlined"
            color="error"
            disabled={
              uploading ||
              mapping ||
              rows.length ===
                0
            }
            onClick={
              handleCancelExcel
            }
          >
            CANCEL EXCEL
          </Button>
        </Box>

        {fileName && (
          <Typography
            variant="body2"
            sx={{
              mb: 2,
            }}
          >
            Selected Excel:{" "}
            <strong>
              {fileName}
            </strong>
          </Typography>
        )}

        {/* ========================================
            COUNTERS
        ======================================== */}

        {rows.length >
          0 && (
          <>
            <Box
              sx={{
                display:
                  "flex",

                flexWrap:
                  "wrap",

                gap: 1,

                mb: 2,
              }}
            >
              <Chip
                label={`Total: ${rows.length}`}
              />

              <Chip
                color="success"
                label={`Mapped: ${mappedCount}`}
              />

              <Chip
                color="warning"
                label={`Pending: ${pendingCount}`}
              />

              <Chip
                color={
                  uploaded
                    ? "success"
                    : "default"
                }
                label={
                  uploaded
                    ? "Excel Uploaded"
                    : "Excel Not Uploaded"
                }
              />
            </Box>

            {/* ====================================
                GRID
            ==================================== */}

            <TableContainer>
              <Table
                size="small"
              >
                <TableHead>
                  <TableRow>
                    <TableCell>
                      Row
                    </TableCell>

                    <TableCell>
                      Farmer
                    </TableCell>

                    <TableCell>
                      Crop
                    </TableCell>

                    <TableCell>
                      Variety
                    </TableCell>

                    <TableCell>
                      Season
                    </TableCell>

                    <TableCell>
                      Sowing Date
                    </TableCell>

                    <TableCell>
                      Harvest Date
                    </TableCell>

                    <TableCell>
                      Expected Yield
                    </TableCell>

                    <TableCell>
                      Area
                    </TableCell>

                    <TableCell>
                      Status
                    </TableCell>

                    <TableCell>
                      Map
                    </TableCell>
                  </TableRow>
                </TableHead>

                <TableBody>
                  {rows.map(
                    (row) => {
                      const mapped =
                        row.mappingStatus ===
                        "mapped";

                      return (
                        <TableRow
                          key={
                            row.id
                          }
                        >
                          <TableCell>
                            {
                              row.excelRowNumber
                            }
                          </TableCell>

                          <TableCell>
                            {row.farmerName ||
                              "-"}
                          </TableCell>

                          <TableCell>
                            {row.cropName ||
                              "-"}
                          </TableCell>

                          <TableCell>
                            {row.variety ||
                              "-"}
                          </TableCell>

                          <TableCell>
                            {row.season ||
                              "-"}
                          </TableCell>

                          <TableCell>
                            {row.sowingDate ||
                              "-"}
                          </TableCell>

                          <TableCell>
                            {row.expectedHarvestDate ||
                              "-"}
                          </TableCell>

                          <TableCell>
                            {row.expectedYield ||
                              "-"}
                          </TableCell>

                          <TableCell>
                            {row.area ||
                              "-"}
                          </TableCell>

                          <TableCell>
                            <Chip
                              size="small"
                              color={
                                mapped
                                  ? "success"
                                  : "warning"
                              }
                              label={
                                mapped
                                  ? "Mapped"
                                  : "Pending"
                              }
                            />
                          </TableCell>

                          <TableCell>
                            <Button
                              size="small"
                              variant={
                                mapped
                                  ? "outlined"
                                  : "contained"
                              }
                              startIcon={
                                <MapIcon />
                              }
                              disabled={
                                !uploaded ||
                                mapped ||
                                mapping
                              }
                              onClick={() =>
                                openMap(
                                  row
                                )
                              }
                            >
                              {mapped
                                ? "Mapped"
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

            {/* ====================================
                COMPLETE
            ==================================== */}

            <Box
              sx={{
                mt: 3,

                display:
                  "flex",

                justifyContent:
                  "flex-end",
              }}
            >
              <Button
                variant="contained"
                color="success"
                disabled={
                  rows.length ===
                    0 ||
                  pendingCount >
                    0 ||
                  mapping
                }
                onClick={
                  handleComplete
                }
              >
                COMPLETE MAPPING
              </Button>
            </Box>
          </>
        )}
      </Paper>

      {/* ==========================================
          MAP DIALOG
      ========================================== */}

      <Dialog
        open={
          Boolean(
            currentRow
          )
        }
        onClose={() => {
          if (!mapping) {
            setCurrentRow(
              null
            );

            setSelectedField(
              null
            );
          }
        }}
        fullWidth
        maxWidth="lg"
      >
        <DialogTitle>
          Map Crop Row{" "}
          {currentRow
            ?.excelRowNumber}
        </DialogTitle>

        <DialogContent>
          {currentRow && (
            <Paper
              variant="outlined"
              sx={{
                p: 2,
                mb: 2,
              }}
            >
              <Typography>
                <strong>
                  Farmer:
                </strong>{" "}
                {currentRow
                  .farmerName ||
                  "-"}
              </Typography>

              <Typography>
                <strong>
                  Crop:
                </strong>{" "}
                {currentRow
                  .cropName ||
                  "-"}
              </Typography>

              <Typography>
                <strong>
                  Season:
                </strong>{" "}
                {currentRow
                  .season ||
                  "-"}
              </Typography>

              <Typography>
                <strong>
                  Area:
                </strong>{" "}
                {currentRow
                  .area ||
                  "-"}
              </Typography>
            </Paper>
          )}

          {selectedField && (
            <Alert
              severity="success"
              sx={{
                mb: 2,
              }}
            >
              Selected:{" "}
              <strong>
                {
                  selectedField.label
                }
              </strong>
            </Alert>
          )}

          {geometry ? (
            <Box
              sx={{
                height: 500,
              }}
            >
              <MapContainer
                center={[
                  20.5937,
                  78.9629,
                ]}
                zoom={5}
                style={{
                  height:
                    "100%",

                  width:
                    "100%",
                }}
              >
                <TileLayer
                  attribution="&copy; OpenStreetMap contributors"
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                <GeoJSON
                  data={
                    geometry as GeoJsonObject
                  }
                  onEachFeature={(
                    feature,
                    layer
                  ) => {
                    layer.on(
                      "click",
                      () =>
                        selectFeature(
                          feature
                        )
                    );
                  }}
                />

                <FitMap
                  geometry={
                    geometry as GeoJsonObject
                  }
                />
              </MapContainer>
            </Box>
          ) : (
            <Alert
              severity="error"
            >
              Field geometry is not available for this region.
            </Alert>
          )}
        </DialogContent>

        <DialogActions>
          <Button
            onClick={() => {
              setCurrentRow(
                null
              );

              setSelectedField(
                null
              );
            }}
            disabled={
              mapping
            }
          >
            CLOSE
          </Button>

          <Button
            variant="contained"
            disabled={
              !selectedField ||
              mapping
            }
            onClick={
              confirmMap
            }
          >
            {mapping ? (
              <>
                <CircularProgress
                  size={18}
                  color="inherit"
                  sx={{
                    mr: 1,
                  }}
                />

                MAPPING...
              </>
            ) : (
              "CONFIRM MAP"
            )}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}