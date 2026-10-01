import {
  useEffect,
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
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  TextField,
  Typography,
} from "@mui/material";
import * as toGeoJSON from "@tmcw/togeojson";
import {
  createRegion,
  getOrganizations,
} from "../../services/api";
// ============================================================
// TYPES
// ============================================================
interface Organization {
  id: number;
  name: string;
}
interface CreateRegionResponse {
  success?: boolean;
  message?: string;
  region?: {
    region_id?:
      | number
      | string;
    name?: string;
  };
  kml?: {
    bucket?: string;
    s3_key?: string;
    s3_uri?: string;
    file_name?: string;
    file_size?: number;
  };
  fields?: {
    count?: number;
  };
}
interface CreateRegionProps {
  onGoToCropDetails: (
    regionId:
      | number
      | string,
    regionName: string
  ) => void;
}
const initialForm = {
  organizationId: "",
  name: "",
  description: "",
  area: "",
};
// ============================================================
// BASE64
// ============================================================
const fileToBase64 = (
  file: File
): Promise<string> => {
  return new Promise(
    (resolve, reject) => {
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
              "Unable to read KML file."
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
              "Unable to read KML file."
            )
          );
          return;
        }
        resolve(base64);
      };
      reader.onerror =
        () =>
          reject(
            new Error(
              "Unable to read KML file."
            )
          );
      reader.readAsDataURL(
        file
      );
    }
  );
};
// ============================================================
// COMPONENT
// ============================================================
export default function CreateRegion({
  onGoToCropDetails,
}: CreateRegionProps) {
  const [
    organizations,
    setOrganizations,
  ] =
    useState<
      Organization[]
    >([]);
  const [
    form,
    setForm,
  ] =
    useState(
      initialForm
    );
  const [
    kmlFile,
    setKmlFile,
  ] =
    useState<
      string | null
    >(null);
  const [
    fileName,
    setFileName,
  ] =
    useState("");
  // Local GeoJSON copy only for Stage 2 map.
  // Backend API stays unchanged.
  const [
    geometry,
    setGeometry,
  ] =
    useState("");
  const [
    loadingOrganizations,
    setLoadingOrganizations,
  ] =
    useState(true);
  const [
    submitting,
    setSubmitting,
  ] =
    useState(false);
  const [
    uploadStatus,
    setUploadStatus,
  ] =
    useState("");
  const [
    message,
    setMessage,
  ] =
    useState("");
  const [
    error,
    setError,
  ] =
    useState("");
  const [
    completionOpen,
    setCompletionOpen,
  ] =
    useState(false);
  const [
    progress,
    setProgress,
  ] =
    useState(0);
  const [
    processStatus,
    setProcessStatus,
  ] =
    useState<
      | "pending"
      | "running"
      | "success"
      | "error"
    >("pending");
  const [
    processDetail,
    setProcessDetail,
  ] =
    useState(
      "Not started"
    );
  // Save the region returned by AWS.
  // Used when user clicks CLOSE.
  const [
    createdRegion,
    setCreatedRegion,
  ] =
    useState<{
      id:
        | string
        | number;
      name: string;
    } | null>(null);
  const [
    notification,
    setNotification,
  ] =
    useState<{
      open: boolean;
      message: string;
      severity:
        | "success"
        | "error";
    }>({
      open: false,
      message: "",
      severity:
        "success",
    });
  // ============================================================
  // ORGANIZATIONS
  // ============================================================
  useEffect(() => {
    const loadOrganizations =
      async () => {
        try {
          const result =
            await getOrganizations();
          setOrganizations(
            result
          );
        } catch (
          loadError
        ) {
          setError(
            loadError instanceof
              Error
              ? loadError.message
              : "Failed to load organizations."
          );
        } finally {
          setLoadingOrganizations(
            false
          );
        }
      };
    void loadOrganizations();
  }, []);
  const updateField = (
    field:
      keyof typeof form,
    value: string
  ) => {
    setForm(
      (current) => ({
        ...current,
        [field]:
          value,
      })
    );
  };
  const showNotification = (
    severity:
      | "success"
      | "error",
    text: string
  ) => {
    setNotification({
      open: true,
      severity,
      message: text,
    });
  };
  // ============================================================
  // KML FILE
  // ============================================================
  const handleFile = async (
    event:
      ChangeEvent<HTMLInputElement>
  ) => {
    const selectedFile =
      event.target
        .files?.[0];
    if (!selectedFile) {
      return;
    }
    setError("");
    setMessage("");
    setUploadStatus("");
    setKmlFile(null);
    setFileName("");
    setGeometry("");
    if (
      !selectedFile.name
        .toLowerCase()
        .endsWith(".kml")
    ) {
      setError(
        "Please select a valid KML file."
      );
      return;
    }
    try {
      // --------------------------------------------------------
      // SAME BASE64 USED BY WORKING AWS FLOW
      // --------------------------------------------------------
      const base64 =
        await fileToBase64(
          selectedFile
        );
      // --------------------------------------------------------
      // LOCAL GEOMETRY COPY FOR STAGE 2 MAP
      // --------------------------------------------------------
      const kmlText =
        await selectedFile.text();
      const xml =
        new DOMParser()
          .parseFromString(
            kmlText,
            "application/xml"
          );
      if (
        xml.querySelector(
          "parsererror"
        )
      ) {
        throw new Error(
          "Invalid KML XML."
        );
      }
      const geoJson =
        toGeoJSON.kml(xml);
      if (
        !geoJson.features ||
        geoJson.features
          .length === 0
      ) {
        throw new Error(
          "No field geometry found in the KML."
        );
      }
      setKmlFile(
        base64
      );
      setFileName(
        selectedFile.name
      );
      setGeometry(
        JSON.stringify(
          geoJson
        )
      );
      setUploadStatus(
        `KML ready. ${geoJson.features.length} field geometry feature(s) detected.`
      );
    } catch (
      fileError
    ) {
      console.error(
        fileError
      );
      setKmlFile(null);
      setFileName("");
      setGeometry("");
      setError(
        fileError instanceof
          Error
          ? fileError.message
          : "Unable to read KML file."
      );
    }
  };
  // ============================================================
  // CREATE REGION
  // ============================================================
  const handleSubmit =
    async () => {
      setMessage("");
      setError("");
      setCompletionOpen(
        false
      );
      setCreatedRegion(
        null
      );
      // --------------------------------------------------------
      // VALIDATION
      // --------------------------------------------------------
      if (
        Object.values(
          form
        ).some(
          (value) =>
            !String(
              value
            ).trim()
        )
      ) {
        const text =
          "All region details are required.";
        setError(text);
        showNotification(
          "error",
          text
        );
        return;
      }
      if (
        !kmlFile ||
        !geometry
      ) {
        const text =
          "Please select a valid KML file.";
        setError(text);
        showNotification(
          "error",
          text
        );
        return;
      }
      const regionArea =
        Number(
          form.area
        );
      if (
        !Number.isFinite(
          regionArea
        ) ||
        regionArea <= 0
      ) {
        const text =
          "Region area must be a number greater than zero.";
        setError(text);
        showNotification(
          "error",
          text
        );
        return;
      }
      try {
        setSubmitting(
          true
        );
        setProgress(
          25
        );
        setProcessStatus(
          "running"
        );
        setProcessDetail(
          "Sending region and KML to AWS..."
        );
        setUploadStatus(
          "Creating region and processing KML..."
        );
        // ======================================================
        // IMPORTANT
        // SAME WORKING API CALL
        // DO NOT CHANGE THIS PAYLOAD
        // ======================================================
        const result =
          (await createRegion({
            organization_id:
              Number(
                form.organizationId
              ),
            name:
              form.name.trim(),
            description:
              form.description.trim(),
            region_area:
              regionArea,
            kml_file_name:
              fileName,
            kml_file_content:
              kmlFile,
          })) as CreateRegionResponse;
        // ======================================================
        // SUCCESS
        // ======================================================
        if (result?.success === false) {
          throw new Error(result.message || "Region creation failed.");
        }
        const regionId =
          result?.region
            ?.region_id;
        if (
          regionId ===
            undefined ||
          regionId ===
            null
        ) {
          throw new Error(
            "Region was created but region_id was not returned."
          );
        }
        const regionName =
          result?.region
            ?.name ||
          form.name.trim();
        const fieldCount =
          result?.fields
            ?.count ?? 0;
        setCreatedRegion({
          id: regionId,
          name:
            regionName,
        });
        // ------------------------------------------------------
        // Store selected region for Stage 2
        // ------------------------------------------------------
        try {
        localStorage.setItem(
          "pendingCropRegion",
          JSON.stringify({
            regionId:
              String(
                regionId
              ),
            regionName,
          })
        );
        } catch (storageError) {
          console.warn("Unable to remember selected region:", storageError);
        }
        // ------------------------------------------------------
        // Store KML geometry for Stage 2 map.
        // Database remains AWS responsibility.
        // ------------------------------------------------------
        try {
          localStorage.setItem(
            `regionGeometry:${regionId}`,
            geometry
          );
        } catch (
          storageError
        ) {
          console.warn(
            "Unable to store local geometry:",
            storageError
          );
        }
        setProgress(
          100
        );
        setProcessStatus(
          "success"
        );
        const detail =
          `Region ID ${regionId} created successfully. ` +
          `${fieldCount} field geometry record(s) imported.`;
        setProcessDetail(
          detail
        );
        setMessage(
          "Region and KML processed successfully."
        );
        setUploadStatus(
          "Region creation and KML processing completed."
        );
        showNotification(
          "success",
          detail
        );
        setCompletionOpen(
          true
        );
        // Form can now reset.
        // createdRegion and localStorage remain.
        setForm(
          initialForm
        );
        setKmlFile(null);
        setFileName("");
        setGeometry("");
      } catch (
        submitError:
          unknown
      ) {
        setProgress(
          75
        );
        setProcessStatus(
          "error"
        );
        const detail =
          submitError instanceof
            Error
            ? submitError.message
            : typeof submitError ===
                  "object" &&
                submitError &&
                "message" in
                  submitError
              ? String(
                  (
                    submitError as {
                      message?: unknown;
                    }
                  ).message
                )
              : "Failed to create region.";
        setProcessDetail(
          detail
        );
        setError(
          detail
        );
        setUploadStatus(
          ""
        );
        showNotification(
          "error",
          detail
        );
        setCompletionOpen(
          true
        );
      } finally {
        setSubmitting(
          false
        );
      }
    };
  // ============================================================
  // POPUP CLOSE
  //
  // Close dismisses; Upload Crop Details navigates explicitly.
  // ============================================================
  const handleCompletionClose = () => {
    setCompletionOpen(false);
  };
  const handleUploadCropDetails = () => {
    if (processStatus !== "success" || !createdRegion) return;
    setCompletionOpen(false);
    onGoToCropDetails(createdRegion.id, createdRegion.name);
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
          mb={3}
        >
          📍 Create Region
        </Typography>
        {error && (
          <Alert
            severity="error"
            sx={{ mb: 2 }}
          >
            {error}
          </Alert>
        )}
        {message && (
          <Alert
            severity="success"
            sx={{ mb: 2 }}
          >
            {message}
          </Alert>
        )}
        <FormControl
          fullWidth
          required
          sx={{ mb: 2 }}
          disabled={
            loadingOrganizations ||
            submitting
          }
        >
          <InputLabel>
            Organisation ID
          </InputLabel>
          <Select
            value={
              form.organizationId
            }
            label="Organisation ID"
            onChange={(
              event
            ) =>
              updateField(
                "organizationId",
                String(
                  event.target
                    .value
                )
              )
            }
          >
            {organizations.map(
              (
                organization
              ) => (
                <MenuItem
                  key={
                    organization.id
                  }
                  value={
                    organization.id
                  }
                >
                  {
                    organization.id
                  }{" "}
                  —{" "}
                  {
                    organization.name
                  }
                </MenuItem>
              )
            )}
          </Select>
        </FormControl>
        <TextField
          label="Region Name"
          fullWidth
          required
          disabled={
            submitting
          }
          sx={{ mb: 2 }}
          value={
            form.name
          }
          onChange={(
            event
          ) =>
            updateField(
              "name",
              event.target.value
            )
          }
        />
        <TextField
          label="Description"
          fullWidth
          required
          multiline
          rows={3}
          disabled={
            submitting
          }
          sx={{ mb: 2 }}
          value={
            form.description
          }
          onChange={(
            event
          ) =>
            updateField(
              "description",
              event.target.value
            )
          }
        />
        <TextField
          label="Region Area"
          fullWidth
          required
          type="number"
          disabled={
            submitting
          }
          inputProps={{
            min: 0,
            step: "any",
          }}
          helperText="Enter the area in the unit required by the backend."
          sx={{ mb: 3 }}
          value={
            form.area
          }
          onChange={(
            event
          ) =>
            updateField(
              "area",
              event.target.value
            )
          }
        />
        <Box
          sx={{ mb: 2 }}
        >
          <Typography
            variant="subtitle1"
            fontWeight="medium"
            mb={1}
          >
            Region KML *
          </Typography>
          <Button
            component="label"
            variant="outlined"
            fullWidth
            disabled={
              submitting
            }
          >
            Upload KML
            <input
              hidden
              required
              type="file"
              accept=".kml,application/vnd.google-earth.kml+xml"
              onChange={
                handleFile
              }
            />
          </Button>
          {fileName && (
            <Typography
              variant="body2"
              sx={{ mt: 1 }}
            >
              Selected file:{" "}
              {fileName}
            </Typography>
          )}
        </Box>
        {processStatus !==
          "pending" && (
          <Box
            sx={{ mb: 2 }}
          >
            <Box
              display="flex"
              justifyContent="space-between"
              mb={0.75}
            >
              <Typography
                variant="body2"
                fontWeight="medium"
              >
                Region processing
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
              >
                {progress}%
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={
                progress
              }
              color={
                processStatus ===
                "error"
                  ? "error"
                  : "primary"
              }
              sx={{
                height: 8,
                borderRadius: 1,
                mb: 1,
              }}
            />
            <Typography
              variant="caption"
              color="text.secondary"
              display="block"
            >
              {
                processDetail
              }
            </Typography>
          </Box>
        )}
        {uploadStatus && (
          <Alert
            severity="info"
            sx={{ mb: 2 }}
          >
            {
              uploadStatus
            }
          </Alert>
        )}
        <Button
          variant="contained"
          fullWidth
          onClick={
            handleSubmit
          }
          disabled={
            submitting ||
            loadingOrganizations
          }
        >
          {submitting ? (
            <CircularProgress
              size={24}
              color="inherit"
            />
          ) : (
            "Create Region"
          )}
        </Button>
      </Paper>
      {/* SUCCESS / ERROR POPUP */}
      <Dialog
        open={
          completionOpen
        }
        onClose={
          handleCompletionClose
        }
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          {processStatus ===
          "success"
            ? "Region Process Completed"
            : "Region Process Failed"}
        </DialogTitle>
        <DialogContent>
          <Alert
            severity={
              processStatus ===
              "success"
                ? "success"
                : "error"
            }
          >
            <Typography
              fontWeight="bold"
            >
              uploadRegion
              Lambda:{" "}
              {
                processStatus
              }
            </Typography>
            {
              processDetail
            }
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={
              handleCompletionClose
            }
          >
            CLOSE
          </Button>
          {processStatus === "success" && createdRegion && (
            <Button variant="contained" onClick={handleUploadCropDetails}>
              Upload Crop Details
            </Button>
          )}
        </DialogActions>
      </Dialog>
      <Snackbar
        open={
          notification.open
        }
        autoHideDuration={
          6000
        }
        onClose={() =>
          setNotification(
            (current) => ({
              ...current,
              open: false,
            })
          )
        }
      >
        <Alert
          severity={
            notification.severity
          }
          variant="filled"
          onClose={() =>
            setNotification(
              (current) => ({
                ...current,
                open: false,
              })
            )
          }
        >
          {
            notification.message
          }
        </Alert>
      </Snackbar>
    </Box>
  );
}
