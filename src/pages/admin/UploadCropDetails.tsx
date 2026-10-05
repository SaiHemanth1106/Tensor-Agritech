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
  Feature,
  FeatureCollection,
  GeoJsonObject,
} from "geojson";

import * as XLSX from "xlsx";

import {
  getRegions,
  uploadCropDetailsExcel,
  getCropMappingStatus,
  mapCropToField,
  completeCropMapping,
} from "../../services/regionApi";

// ============================================================
// TYPES
// ============================================================

type Region = Record<string, any>;

interface UploadCropDetailsProps {
  onComplete?: (regionName: string) => void;
}

type MappingStatus = "Pending" | "Mapped";

interface CropRow {
  id: string;

  excelRowNumber: number;

  cropId?: string;

  fieldId: string;

  cropType: string;

  season: string;

  farmerName: string;

  sowingDate: string;

  expectedHarvestDate: string;

  expectedYield: string;

  area: string;

  mappingStatus: MappingStatus;

  raw: Record<string, any>;
}

interface SelectedPolygon {
  tempFieldId: string;

  geometryReferenceId: string;

  label: string;

  properties: Record<string, any>;
}

interface PendingRegion {
  regionId: string;

  regionName: string;

  organizationId?: string;

  country?: string;

  state?: string;
}

interface StoredSession {
  regionId: string;

  fileName: string;

  uploaded: boolean;

  rows: CropRow[];
}

// ============================================================
// HELPERS
// ============================================================

const toMappingStatus = (
  value: unknown
): MappingStatus => {
  return String(value).toLowerCase() === "mapped"
    ? "Mapped"
    : "Pending";
};

const getRegionList = (
  response: any
): Region[] => {
  if (Array.isArray(response)) {
    return response;
  }

  if (Array.isArray(response?.regions)) {
    return response.regions;
  }

  if (Array.isArray(response?.data)) {
    return response.data;
  }

  return [];
};

const getRegionId = (
  region: Region
): string => {
  return String(
    region?.region_id ??
      region?.id ??
      region?.regionId ??
      ""
  );
};

const getRegionName = (
  region: Region
): string => {
  return String(
    region?.name ??
      region?.region_name ??
      region?.regionName ??
      ""
  );
};

// ============================================================
// LOCAL STORAGE
// ============================================================

const sessionKey = (
  regionId: string
): string => {
  return `cropMappingSession:${regionId}`;
};

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

      if (!parsed?.regionId) {
        return null;
      }

      return {
        regionId: String(
          parsed.regionId
        ),

        regionName: String(
          parsed.regionName ?? ""
        ),

        organizationId:
          parsed.organizationId
            ? String(
                parsed.organizationId
              )
            : undefined,

        country:
          parsed.country
            ? String(
                parsed.country
              )
            : undefined,

        state:
          parsed.state
            ? String(
                parsed.state
              )
            : undefined,
      };
    } catch {
      return null;
    }
  };

const saveSession = (
  data: StoredSession
): void => {
  localStorage.setItem(
    sessionKey(
      data.regionId
    ),
    JSON.stringify(data)
  );
};

const readSession = (
  regionId: string
): StoredSession | null => {
  try {
    const value =
      localStorage.getItem(
        sessionKey(regionId)
      );

    if (!value) {
      return null;
    }

    const parsed =
      JSON.parse(value);

    if (
      !parsed ||
      !Array.isArray(parsed.rows)
    ) {
      return null;
    }

    return {
      regionId: String(
        parsed.regionId ?? regionId
      ),

      fileName: String(
        parsed.fileName ?? ""
      ),

      uploaded: Boolean(
        parsed.uploaded
      ),

      rows: parsed.rows.map(
        (row: any): CropRow => ({
          id: String(
            row.id ?? ""
          ),

          excelRowNumber:
            Number(
              row.excelRowNumber ?? 0
            ),

          cropId:
            row.cropId != null
              ? String(row.cropId)
              : undefined,

          fieldId: String(
            row.fieldId ?? ""
          ),

          cropType: String(
            row.cropType ?? ""
          ),

          season: String(
            row.season ?? ""
          ),

          farmerName: String(
            row.farmerName ?? ""
          ),

          sowingDate: String(
            row.sowingDate ?? ""
          ),

          expectedHarvestDate:
            String(
              row.expectedHarvestDate ??
                ""
            ),

          expectedYield: String(
            row.expectedYield ?? ""
          ),

          area: String(
            row.area ?? ""
          ),

          mappingStatus:
            toMappingStatus(
              row.mappingStatus
            ),

          raw:
            row.raw ?? {},
        })
      ),
    };
  } catch {
    return null;
  }
};

