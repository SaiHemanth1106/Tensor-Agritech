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
  TextField,
  Typography,
} from "@mui/material";

import * as toGeoJSON from "@tmcw/togeojson";

import {
  getOrganizations,
} from "../../services/api";


// ============================================================
// TYPES
// ============================================================

interface Organization {
  id: number;
  name: string;
}

interface RegionInfo {
  regionId: string;
  organizationId: string;
  country: string;
  state: string;
  name: string;
  description?: string;
}

interface CreateFieldProps {
  onGoToCropDetails: (
    regionId: string | number,
    regionName: string
  ) => void;
}


// ============================================================
// STORAGE KEY
// ============================================================

const REGION_STORAGE_KEY =
  "frontendStaticRegions";


// ============================================================
// COMPONENT
// ============================================================

export default function CreateField({
  onGoToCropDetails,
}: CreateFieldProps) {

  const [
    organizations,
    setOrganizations,
  ] = useState<Organization[]>([]);

  const [
    regions,
    setRegions,
  ] = useState<RegionInfo[]>([]);

  const [
    selectedRegionId,
    setSelectedRegionId,
  ] = useState("");

  const [
    loadingOrganizations,
    setLoadingOrganizations,
  ] = useState(true);

  const [
    processingKml,
    setProcessingKml,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    successOpen,
    setSuccessOpen,
  ] = useState(false);

  const [
    kmlFileName,
    setKmlFileName,
  ] = useState("");

  const [
    fieldCount,
    setFieldCount,
  ] = useState(0);


  // ============================================================
  // LOAD ORGANIZATIONS
  // ============================================================

  useEffect(() => {

    const loadOrganizations =
      async () => {

        try {

          const result =
            await getOrganizations();

          if (
            Array.isArray(result)
          ) {
            setOrganizations(
              result
            );
          } else if (
            Array.isArray(
              (result as any)
                ?.organizations
            )
          ) {
            setOrganizations(
              (result as any)
                .organizations
            );
          } else if (
            Array.isArray(
              (result as any)
                ?.data
            )
          ) {
            setOrganizations(
              (result as any)
                .data
            );
          } else {
            setOrganizations([]);
          }

        } catch (
          loadError
        ) {

          console.error(
            "Unable to load organizations:",
            loadError
          );

        } finally {

          setLoadingOrganizations(
            false
          );

        }

      };

    void loadOrganizations();

  }, []);


  // ============================================================
  // LOAD REGIONS CREATED IN CREATE REGION
  // ============================================================

  useEffect(() => {

    try {

      const stored =
        localStorage.getItem(
          REGION_STORAGE_KEY
        );

      if (!stored) {

        setRegions([]);

        setError(
          "No region found. Please create a region first."
        );

        return;
      }

      const parsed =
        JSON.parse(stored);

      if (
        !Array.isArray(parsed) ||
        parsed.length === 0
      ) {

        setRegions([]);

        setError(
          "No region found. Please create a region first."
        );

        return;
      }


      const validRegions:
        RegionInfo[] =
        parsed.map(
          (region: any) => ({
            regionId:
              String(
                region.regionId ??
                region.region_id ??
                region.id ??
                ""
              ),

            organizationId:
              String(
                region.organizationId ??
                region.organization_id ??
                ""
              ),

            country:
              String(
                region.country ??
                ""
              ),

            state:
              String(
                region.state ??
                ""
              ),

            name:
              String(
                region.name ??
                region.regionName ??
                ""
              ),

            description:
              String(
                region.description ??
                ""
              ),
          })
        );


      setRegions(
        validRegions
      );


      // ========================================================
      // AUTOMATICALLY SELECT LAST CREATED REGION
      // ========================================================

      const lastRegion =
        validRegions[
          validRegions.length - 1
        ];

      if (lastRegion) {

        setSelectedRegionId(
          lastRegion.regionId
        );

        setError("");

      }

    } catch (
      storageError
    ) {

      console.error(
        storageError
      );

      setRegions([]);

      setError(
        "Unable to load created region details."
      );

    }

  }, []);


  // ============================================================
  // SELECTED REGION
  // ============================================================

  const selectedRegion =
    useMemo(() => {

      return (
        regions.find(
          (region) =>
            String(
              region.regionId
            ) ===
            String(
              selectedRegionId
            )
        ) ?? null
      );

    }, [
      regions,
      selectedRegionId,
    ]);


  // ============================================================
  // ORGANIZATION NAME
  // ============================================================

  const selectedOrganization =
    useMemo(() => {

      if (!selectedRegion) {
        return null;
      }

      return (
        organizations.find(
          (organization) =>
            String(
              organization.id
            ) ===
            String(
              selectedRegion
                .organizationId
            )
        ) ?? null
      );

    }, [
      organizations,
      selectedRegion,
    ]);


  // ============================================================
  // KML UPLOAD
  // ============================================================

  const handleKmlUpload =
    async (
      event:
        ChangeEvent<HTMLInputElement>
    ) => {

      const file =
        event.target.files?.[0];

      event.target.value = "";

      setError("");

      if (!file) {
        return;
      }


      if (!selectedRegion) {

        setError(
          "Region details are not available."
        );

        return;
      }


      if (
        !file.name
          .toLowerCase()
          .endsWith(".kml")
      ) {

        setError(
          "Please select a valid KML file."
        );

        return;
      }


      try {

        setProcessingKml(
          true
        );


        // ======================================================
        // READ KML
        // ======================================================

        const kmlText =
          await file.text();


        const xml =
          new DOMParser()
            .parseFromString(
              kmlText,
              "text/xml"
            );


        if (
          xml.querySelector(
            "parsererror"
          )
        ) {

          throw new Error(
            "Invalid KML file."
          );

        }


        const geoJson =
          toGeoJSON.kml(
            xml
          );


        if (
          !geoJson.features ||
          geoJson.features
            .length === 0
        ) {

          throw new Error(
            "No field polygons found in the KML file."
          );

        }


        // ======================================================
        // SAVE GEOMETRY LOCALLY
        // ======================================================

        localStorage.setItem(

          `regionGeometry:${selectedRegion.regionId}`,

          JSON.stringify(
            geoJson
          )

        );


        // ======================================================
        // SAVE CURRENT REGION FOR CROP PAGE
        // ======================================================

        localStorage.setItem(

          "pendingCropRegion",

          JSON.stringify({
            regionId:
              selectedRegion.regionId,

            regionName:
              selectedRegion.name,

            organizationId:
              selectedRegion
                .organizationId,

            country:
              selectedRegion.country,

            state:
              selectedRegion.state,
          })

        );


        localStorage.setItem(

          "frontendFieldInfo",

          JSON.stringify({
            regionId:
              selectedRegion.regionId,

            regionName:
              selectedRegion.name,

            organizationId:
              selectedRegion
                .organizationId,

            country:
              selectedRegion.country,

            state:
              selectedRegion.state,

            kmlFileName:
              file.name,

            fieldCount:
              geoJson.features.length,
          })

        );


        setKmlFileName(
          file.name
        );

        setFieldCount(
          geoJson.features.length
        );


        // ======================================================
        // NO AUTOMATIC REDIRECT
        // ======================================================

        setSuccessOpen(
          true
        );

      } catch (
        uploadError
      ) {

        console.error(
          uploadError
        );

        setError(
          uploadError instanceof Error
            ? uploadError.message
            : "Unable to process KML file."
        );

      } finally {

        setProcessingKml(
          false
        );

      }

    };


  // ============================================================
  // UPLOAD CROP DETAILS BUTTON
  // ============================================================

  const handleGoToCropDetails =
    () => {

      if (!selectedRegion) {
        return;
      }

      setSuccessOpen(
        false
      );

      onGoToCropDetails(
        selectedRegion.regionId,
        selectedRegion.name
      );

    };


  // ============================================================
  // UI
  // ============================================================

  return (

    <Box
      maxWidth={650}
      mx="auto"
    >

      <Paper
        elevation={3}
        sx={{
          p: 4,
          borderRadius: 3,
        }}
      >

        <Typography
          variant="h5"
          fontWeight="bold"
          mb={1}
        >
          🌱 Create Field
        </Typography>

        <Typography
          variant="body2"
          color="text.secondary"
          mb={3}
        >
          Region details are automatically loaded from the region you created.
        </Typography>


        {error && (

          <Alert
            severity="error"
            sx={{ mb: 2 }}
          >
            {error}
          </Alert>

        )}


        {/* ==================================================== */}
        {/* REGION */}
        {/* AUTO SELECTED */}
        {/* USER CAN CHANGE REGION ONLY IF REQUIRED */}
        {/* ==================================================== */}

        <FormControl
          fullWidth
          sx={{ mb: 2 }}
          disabled={
            regions.length === 0
          }
        >

          <InputLabel>
            Region
          </InputLabel>

          <Select
            label="Region"

            value={
              selectedRegionId
            }

            onChange={(
              event
            ) => {

              setSelectedRegionId(
                String(
                  event.target.value
                )
              );

            }}
          >

            {regions.map(
              (region) => (

                <MenuItem
                  key={
                    region.regionId
                  }

                  value={
                    region.regionId
                  }
                >
                  {region.name}
                </MenuItem>

              )
            )}

          </Select>

        </FormControl>


        {/* ==================================================== */}
        {/* ORGANISATION AUTO FILLED */}
        {/* ==================================================== */}

        <TextField
          fullWidth
          label="Organisation"
          sx={{ mb: 2 }}
          disabled

          value={
            loadingOrganizations
              ? "Loading..."
              : selectedOrganization
                ? `${selectedOrganization.id} — ${selectedOrganization.name}`
                : selectedRegion?.organizationId ?? ""
          }

          InputProps={{
            readOnly: true,
          }}
        />


        {/* ==================================================== */}
        {/* COUNTRY AUTO FILLED */}
        {/* ==================================================== */}

        <TextField
          fullWidth
          label="Country"
          sx={{ mb: 2 }}
          disabled

          value={
            selectedRegion?.country ??
            ""
          }

          InputProps={{
            readOnly: true,
          }}
        />


        {/* ==================================================== */}
        {/* STATE AUTO FILLED */}
        {/* ==================================================== */}

        <TextField
          fullWidth
          label="State"
          sx={{ mb: 3 }}
          disabled

          value={
            selectedRegion?.state ??
            ""
          }

          InputProps={{
            readOnly: true,
          }}
        />


        {/* ==================================================== */}
        {/* KML */}
        {/* ==================================================== */}

        <Button
          component="label"

          variant="contained"

          fullWidth

          disabled={
            !selectedRegion ||
            processingKml
          }

          sx={{
            py: 1.3,

            backgroundColor:
              "#2D6A4F",

            "&:hover": {
              backgroundColor:
                "#1B4332",
            },
          }}
        >

          {processingKml
            ? "Processing KML..."
            : "Upload KML"}

          <input
            hidden
            type="file"

            accept=".kml,application/vnd.google-earth.kml+xml"

            onChange={
              handleKmlUpload
            }
          />

        </Button>


        {processingKml && (

          <Box
            mt={2}
            display="flex"
            justifyContent="center"
          >

            <CircularProgress
              size={26}
            />

          </Box>

        )}

      </Paper>


      {/* ====================================================== */}
      {/* KML SUCCESS POPUP */}
      {/* ====================================================== */}

      <Dialog
        open={
          successOpen
        }

        onClose={() =>
          setSuccessOpen(
            false
          )
        }

        fullWidth
        maxWidth="sm"
      >

        <DialogTitle>
          KML Uploaded Successfully
        </DialogTitle>


        <DialogContent>

          <Alert
            severity="success"
            sx={{
              mt: 1,
              mb: 2,
            }}
          >
            Field KML processed successfully.
          </Alert>


          <Typography
            mb={1}
          >
            <strong>
              Region:
            </strong>{" "}
            {selectedRegion?.name}
          </Typography>


          <Typography
            mb={1}
          >
            <strong>
              Country:
            </strong>{" "}
            {selectedRegion?.country}
          </Typography>


          <Typography
            mb={1}
          >
            <strong>
              State:
            </strong>{" "}
            {selectedRegion?.state}
          </Typography>


          <Typography
            mb={1}
          >
            <strong>
              KML File:
            </strong>{" "}
            {kmlFileName}
          </Typography>


          <Typography>
            <strong>
              Fields detected:
            </strong>{" "}
            {fieldCount}
          </Typography>

        </DialogContent>


        <DialogActions>

          <Button
            onClick={() =>
              setSuccessOpen(
                false
              )
            }
          >
            Close
          </Button>


          <Button
            variant="contained"

            onClick={
              handleGoToCropDetails
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
            Upload Crop Details
          </Button>

        </DialogActions>

      </Dialog>

    </Box>

  );
}