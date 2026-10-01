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
  FeatureCollection,
  GeoJsonObject,
} from "geojson";

import * as XLSX from "xlsx";

import {
  getRegions,
  uploadCropDetailsExcel,
} from "../../services/regionApi";

// ============================================================
// TYPES
// ============================================================

type Region =
  Record<string, any>;

interface UploadCropDetailsProps {
  onComplete?: (
    regionName: string
  ) => void;
}

interface CropRow {
  id: string;

  excelRowNumber:
    number;

  cropId?:
    string | number;

  fieldId:
    string;

  cropType:
    string;

  season:
    string;

  farmerName:
    string;

  sowingDate:
    string;

  expectedHarvestDate:
    string;

  expectedYield:
    string;

  area:
    string;

  mappingStatus:
    "Pending" | "Mapped";

  raw:
    Record<string, any>;
}

interface SelectedPolygon {
  fieldId:
    string;

  label:
    string;

  properties:
    Record<string, any>;
}

interface PendingRegion {
  regionId:
    string;

  regionName:
    string;

  organizationId?:
    string;

  country?:
    string;

  state?:
    string;
}

interface StoredSession {
  regionId:
    string;

  fileName:
    string;

  uploaded:
    boolean;

  rows:
    CropRow[];
}

// ============================================================
// REGION HELPERS
// ============================================================

const getRegionList = (
  response: any
): Region[] => {
  if (
    Array.isArray(
      response
    )
  ) {
    return response;
  }

  if (
    Array.isArray(
      response?.regions
    )
  ) {
    return response.regions;
  }

  if (
    Array.isArray(
      response?.data
    )
  ) {
    return response.data;
  }

  return [];
};

const getRegionId = (
  region: Region
) =>
  String(
    region?.region_id ??
      region?.id ??
      region?.regionId ??
      ""
  );

const getRegionName = (
  region: Region
) =>
  String(
    region?.name ??
      region?.region_name ??
      region?.regionName ??
      ""
  );

// ============================================================
// PENDING REGION
// ============================================================

const readPendingRegion =
  (): PendingRegion | null => {
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

      if (
        !parsed?.regionId
      ) {
        return null;
      }

      return {
        regionId:
          String(
            parsed.regionId
          ),

        regionName:
          String(
            parsed.regionName ??
              ""
          ),

        organizationId:
          String(
            parsed.organizationId ??
              ""
          ),

        country:
          String(
            parsed.country ??
              ""
          ),

        state:
          String(
            parsed.state ??
              ""
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

const getValue = (
  row:
    Record<string, any>,

  aliases:
    string[]
) => {
  const normalized =
    new Map<
      string,
      any
    >();

  Object.entries(
    row
  ).forEach(
    ([key, value]) => {
      normalized.set(
        normalizeKey(key),
        value
      );
    }
  );

  for (
    const alias of aliases
  ) {
    const value =
      normalized.get(
        normalizeKey(
          alias
        )
      );

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
      );
    }
  }

  return "";
};

const makeCropRow = (
  row:
    Record<string, any>,

  index:
    number
): CropRow => {
  return {
    id:
      `row-${
        index + 2
      }`,

    excelRowNumber:
      index + 2,

    fieldId:
      "",

    cropType:
      getValue(
        row,
        [
          "crop_type",
          "Crop Type",
          "CropType",
          "crop name",
          "crop_name",
        ]
      ),

    season:
      getValue(
        row,
        [
          "season",
          "Season",
        ]
      ),

    farmerName:
      getValue(
        row,
        [
          "farmer_name",
          "Farmer Name",
          "Farmer",
        ]
      ),

    sowingDate:
      getValue(
        row,
        [
          "sowing_date",
          "Sowing Date",
        ]
      ),

    expectedHarvestDate:
      getValue(
        row,
        [
          "expected_harvest_date",
          "Expected Harvest Date",
        ]
      ),

    expectedYield:
      getValue(
        row,
        [
          "expected_yield",
          "Expected Yield",
        ]
      ),

    area:
      getValue(
        row,
        [
          "area",
          "Area",
          "Field Area",
        ]
      ),

    mappingStatus:
      "Pending",

    raw:
      row,
  };
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
                "Unable to read Excel file."
              )
            );

            return;
          }

          const result =
            reader.result;

          const base64 =
            result.includes(",")
              ? result.split(
                  ","
                )[1]
              : result;

          if (!base64) {
            reject(
              new Error(
                "Invalid Excel file."
              )
            );

            return;
          }

          resolve(
            base64
          );
        };

      reader.onerror =
        () =>
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