// ============================================================
// GEOMETRY
// ============================================================

const readCachedGeometry = (
  regionId: string
): GeoJsonObject | null => {
  try {
    const value =
      localStorage.getItem(
        `regionGeometry:${regionId}`
      );

    if (!value) {
      return null;
    }

    return JSON.parse(value);
  } catch {
    return null;
  }
};

const buildGeometryCollection = (
  geometries: any[]
): FeatureCollection => {
  return {
    type: "FeatureCollection",

    features: geometries
      .filter(
        (item) =>
          item?.geometry
      )
      .map(
        (item): Feature => ({
          type: "Feature",

          properties: {
            temp_field_id:
              item.temp_field_id,

            geometry_reference_id:
              item.geometry_reference_id,

            country:
              item.country,

            state:
              item.state,
          },

          geometry:
            item.geometry,
        })
      ),
  };
};

// ============================================================
// MAP FIT
// ============================================================

function FitMap({
  geometry,
}: {
  geometry: GeoJsonObject;
}) {
  const map = useMap();

  useEffect(() => {
    try {
      const bounds =
        L.geoJSON(
          geometry
        ).getBounds();

      if (bounds.isValid()) {
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
      // Ignore invalid geometry
    }
  }, [
    geometry,
    map,
  ]);

  return null;
}

// ============================================================
// EXCEL HELPERS
// ============================================================

const normalizeKey = (
  value: string
): string => {
  return value
    .trim()
    .toLowerCase()
    .replace(
      /[\s_-]+/g,
      ""
    );
};

const getValue = (
  row: Record<string, any>,
  aliases: string[]
): string => {
  const normalized =
    new Map<
      string,
      any
    >();

  Object.entries(row).forEach(
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

  return "";
};

const makeCropRow = (
  row: Record<string, any>,
  index: number
): CropRow => {
  return {
    id: `row-${index + 2}`,

    excelRowNumber:
      index + 2,

    cropId:
      undefined,

    fieldId: "",

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

    raw: row,
  };
};

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

      reader.onerror = () => {
        reject(
          new Error(
            "Unable to read Excel file."
          )
        );
      };

      reader.readAsDataURL(
        file
      );
    }
  );
};

// ============================================================
// COMPONENT
// ============================================================

