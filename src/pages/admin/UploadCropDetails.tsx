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
} from "react-leaflet";

import type {
  Feature,
  FeatureCollection,
  Geometry,
} from "geojson";

import * as XLSX from "xlsx";

import "leaflet/dist/leaflet.css";


// ============================================================
// PROPS
// ============================================================

interface UploadCropDetailsProps {

  onComplete: (
    regionName: string
  ) => void;

}


// ============================================================
// TYPES
// ============================================================

interface PendingRegion {
  regionId: string;
  regionName: string;
  organizationId?: string;
  country?: string;
  state?: string;
}

interface CropRow {
  id: number;

  fieldId: string;

  cropType: string;

  season: string;

  farmerName: string;

  sowingDate: string;

  expectedHarvestDate:
    string;

  expectedYield: string;

  area: string;

  mapped: boolean;

  mappedFeatureIndex?:
    number;
}


// ============================================================
// NORMALIZE COLUMN NAME
// ============================================================

const normalizeKey = (
  value: string
) =>
  value
    .toLowerCase()
    .replace(
      /[^a-z0-9]/g,
      ""
    );


// ============================================================
// GET VALUE USING POSSIBLE COLUMN NAMES
// ============================================================

const getValue = (
  row:
    Record<
      string,
      unknown
    >,

  aliases: string[]
) => {

  const keys =
    Object.keys(row);

  for (
    const alias of aliases
  ) {

    const match =
      keys.find(
        (key) =>
          normalizeKey(key) ===
          normalizeKey(alias)
      );

    if (match) {

      const value =
        row[match];

      if (
        value !== undefined &&
        value !== null
      ) {

        return String(
          value
        ).trim();

      }

    }

  }

  return "";

};


// ============================================================
// COMPONENT
// ============================================================