// ============================================================
// LOCAL SESSION
// ============================================================

const sessionKey = (
  regionId: string
) =>
  `cropMappingSession:${regionId}`;

const saveSession = (
  data:
    StoredSession
) => {
  localStorage.setItem(
    sessionKey(
      data.regionId
    ),

    JSON.stringify(
      data
    )
  );
};

const readSession = (
  regionId: string
):
  StoredSession | null => {
  try {
    const value =
      localStorage.getItem(
        sessionKey(
          regionId
        )
      );

    if (!value) {
      return null;
    }

    return JSON.parse(
      value
    );
  } catch {
    return null;
  }
};

// ============================================================
// GEOMETRY
// ============================================================

const readGeometry = (
  regionId: string
):
  GeoJsonObject | null => {
  try {
    const value =
      localStorage.getItem(
        `regionGeometry:${regionId}`
      );

    if (!value) {
      return null;
    }

    return JSON.parse(
      value
    );
  } catch {
    return null;
  }
};

function FitMap({
  geometry,
}: {
  geometry:
    GeoJsonObject;
}) {
  const map =
    useMap();

  useEffect(() => {
    try {
      const bounds =
        L.geoJSON(
          geometry
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
    } catch {
      // ignore
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
  ] = useState<Region[]>([]);

  const [
    selectedRegionId,
    setSelectedRegionId,
  ] = useState("");

  const [
    rows,
    setRows,
  ] =
    useState<CropRow[]>([]);

  const [
    fileName,
    setFileName,
  ] = useState("");

  const [
    fileContent,
    setFileContent,
  ] =
    useState<string | null>(
      null
    );

  const [
    uploaded,
    setUploaded,
  ] = useState(false);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    uploading,
    setUploading,
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
    mappingRow,
    setMappingRow,
  ] =
    useState<CropRow | null>(
      null
    );

  const [
    selectedPolygon,
    setSelectedPolygon,
  ] =
    useState<SelectedPolygon | null>(
      null
    );

  const [
    page,
    setPage,
  ] = useState(0);

  const [
    rowsPerPage,
    setRowsPerPage,
  ] = useState(20);

  // ============================================================
  // LOAD REGIONS
  // ============================================================

  useEffect(() => {
    const load =
      async () => {
        setLoading(true);

        const pending =
          readPendingRegion();

        try {
          const response =
            await getRegions();

          let list =
            getRegionList(
              response
            );

          // ----------------------------------------------------
          // VERY IMPORTANT:
          // Add latest Create Field region even if GET /regions
          // does not contain it yet.
          // ----------------------------------------------------

          if (pending) {
            const exists =
              list.some(
                (region) =>
                  getRegionId(
                    region
                  ) ===
                  pending.regionId
              );

            if (!exists) {
              list = [
                {
                  id:
                    pending.regionId,

                  region_id:
                    pending.regionId,

                  name:
                    pending.regionName,

                  organization_id:
                    pending.organizationId,

                  country:
                    pending.country,

                  state:
                    pending.state,
                },

                ...list,
              ];
            }
          }

          setRegions(
            list
          );

          if (
            pending?.regionId
          ) {
            setSelectedRegionId(
              pending.regionId
            );
          } else if (
            list.length > 0
          ) {
            setSelectedRegionId(
              getRegionId(
                list[0]
              )
            );
          }
        } catch (err) {
          // ----------------------------------------------------
          // Even if GET /regions fails,
          // allow latest field-created region.
          // ----------------------------------------------------

          if (pending) {
            setRegions([
              {
                id:
                  pending.regionId,

                region_id:
                  pending.regionId,

                name:
                  pending.regionName,

                organization_id:
                  pending.organizationId,

                country:
                  pending.country,

                state:
                  pending.state,
              },
            ]);

            setSelectedRegionId(
              pending.regionId
            );

            setError("");
          } else {
            setError(
              err instanceof Error
                ? err.message
                : "Failed to load regions."
            );
          }
        } finally {
          setLoading(
            false
          );
        }
      };

    void load();
  }, []);

  // ============================================================
  // LOAD SESSION
  // ============================================================

  useEffect(() => {
    if (
      !selectedRegionId
    ) {
      return;
    }

    const session =
      readSession(
        selectedRegionId
      );

    if (session) {
      setRows(
        session.rows ??
          []
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
    } else {
      setRows([]);
      setFileName("");
      setUploaded(false);
    }

    setFileContent(null);
    setPage(0);

    setError("");
    setSuccess("");
  }, [
    selectedRegionId,
  ]);

  // ============================================================
  // SELECTED REGION
  // ============================================================

  const selectedRegion =
    useMemo(
      () =>
        regions.find(
          (region) =>
            getRegionId(
              region
            ) ===
            selectedRegionId
        ) ?? null,

      [
        regions,
        selectedRegionId,
      ]
    );

  const regionName =
    getRegionName(
      selectedRegion ??
        {}
    );

  const geometry =
    useMemo(
      () =>
        selectedRegionId
          ? readGeometry(
              selectedRegionId
            )
          : null,

      [selectedRegionId]
    );

  // ============================================================
  // SELECT EXCEL
  // ============================================================

  const handleExcelFile =
    async (
      event:
        ChangeEvent<HTMLInputElement>
    ) => {
      setError("");
      setSuccess("");

      const file =
        event.target.files?.[0];

      if (!file) {
        return;
      }

      if (
        !file.name
          .toLowerCase()
          .endsWith(
            ".xlsx"
          )
      ) {
        setError(
          "Please upload a valid .xlsx Excel file."
        );

        event.target.value =
          "";

        return;
      }

      try {
        const buffer =
          await file.arrayBuffer();

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

        if (
          workbook
            .SheetNames
            .length === 0
        ) {
          throw new Error(
            "Excel file contains no sheets."
          );
        }

        const cropsSheet =
          workbook.SheetNames.find(
            (name) =>
              name
                .trim()
                .toLowerCase() ===
              "crops"
          );

        const sheetName =
          cropsSheet ??
          workbook
            .SheetNames[0];

        const worksheet =
          workbook.Sheets[
            sheetName
          ];

        const rawRows =
          XLSX.utils
            .sheet_to_json<
              Record<
                string,
                any
              >
            >(
              worksheet,
              {
                defval:
                  "",

                raw:
                  false,
              }
            );

        if (
          rawRows.length ===
          0
        ) {
          throw new Error(
            "Excel contains no crop rows."
          );
        }

        const nextRows =
          rawRows.map(
            makeCropRow
          );

        const base64 =
          await fileToBase64(
            file
          );

        setRows(
          nextRows
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

        setPage(0);

        saveSession({
          regionId:
            selectedRegionId,

          fileName:
            file.name,

          uploaded:
            false,

          rows:
            nextRows,
        });

        setSuccess(
          `${nextRows.length} crop row(s) loaded. Click UPLOAD EXCEL.`
        );
      } catch (err) {
        setRows([]);
        setFileName("");
        setFileContent(
          null
        );
        setUploaded(false);

        setError(
          err instanceof Error
            ? err.message
            : "Failed to read Excel."
        );
      }
    };

  // ============================================================
  // UPLOAD EXCEL
  // ============================================================

  const handleUpload =
    async () => {
      setError("");
      setSuccess("");

      if (
        !selectedRegionId
      ) {
        setError(
          "Please select a region."
        );

        return;
      }

      if (
        !fileContent ||
        !fileName
      ) {
        setError(
          "Please select the Excel file."
        );

        return;
      }

      try {
        setUploading(true);

        const result =
          await uploadCropDetailsExcel(
            selectedRegionId,

            {
              region_id:
                selectedRegionId,

              file_name:
                fileName,

              file_content:
                fileContent,
            }
          );

        if (
          result?.success ===
          false
        ) {
          throw new Error(
            result?.details ||
              result?.error ||
              result?.message ||
              "Excel upload failed."
          );
        }

        const backendRows =
          result?.crops?.rows ??
          result?.rows ??
          [];

        const nextRows =
          rows.map(
            (
              row,
              index
            ) => ({
              ...row,

              cropId:
                backendRows[
                  index
                ]?.crop_id ??
                row.cropId,
            })
          );

        setRows(
          nextRows
        );

        setUploaded(
          true
        );

        saveSession({
          regionId:
            selectedRegionId,

          fileName,

          uploaded:
            true,

          rows:
            nextRows,
        });

        setSuccess(
          result?.message ||
            `${nextRows.length} crop row(s) uploaded successfully.`
        );
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Crop Excel upload failed."
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

  const openMap = (
    row: CropRow
  ) => {
    setError("");

    if (!uploaded) {
      setError(
        "First upload the Excel file."
      );

      return;
    }

    if (!geometry) {
      setError(
        "Field geometry is not available for this region."
      );

      return;
    }

    setMappingRow(row);

    setSelectedPolygon(
      null
    );
  };

  // ============================================================
  // SELECT POLYGON
  // ============================================================

  const handlePolygonClick =
    (
      feature: any,
      index: number
    ) => {
      const properties =
        feature?.properties ??
        {};

      const fieldId =
        String(
          properties
            .geometry_reference_id ??
            properties
              .temp_field_id ??
            index + 1
        );

      const label =
        String(
          properties
            .field_name ??
            `Field ${
              index + 1
            }`
        );

      setSelectedPolygon({
        fieldId,
        label,
        properties,
      });
    };

  // ============================================================
  // CONFIRM LOCAL MAPPING
  // ============================================================

  const confirmMapping =
    () => {
      if (
        !mappingRow ||
        !selectedPolygon
      ) {
        return;
      }

      const nextRows =
        rows.map(
          (row) =>
            row.id ===
            mappingRow.id
              ? {
                  ...row,

                  fieldId:
                    selectedPolygon.fieldId,

                  mappingStatus:
                    "Mapped" as const,
                }
              : row
        );

      setRows(
        nextRows
      );

      saveSession({
        regionId:
          selectedRegionId,

        fileName,

        uploaded,

        rows:
          nextRows,
      });

      setSuccess(
        `Excel row ${mappingRow.excelRowNumber} mapped to ${selectedPolygon.label}.`
      );

      setMappingRow(null);

      setSelectedPolygon(
        null
      );
    };

  // ============================================================
  // COUNTS
  // ============================================================

  const mappedCount =
    rows.filter(
      (row) =>
        row.mappingStatus ===
        "Mapped"
    ).length;

  const pendingCount =
    rows.length -
    mappedCount;

  const visibleRows =
    rows.slice(
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
        rows.length === 0
      ) {
        setError(
          "No crop rows available."
        );

        return;
      }

      if (
        pendingCount !== 0
      ) {
        setError(
          `${pendingCount} row(s) are still pending mapping.`
        );

        return;
      }

      localStorage.removeItem(
        "pendingCropRegion"
      );

      setSuccess(
        "All crop rows mapped successfully."
      );

      if (onComplete) {
        onComplete(
          regionName
        );
      }
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
        elevation={3}
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
          🌾 Upload Crop
          Details
        </Typography>

        <Typography
          variant="body2"
          color="text.secondary"
          mb={3}
        >
          Upload Excel,
          review crop rows and
          map each row to the
          correct KML field.
        </Typography>

        {error && (
          <Alert
            severity="error"
            sx={{ mb: 2 }}
          >
            {error}
          </Alert>
        )}

        {success && (
          <Alert
            severity="success"
            sx={{ mb: 2 }}
          >
            {success}
          </Alert>
        )}

        {/* REGION */}

        <FormControl
          fullWidth
          required
          sx={{ mb: 2 }}
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
            ) =>
              setSelectedRegionId(
                String(
                  event.target
                    .value
                )
              )
            }
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
                    {getRegionName(
                      region
                    )}
                  </MenuItem>
                );
              }
            )}
          </Select>
        </FormControl>

        {/* COUNTS */}

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

        {/* EXCEL */}

        <Button
          component="label"
          fullWidth
          variant="outlined"
          disabled={
            !selectedRegionId
          }
          sx={{ mb: 1 }}
        >
          SELECT EXCEL FILE

          <input
            hidden
            type="file"
            accept=".xlsx"
            onChange={
              handleExcelFile
            }
          />
        </Button>

        {fileName && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mb: 2 }}
          >
            Selected file:{" "}
            {fileName}
          </Typography>
        )}

        {/* UPLOAD */}

        <Button
          fullWidth
          variant="contained"
          disabled={
            uploading ||
            !selectedRegionId ||
            !fileContent
          }
          onClick={
            handleUpload
          }
          sx={{
            mb: 3,

            backgroundColor:
              "#075d16",

            "&:hover": {
              backgroundColor:
                "#064d12",
            },
          }}
        >
          {uploading ? (
            <>
              <CircularProgress
                size={21}
                color="inherit"
                sx={{ mr: 1 }}
              />

              UPLOADING...
            </>
          ) : (
            "UPLOAD EXCEL"
          )}
        </Button>

        {/* GRID */}

        {rows.length >
          0 && (
          <>
            <TableContainer>
              <Table
                size="small"
                sx={{
                  minWidth:
                    1200,
                }}
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
                      Mapping Status
                    </TableCell>

                    <TableCell>
                      Map
                    </TableCell>
                  </TableRow>
                </TableHead>

                <TableBody>
                  {visibleRows.map(
                    (row) => (
                      <TableRow
                        key={
                          row.id
                        }
                      >
                        <TableCell>
                          {row.fieldId ||
                            "-"}
                        </TableCell>

                        <TableCell>
                          {
                            row.cropType
                          }
                        </TableCell>

                        <TableCell>
                          {
                            row.season
                          }
                        </TableCell>

                        <TableCell>
                          {row.farmerName ||
                            "-"}
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

                        <TableCell>
                          <Chip
                            size="small"
                            label={
                              row.mappingStatus
                            }
                            color={
                              row.mappingStatus ===
                              "Mapped"
                                ? "success"
                                : "warning"
                            }
                          />
                        </TableCell>

                        <TableCell>
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={
                              <MapIcon />
                            }
                            onClick={() =>
                              openMap(
                                row
                              )
                            }
                          >
                            MAP
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            <TablePagination
              component="div"
              count={
                rows.length
              }
              page={page}
              rowsPerPage={
                rowsPerPage
              }
              rowsPerPageOptions={[
                10,
                20,
                50,
                100,
              ]}
              onPageChange={(
                _,
                newPage
              ) =>
                setPage(
                  newPage
                )
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

                setPage(0);
              }}
            />

            <Button
              fullWidth
              variant="contained"
              onClick={
                handleComplete
              }
              sx={{
                mt: 2,

                backgroundColor:
                  "#075d16",

                "&:hover": {
                  backgroundColor:
                    "#064d12",
                },
              }}
            >
              COMPLETE
              MAPPING
            </Button>
          </>
        )}
      </Paper>

      {/* MAP POPUP */}

      <Dialog
        open={
          Boolean(
            mappingRow
          )
        }
        fullWidth
        maxWidth="lg"
        onClose={() => {
          setMappingRow(
            null
          );

          setSelectedPolygon(
            null
          );
        }}
      >
        <DialogTitle>
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
          {geometry ? (
            <Box
              sx={{
                height: 500,
                width:
                  "100%",
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
                    geometry
                  }
                  onEachFeature={(
                    feature:
                      any,

                    layer:
                      any
                  ) => {
                    const collection =
                      geometry as FeatureCollection;

                    let index =
                      collection
                        .features
                        .findIndex(
                          (
                            item
                          ) =>
                            item ===
                            feature
                        );

                    if (
                      index < 0
                    ) {
                      index = 0;
                    }

                    layer.on({
                      click:
                        () =>
                          handlePolygonClick(
                            feature,
                            index
                          ),
                    });
                  }}
                />

                <FitMap
                  geometry={
                    geometry
                  }
                />
              </MapContainer>
            </Box>
          ) : (
            <Alert severity="error">
              Field geometry
              unavailable.
            </Alert>
          )}

          {selectedPolygon && (
            <Alert
              severity="info"
              sx={{ mt: 2 }}
            >
              Selected:{" "}
              {
                selectedPolygon.label
              }
            </Alert>
          )}
        </DialogContent>

        <DialogActions>
          <Button
            onClick={() => {
              setMappingRow(
                null
              );

              setSelectedPolygon(
                null
              );
            }}
          >
            CLOSE
          </Button>

          <Button
            variant="contained"
            disabled={
              !selectedPolygon
            }
            onClick={
              confirmMapping
            }
          >
            CONFIRM MAP
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}