export default function UploadCropDetails({
  onComplete,
}: UploadCropDetailsProps) {
  // ----------------------------------------------------------
  // REGIONS
  // ----------------------------------------------------------

  const [
    regions,
    setRegions,
  ] = useState<Region[]>([]);

  const [
    selectedRegionId,
    setSelectedRegionId,
  ] = useState("");

  // ----------------------------------------------------------
  // ROWS
  // ----------------------------------------------------------

  const [
    rows,
    setRows,
  ] = useState<CropRow[]>([]);

  const [
    fileName,
    setFileName,
  ] = useState("");

  const [
    fileContent,
    setFileContent,
  ] = useState<
    string | null
  >(null);

  const [
    uploaded,
    setUploaded,
  ] = useState(false);

  // ----------------------------------------------------------
  // LOADING
  // ----------------------------------------------------------

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    uploading,
    setUploading,
  ] = useState(false);

  const [
    statusLoading,
    setStatusLoading,
  ] = useState(false);

  const [
    mappingLoading,
    setMappingLoading,
  ] = useState(false);

  // ----------------------------------------------------------
  // MESSAGES
  // ----------------------------------------------------------

  const [
    error,
    setError,
  ] = useState("");

  const [
    success,
    setSuccess,
  ] = useState("");

  // ----------------------------------------------------------
  // MAP
  // ----------------------------------------------------------

  const [
    mappingRow,
    setMappingRow,
  ] = useState<
    CropRow | null
  >(null);

  const [
    selectedPolygon,
    setSelectedPolygon,
  ] = useState<
    SelectedPolygon | null
  >(null);

  const [
    geometry,
    setGeometry,
  ] = useState<
    GeoJsonObject | null
  >(null);

  // ----------------------------------------------------------
  // PAGINATION
  // ----------------------------------------------------------

  const [
    page,
    setPage,
  ] = useState(0);

  const [
    rowsPerPage,
    setRowsPerPage,
  ] = useState(20);

  // ==========================================================
  // LOAD REGIONS
  // ==========================================================

  useEffect(() => {
    const loadRegions =
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

          setRegions(list);

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
          } else {
            setError(
              err instanceof Error
                ? err.message
                : "Failed to load regions."
            );
          }
        } finally {
          setLoading(false);
        }
      };

    void loadRegions();
  }, []);

  // ==========================================================
  // LOAD LOCAL SESSION
  // ==========================================================

  useEffect(() => {
    if (!selectedRegionId) {
      return;
    }

    const session =
      readSession(
        selectedRegionId
      );

    if (session) {
      setRows(
        session.rows
      );

      setFileName(
        session.fileName
      );

      setUploaded(
        session.uploaded
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

  // ==========================================================
  // LOAD DATABASE STATUS
  // ==========================================================

  useEffect(() => {
    if (!selectedRegionId) {
      return;
    }

    const loadStatus =
      async () => {
        setStatusLoading(true);

        try {
          const result =
            await getCropMappingStatus(
              selectedRegionId
            );

          if (
            !result?.success
          ) {
            throw new Error(
              "Unable to load crop mapping status."
            );
          }

          // ----------------------------------------------
          // DATABASE IS SOURCE OF TRUTH
          // ----------------------------------------------

          const dbRows =
            Array.isArray(
              result.crops
            )
              ? result.crops
              : [];

          const existingRows =
            readSession(
              selectedRegionId
            )?.rows ?? rows;

          const existingByCropId =
            new Map<
              string,
              CropRow
            >();

          existingRows.forEach(
            (row) => {
              if (row.cropId) {
                existingByCropId.set(
                  String(
                    row.cropId
                  ),
                  row
                );
              }
            }
          );

          const nextRows: CropRow[] =
            dbRows.map(
              (
                crop: any,
                index: number
              ): CropRow => {
                const cropId =
                  String(
                    crop.crop_id
                  );

                const existing =
                  existingByCropId.get(
                    cropId
                  );

                return {
                  id:
                    existing?.id ??
                    `db-row-${index + 2}`,

                  excelRowNumber:
                    existing
                      ?.excelRowNumber ??
                    index + 2,

                  cropId,

                  fieldId:
                    crop.field_id !=
                    null
                      ? String(
                          crop.field_id
                        )
                      : "",

                  cropType:
                    String(
                      crop.crop_name ??
                        crop.crop_type ??
                        existing?.cropType ??
                        ""
                    ),

                  season:
                    String(
                      crop.season ??
                        existing?.season ??
                        ""
                    ),

                  farmerName:
                    String(
                      crop.farmer_name ??
                        existing?.farmerName ??
                        ""
                    ),

                  sowingDate:
                    String(
                      crop.sowing_date ??
                        existing?.sowingDate ??
                        ""
                    ),

                  expectedHarvestDate:
                    String(
                      crop.expected_harvest_date ??
                        existing?.expectedHarvestDate ??
                        ""
                    ),

                  expectedYield:
                    crop.expected_yield !=
                    null
                      ? String(
                          crop.expected_yield
                        )
                      : existing?.expectedYield ??
                        "",

                  area:
                    crop.area !=
                    null
                      ? String(
                          crop.area
                        )
                      : existing?.area ??
                        "",

                  mappingStatus:
                    toMappingStatus(
                      crop.mapping_status ??
                        (crop.field_id !=
                        null
                          ? "Mapped"
                          : "Pending")
                    ),

                  raw:
                    existing?.raw ??
                    crop,
                };
              }
            );

          setRows(
            nextRows
          );

          setUploaded(
            dbRows.length > 0
          );

          // ----------------------------------------------
          // SAVE DB STATE TO LOCAL CACHE
          // ----------------------------------------------

          if (
            dbRows.length > 0
          ) {
            const session =
              readSession(
                selectedRegionId
              );

            saveSession({
              regionId:
                selectedRegionId,

              fileName:
                session?.fileName ??
                "",

              uploaded: true,

              rows:
                nextRows,
            });
          }

          // ----------------------------------------------
          // GEOMETRY
          // ----------------------------------------------

          if (
            Array.isArray(
              result.geometries
            ) &&
            result.geometries.length >
              0
          ) {
            const collection =
              buildGeometryCollection(
                result.geometries
              );

            setGeometry(
              collection
            );

            localStorage.setItem(
              `regionGeometry:${selectedRegionId}`,
              JSON.stringify(
                collection
              )
            );
          } else {
            const cached =
              readCachedGeometry(
                selectedRegionId
              );

            setGeometry(
              cached
            );
          }
        } catch (err) {
          console.error(
            "MAPPING STATUS ERROR:",
            err
          );

          // Backend unavailable:
          // fall back to local cache.

          const cached =
            readCachedGeometry(
              selectedRegionId
            );

          setGeometry(
            cached
          );
        } finally {
          setStatusLoading(false);
        }
      };

    void loadStatus();

    // We intentionally do not put `rows`
    // in the dependency list.
    // Otherwise this effect would repeatedly
    // call the backend whenever a row changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selectedRegionId,
  ]);

  // ==========================================================
  // SELECTED REGION
  // ==========================================================

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
      selectedRegion ?? {}
    );

  // ==========================================================
  // SELECT EXCEL
  // ==========================================================

  const handleExcelFile =
    async (
      event: ChangeEvent<HTMLInputElement>
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
          .endsWith(".xlsx")
      ) {
        setError(
          "Please upload a valid .xlsx Excel file."
        );

        event.target.value = "";

        return;
      }

      try {
        const buffer =
          await file.arrayBuffer();

        const workbook =
          XLSX.read(
            buffer,
            {
              type: "array",
              cellDates: true,
            }
          );

        if (
          workbook.SheetNames
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
          workbook.SheetNames[0];

        const worksheet =
          workbook.Sheets[
            sheetName
          ];

        const rawRows =
          XLSX.utils.sheet_to_json<
            Record<string, any>
          >(
            worksheet,
            {
              defval: "",
              raw: false,
            }
          );

        if (
          rawRows.length === 0
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

          uploaded: false,

          rows:
            nextRows,
        });

        setSuccess(
          `${nextRows.length} crop row(s) loaded. Click UPLOAD EXCEL.`
        );
      } catch (err) {
        setRows([]);
        setFileName("");
        setFileContent(null);
        setUploaded(false);

        setError(
          err instanceof Error
            ? err.message
            : "Failed to read Excel."
        );
      }
    };

  // ==========================================================
  // UPLOAD EXCEL
  // ==========================================================

  const handleUpload =
    async () => {
      setError("");
      setSuccess("");

      if (!selectedRegionId) {
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
          result?.success === false
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

        const nextRows: CropRow[] =
          rows.map(
            (
              row,
              index
            ): CropRow => ({
              ...row,

              cropId:
                backendRows[
                  index
                ]?.crop_id != null
                  ? String(
                      backendRows[
                        index
                      ].crop_id
                    )
                  : row.cropId,

              fieldId:
                row.fieldId,

              mappingStatus:
                row.mappingStatus ===
                "Mapped"
                  ? "Mapped"
                  : "Pending",
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

          uploaded: true,

          rows:
            nextRows,
        });

        setSuccess(
          result?.message ||
            `${nextRows.length} crop row(s) uploaded successfully.`
        );

        // Refresh DB status
        try {
          const status =
            await getCropMappingStatus(
              selectedRegionId
            );

          if (
            status?.success
          ) {
            const refreshedRows: CropRow[] =
              (
                status.crops ??
                []
              ).map(
                (
                  crop: any,
                  index: number
                ): CropRow => {
                  const existing =
                    nextRows.find(
                      (row) =>
                        row.cropId ===
                        String(
                          crop.crop_id
                        )
                    );

                  return {
                    id:
                      existing?.id ??
                      `db-row-${index + 2}`,

                    excelRowNumber:
                      existing?.excelRowNumber ??
                      index + 2,

                    cropId:
                      String(
                        crop.crop_id
                      ),

                    fieldId:
                      crop.field_id !=
                      null
                        ? String(
                            crop.field_id
                          )
                        : "",

                    cropType:
                      String(
                        crop.crop_name ??
                          crop.crop_type ??
                          existing?.cropType ??
                          ""
                      ),

                    season:
                      String(
                        crop.season ??
                          existing?.season ??
                          ""
                      ),

                    farmerName:
                      String(
                        crop.farmer_name ??
                          existing?.farmerName ??
                          ""
                      ),

                    sowingDate:
                      String(
                        crop.sowing_date ??
                          existing?.sowingDate ??
                          ""
                      ),

                    expectedHarvestDate:
                      String(
                        crop.expected_harvest_date ??
                          existing?.expectedHarvestDate ??
                          ""
                      ),

                    expectedYield:
                      crop.expected_yield !=
                      null
                        ? String(
                            crop.expected_yield
                          )
                        : existing?.expectedYield ??
                          "",

                    area:
                      crop.area !=
                      null
                        ? String(
                            crop.area
                          )
                        : existing?.area ??
                          "",

                    mappingStatus:
                      toMappingStatus(
                        crop.mapping_status ??
                          (crop.field_id !=
                          null
                            ? "Mapped"
                            : "Pending")
                      ),

                    raw:
                      existing?.raw ??
                      crop,
                  };
                }
              );

            setRows(
              refreshedRows
            );

            saveSession({
              regionId:
                selectedRegionId,

              fileName,

              uploaded: true,

              rows:
                refreshedRows,
            });
          }
        } catch {
          // Upload already succeeded.
        }
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Crop Excel upload failed."
        );
      } finally {
        setUploading(false);
      }
    };

  // ==========================================================
  // OPEN MAP
  // ==========================================================

  const openMap = (
    row: CropRow
  ) => {
    setError("");
    setSuccess("");

    if (!uploaded) {
      setError(
        "First upload the Excel file."
      );

      return;
    }

    if (
      row.mappingStatus ===
      "Mapped"
    ) {
      setError(
        "This crop is already mapped."
      );

      return;
    }

    if (!row.cropId) {
      setError(
        "Crop ID is missing. Please upload the Excel file first."
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

    setSelectedPolygon(
      null
    );
  };

  // ==========================================================
  // POLYGON CLICK
  // ==========================================================

  const handlePolygonClick = (
    feature: any
  ) => {
    const properties =
      feature?.properties ??
      {};

    const tempFieldId =
      properties.temp_field_id;

    const geometryReferenceId =
      properties.geometry_reference_id;

    if (!tempFieldId) {
      setError(
        "This field does not have a temporary field ID."
      );

      return;
    }

    setSelectedPolygon({
      tempFieldId:
        String(
          tempFieldId
        ),

      geometryReferenceId:
        geometryReferenceId !=
        null
          ? String(
              geometryReferenceId
            )
          : "",

      label:
        geometryReferenceId !=
        null
          ? `Field ${String(
              geometryReferenceId
            )}`
          : `Temporary Field ${String(
              tempFieldId
            )}`,

      properties,
    });
  };

  // ==========================================================
  // CONFIRM MAPPING
  // ==========================================================

  const confirmMapping =
    async () => {
      if (
        !mappingRow ||
        !selectedPolygon
      ) {
        return;
      }

      if (!mappingRow.cropId) {
        setError(
          "Crop ID is missing."
        );

        return;
      }

      setError("");
      setSuccess("");
      setMappingLoading(true);

      try {
        const result =
          await mapCropToField({
            region_id:
              selectedRegionId,

            crop_id:
              String(
                mappingRow.cropId
              ),

            temp_field_id:
              selectedPolygon.tempFieldId,
          });

        if (
          result?.success === false
        ) {
          throw new Error(
            result?.details ||
              result?.error ||
              result?.message ||
              "Crop mapping failed."
          );
        }

        // --------------------------------------------------
        // Update local row ONLY after backend success
        // --------------------------------------------------

        const mappedFieldId =
          result?.field?.field_id !=
          null
            ? String(
                result.field.field_id
              )
            : selectedPolygon
                .geometryReferenceId;

        const nextRows: CropRow[] =
          rows.map(
            (
              row
            ): CropRow => {
              if (
                row.cropId !==
                String(
                  mappingRow.cropId
                )
              ) {
                return row;
              }

              return {
                ...row,

                fieldId:
                  mappedFieldId,

                mappingStatus:
                  "Mapped",
              };
            }
          );

        setRows(
          nextRows
        );

        saveSession({
          regionId:
            selectedRegionId,

          fileName,

          uploaded: true,

          rows:
            nextRows,
        });

        setMappingRow(
          null
        );

        setSelectedPolygon(
          null
        );

        setSuccess(
          result?.message ||
            "Crop mapped to field successfully."
        );

        // --------------------------------------------------
        // Refresh from database
        // --------------------------------------------------

        try {
          const status =
            await getCropMappingStatus(
              selectedRegionId
            );

          if (
            status?.success
          ) {
            const refreshedRows: CropRow[] =
              (
                status.crops ??
                []
              ).map(
                (
                  crop: any,
                  index: number
                ): CropRow => {
                  const existing =
                    nextRows.find(
                      (row) =>
                        row.cropId ===
                        String(
                          crop.crop_id
                        )
                    );

                  return {
                    id:
                      existing?.id ??
                      `db-row-${index + 2}`,

                    excelRowNumber:
                      existing?.excelRowNumber ??
                      index + 2,

                    cropId:
                      String(
                        crop.crop_id
                      ),

                    fieldId:
                      crop.field_id !=
                      null
                        ? String(
                            crop.field_id
                          )
                        : "",

                    cropType:
                      String(
                        crop.crop_name ??
                          crop.crop_type ??
                          existing?.cropType ??
                          ""
                      ),

                    season:
                      String(
                        crop.season ??
                          existing?.season ??
                          ""
                      ),

                    farmerName:
                      String(
                        crop.farmer_name ??
                          existing?.farmerName ??
                          ""
                      ),

                    sowingDate:
                      String(
                        crop.sowing_date ??
                          existing?.sowingDate ??
                          ""
                      ),

                    expectedHarvestDate:
                      String(
                        crop.expected_harvest_date ??
                          existing?.expectedHarvestDate ??
                          ""
                      ),

                    expectedYield:
                      crop.expected_yield !=
                      null
                        ? String(
                            crop.expected_yield
                          )
                        : existing?.expectedYield ??
                          "",

                    area:
                      crop.area !=
                      null
                        ? String(
                            crop.area
                          )
                        : existing?.area ??
                          "",

                    mappingStatus:
                      toMappingStatus(
                        crop.mapping_status ??
                          (crop.field_id !=
                          null
                            ? "Mapped"
                            : "Pending")
                      ),

                    raw:
                      existing?.raw ??
                      crop,
                  };
                }
              );

            setRows(
              refreshedRows
            );

            saveSession({
              regionId:
                selectedRegionId,

              fileName,

              uploaded: true,

              rows:
                refreshedRows,
            });
          }
        } catch {
          // Mapping already succeeded.
        }
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Crop mapping failed."
        );
      } finally {
        setMappingLoading(
          false
        );
      }
    };

  // ==========================================================
  // COUNTS
  // ==========================================================

  const mappedCount =
    rows.filter(
      (row) =>
        row.mappingStatus ===
        "Mapped"
    ).length;

  const pendingCount =
    rows.filter(
      (row) =>
        row.mappingStatus ===
        "Pending"
    ).length;

  const visibleRows =
    rows.slice(
      page * rowsPerPage,
      page * rowsPerPage +
        rowsPerPage
    );

  // ==========================================================
  // COMPLETE MAPPING
  // ==========================================================

  const handleComplete =
    async () => {
      setError("");
      setSuccess("");

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

      try {
        setMappingLoading(
          true
        );

        const result =
          await completeCropMapping(
            selectedRegionId
          );

        if (
          result?.success === false
        ) {
          throw new Error(
            result?.details ||
              result?.error ||
              result?.message ||
              "Unable to complete mapping."
          );
        }

        localStorage.removeItem(
          sessionKey(
            selectedRegionId
          )
        );

        localStorage.removeItem(
          "pendingCropRegion"
        );

        setSuccess(
          result?.message ||
            "All crop rows mapped successfully."
        );

        if (onComplete) {
          onComplete(
            regionName
          );
        }
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to complete mapping."
        );
      } finally {
        setMappingLoading(
          false
        );
      }
    };

  // ==========================================================
  // LOADING
  // ==========================================================

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

  // ==========================================================
  // UI
  // ==========================================================

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
          🌾 Upload Crop Details
        </Typography>

        <Typography
          variant="body2"
          color="text.secondary"
          mb={3}
        >
          Upload Excel, review crop rows
          and map each row to the correct
          KML field.
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
            onChange={(event) =>
              setSelectedRegionId(
                String(
                  event.target.value
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

        {/* STATUS */}

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

          {statusLoading && (
            <Chip
              label="Syncing..."
              icon={
                <CircularProgress
                  size={14}
                />
              }
            />
          )}
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

        {rows.length > 0 && (
          <>
            <TableContainer>
              <Table
                size="small"
                sx={{
                  minWidth: 1200,
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
                        key={row.id}
                      >
                        <TableCell>
                          {row.fieldId ||
                            "-"}
                        </TableCell>

                        <TableCell>
                          {row.cropType}
                        </TableCell>

                        <TableCell>
                          {row.season}
                        </TableCell>

                        <TableCell>
                          {row.farmerName ||
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
                            disabled={
                              !uploaded ||
                              row.mappingStatus ===
                                "Mapped"
                            }
                            onClick={() =>
                              openMap(
                                row
                              )
                            }
                          >
                            {row.mappingStatus ===
                            "Mapped"
                              ? "MAPPED"
                              : "MAP"}
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
                    event.target.value
                  )
                );

                setPage(0);
              }}
            />

            {/* COMPLETE */}

            <Button
              fullWidth
              variant="contained"
              disabled={
                pendingCount !==
                  0 ||
                mappingLoading
              }
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
              {mappingLoading ? (
                <>
                  <CircularProgress
                    size={21}
                    color="inherit"
                    sx={{ mr: 1 }}
                  />

                  PROCESSING...
                </>
              ) : (
                "COMPLETE MAPPING"
              )}
            </Button>
          </>
        )}
      </Paper>

      {/* ======================================================
          MAP DIALOG
          ====================================================== */}

      <Dialog
        open={
          Boolean(
            mappingRow
          )
        }
        fullWidth
        maxWidth="lg"
        onClose={() => {
          if (
            mappingLoading
          ) {
            return;
          }

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
                width: "100%",
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
                  style={() => ({
                    weight: 2,
                  })}
                  onEachFeature={(
                    feature,
                    layer
                  ) => {
                    layer.on({
                      click: () =>
                        handlePolygonClick(
                          feature
                        ),
                    });

                    layer.bindTooltip(
                      String(
                        feature
                          ?.properties
                          ?.geometry_reference_id ??
                          feature
                            ?.properties
                            ?.temp_field_id ??
                          "Field"
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
            disabled={
              mappingLoading
            }
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
              !selectedPolygon ||
              mappingLoading
            }
            onClick={
              confirmMapping
            }
          >
            {mappingLoading ? (
              <>
                <CircularProgress
                  size={20}
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