export default function UploadCropDetails({

  onComplete,

}: UploadCropDetailsProps) {


  const [
    pendingRegion,
    setPendingRegion,
  ] =
    useState<
      PendingRegion | null
    >(null);


  const [
    rows,
    setRows,
  ] =
    useState<
      CropRow[]
    >([]);


  const [
    fileName,
    setFileName,
  ] =
    useState("");


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
    geometry,
    setGeometry,
  ] =
    useState<
      FeatureCollection | null
    >(null);


  const [
    mapOpen,
    setMapOpen,
  ] =
    useState(false);


  const [
    selectedRowId,
    setSelectedRowId,
  ] =
    useState<
      number | null
    >(null);


  const [
    selectedFeatureIndex,
    setSelectedFeatureIndex,
  ] =
    useState<
      number | null
    >(null);


  // ============================================================
  // LOAD REGION
  // ============================================================

  useEffect(() => {

    try {

      const stored =
        localStorage.getItem(
          "pendingCropRegion"
        );

      if (!stored) {

        setError(
          "No region selected. Upload KML from Create Field first."
        );

        return;
      }


      const parsed =
        JSON.parse(
          stored
        );


      if (
        !parsed?.regionId
      ) {

        setError(
          "Selected region details are unavailable."
        );

        return;
      }


      const region:
        PendingRegion = {

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


      setPendingRegion(
        region
      );


      // ========================================================
      // LOAD KML GEOMETRY
      // ========================================================

      const storedGeometry =
        localStorage.getItem(
          `regionGeometry:${region.regionId}`
        );


      if (storedGeometry) {

        try {

          const parsedGeometry =
            JSON.parse(
              storedGeometry
            );

          setGeometry(
            parsedGeometry
          );

        } catch (
          geometryError
        ) {

          console.error(
            geometryError
          );

        }

      }

    } catch (
      loadError
    ) {

      console.error(
        loadError
      );

      setError(
        "Unable to load selected region."
      );

    }

  }, []);


  // ============================================================
  // READ EXCEL
  // ============================================================

  const handleExcel =
    async (
      event:
        ChangeEvent<HTMLInputElement>
    ) => {

      const file =
        event.target
          .files?.[0];

      event.target.value =
        "";

      setError("");
      setSuccess("");


      if (!file) {
        return;
      }


      if (
        !file.name
          .toLowerCase()
          .endsWith(
            ".xlsx"
          ) &&
        !file.name
          .toLowerCase()
          .endsWith(
            ".xls"
          )
      ) {

        setError(
          "Please select a valid Excel file."
        );

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
            }
          );


        const firstSheet =
          workbook.SheetNames[0];


        if (!firstSheet) {

          throw new Error(
            "Excel file does not contain a sheet."
          );

        }


        const sheet =
          workbook.Sheets[
            firstSheet
          ];


        const rawRows =
          XLSX.utils
            .sheet_to_json<
              Record<
                string,
                unknown
              >
            >(
              sheet,
              {
                defval: "",
                raw: false,
              }
            );


        if (
          rawRows.length ===
          0
        ) {

          throw new Error(
            "Excel file contains no crop rows."
          );

        }


        // ======================================================
        // BUILD GRID ROWS
        // ======================================================

        const parsedRows:
          CropRow[] =
          rawRows.map(
            (
              row,
              index
            ) => ({

              id:
                index + 1,


              fieldId:
                getValue(
                  row,
                  [
                    "Field ID",
                    "FieldID",
                    "field_id",
                  ]
                ),


              cropType:
                getValue(
                  row,
                  [
                    "Crop Type",
                    "CropType",
                    "Crop",
                    "Crop Name",
                    "crop_type",
                  ]
                ),


              season:
                getValue(
                  row,
                  [
                    "Season",
                  ]
                ),


              farmerName:
                getValue(
                  row,
                  [
                    "Farmer Name",
                    "FarmerName",
                    "Farmer",
                    "farmer_name",
                  ]
                ),


              sowingDate:
                getValue(
                  row,
                  [
                    "Sowing Date",
                    "SowingDate",
                    "sowing_date",
                  ]
                ),


              expectedHarvestDate:
                getValue(
                  row,
                  [
                    "Expected Harvest Date",
                    "ExpectedHarvestDate",
                    "Harvest Date",
                    "expected_harvest_date",
                  ]
                ),


              expectedYield:
                getValue(
                  row,
                  [
                    "Expected Yield",
                    "ExpectedYield",
                    "Yield",
                    "expected_yield",
                  ]
                ),


              area:
                getValue(
                  row,
                  [
                    "Area",
                    "Field Area",
                    "field_area",
                  ]
                ),


              mapped:
                false,

            })
          );


        setRows(
          parsedRows
        );

        setFileName(
          file.name
        );


        setSuccess(
          `${parsedRows.length} crop row(s) loaded successfully.`
        );


        // ======================================================
        // FRONTEND SESSION ONLY
        // ======================================================

        if (
          pendingRegion
        ) {

          localStorage.setItem(

            `frontendCropRows:${pendingRegion.regionId}`,

            JSON.stringify(
              parsedRows
            )

          );

        }

      } catch (
        excelError
      ) {

        console.error(
          excelError
        );

        setRows([]);

        setFileName("");

        setError(
          excelError instanceof Error
            ? excelError.message
            : "Unable to process Excel file."
        );

      }

    };


  // ============================================================
  // OPEN MAP
  // ============================================================

  const handleOpenMap =
    (
      rowId: number
    ) => {

      if (!geometry) {

        setError(
          "Field geometry is unavailable. Please upload KML from Create Field."
        );

        return;
      }


      setSelectedRowId(
        rowId
      );

      setSelectedFeatureIndex(
        null
      );

      setMapOpen(
        true
      );

    };


  // ============================================================
  // SELECT POLYGON
  // ============================================================

  const onEachFeature =
    (
      _feature:
        Feature<
          Geometry,
          any
        >,

      layer: any
    ) => {

      const index =
        (
          geometry
            ?.features ??
          []
        ).findIndex(
          (feature) =>
            feature ===
            _feature
        );


      layer.on(
        "click",
        () => {

          setSelectedFeatureIndex(
            index
          );

        }
      );

    };


  // ============================================================
  // CONFIRM MAPPING
  // ============================================================

  const handleConfirmMapping =
    () => {

      if (
        selectedRowId ===
          null ||
        selectedFeatureIndex ===
          null
      ) {

        setError(
          "Please select a field polygon on the map."
        );

        return;
      }


      setRows(
        (currentRows) => {

          const updatedRows =
            currentRows.map(
              (row) => {

                if (
                  row.id !==
                  selectedRowId
                ) {
                  return row;
                }


                const feature =
                  geometry
                    ?.features[
                      selectedFeatureIndex
                    ];


                const properties =
                  feature
                    ?.properties ??
                  {};


                const polygonFieldId =
                  String(
                    properties.field_id ??
                    properties.fieldId ??
                    properties.id ??
                    properties.name ??
                    `FIELD-${String(
                      selectedFeatureIndex +
                        1
                    ).padStart(
                      3,
                      "0"
                    )}`
                  );


                return {
                  ...row,

                  fieldId:
                    polygonFieldId,

                  mapped: true,

                  mappedFeatureIndex:
                    selectedFeatureIndex,
                };

              }
            );


          if (
            pendingRegion
          ) {

            localStorage.setItem(

              `frontendCropRows:${pendingRegion.regionId}`,

              JSON.stringify(
                updatedRows
              )

            );

          }


          return updatedRows;

        }
      );


      setMapOpen(
        false
      );

      setSelectedRowId(
        null
      );

      setSelectedFeatureIndex(
        null
      );

      setError("");

      setSuccess(
        "Crop row mapped successfully."
      );

    };


  // ============================================================
  // COUNTS
  // ============================================================

  const mappedCount =
    useMemo(
      () =>
        rows.filter(
          (row) =>
            row.mapped
        ).length,

      [rows]
    );


  const pendingCount =
    rows.length -
    mappedCount;


  // ============================================================
  // COMPLETE
  // ============================================================

  const handleComplete =
    () => {

      if (
        rows.length === 0
      ) {

        setError(
          "Please upload crop details first."
        );

        return;
      }


      if (
        pendingCount > 0
      ) {

        setError(
          `Please map all pending rows. ${pendingCount} row(s) are still pending.`
        );

        return;
      }


      if (!pendingRegion) {
        return;
      }


      localStorage.setItem(

        "lastCompletedRegionName",

        pendingRegion.regionName

      );


      onComplete(
        pendingRegion.regionName
      );

    };


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
          🌾 Upload Crop Details
        </Typography>


        {pendingRegion && (

          <Typography
            variant="body2"
            color="text.secondary"
            mb={2}
          >
            Region:{" "}
            <strong>
              {pendingRegion.regionName}
            </strong>
          </Typography>

        )}


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


        {/* ==================================================== */}
        {/* EXCEL UPLOAD */}
        {/* ==================================================== */}

        <Box
          display="flex"
          gap={2}
          alignItems="center"
          flexWrap="wrap"
          mb={3}
        >

          <Button
            component="label"

            variant="contained"

            sx={{
              backgroundColor:
                "#2D6A4F",

              "&:hover": {
                backgroundColor:
                  "#1B4332",
              },
            }}
          >
            Upload Excel

            <input
              hidden
              type="file"

              accept=".xlsx,.xls"

              onChange={
                handleExcel
              }
            />

          </Button>


          {fileName && (

            <Typography
              variant="body2"
            >
              {fileName}
            </Typography>

          )}


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


        {/* ==================================================== */}
        {/* GRID */}
        {/* ==================================================== */}

        {rows.length >
          0 && (

          <TableContainer>

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
                    Mapping Status
                  </TableCell>

                  <TableCell>
                    Map
                  </TableCell>

                </TableRow>

              </TableHead>


              <TableBody>

                {rows.map(
                  (row) => (

                    <TableRow
                      key={
                        row.id
                      }

                      sx={{
                        opacity:
                          row.mapped
                            ? 0.65
                            : 1,
                      }}
                    >

                      <TableCell>
                        {row.fieldId ||
                          "-"}
                      </TableCell>


                      <TableCell>
                        {row.cropType ||
                          "-"}
                      </TableCell>


                      <TableCell>
                        {row.season ||
                          "-"}
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
                        {
                          row.expectedHarvestDate ||
                          "-"
                        }
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
                            row.mapped
                              ? "Mapped"
                              : "Pending"
                          }

                          color={
                            row.mapped
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
                            row.mapped
                          }

                          onClick={() =>
                            handleOpenMap(
                              row.id
                            )
                          }
                        >
                          Map
                        </Button>

                      </TableCell>

                    </TableRow>

                  )
                )}

              </TableBody>

            </Table>

          </TableContainer>

        )}


        {rows.length >
          0 && (

          <Box
            mt={3}
            display="flex"
            justifyContent="flex-end"
          >

            <Button
              variant="contained"

              disabled={
                pendingCount >
                0
              }

              onClick={
                handleComplete
              }

              sx={{
                backgroundColor:
                  "#2D6A4F",

                "&:hover": {
                  backgroundColor:
                    "#1B4332",
                },
              }}
            >
              Complete Mapping
            </Button>

          </Box>

        )}

      </Paper>


      {/* ====================================================== */}
      {/* MAP DIALOG */}
      {/* ====================================================== */}

      <Dialog
        open={
          mapOpen
        }

        onClose={() =>
          setMapOpen(
            false
          )
        }

        fullWidth

        maxWidth="lg"
      >

        <DialogTitle>
          Select Field Polygon
        </DialogTitle>


        <DialogContent>

          {selectedRowId !==
            null && (

            <Box
              mb={2}
            >

              {(() => {

                const row =
                  rows.find(
                    (item) =>
                      item.id ===
                      selectedRowId
                  );

                if (!row) {
                  return null;
                }

                return (
                  <Typography
                    variant="body2"
                  >
                    <strong>
                      Farmer:
                    </strong>{" "}
                    {row.farmerName ||
                      "-"}
                    {" | "}

                    <strong>
                      Crop:
                    </strong>{" "}
                    {row.cropType ||
                      "-"}
                    {" | "}

                    <strong>
                      Season:
                    </strong>{" "}
                    {row.season ||
                      "-"}
                  </Typography>
                );

              })()}

            </Box>

          )}


          {geometry ? (

            <Box
              sx={{
                height: 480,
                width: "100%",
              }}
            >

              <MapContainer
                center={[
                  15.9,
                  79.7,
                ]}

                zoom={6}

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
                  data={
                    geometry
                  }

                  onEachFeature={
                    onEachFeature
                  }
                />

              </MapContainer>

            </Box>

          ) : (

            <Alert
              severity="warning"
            >
              KML geometry is not available.
            </Alert>

          )}


          {selectedFeatureIndex !==
            null && (

            <Alert
              severity="info"
              sx={{ mt: 2 }}
            >
              Field polygon{" "}
              {selectedFeatureIndex +
                1}{" "}
              selected.
            </Alert>

          )}

        </DialogContent>


        <DialogActions>

          <Button
            onClick={() =>
              setMapOpen(
                false
              )
            }
          >
            Close
          </Button>


          <Button
            variant="contained"

            disabled={
              selectedFeatureIndex ===
              null
            }

            onClick={
              handleConfirmMapping
            }

            sx={{
              backgroundColor:
                "#2D6A4F",

              "&:hover": {
                backgroundColor:
                  "#1B4332",
              },
            }}
          >
            Confirm Mapping
          </Button>

        </DialogActions>

      </Dialog>

    </Box>

  );
}