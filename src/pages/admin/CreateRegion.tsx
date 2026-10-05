import { useEffect, useState } from "react";
import type { ChangeEvent } from "react";

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

import { createRegion, getOrganizations } from "../../services/api";

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
    region_id?: number | string;
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

// ============================================================
// INITIAL FORM
// ============================================================

const countries = ["India", "Peru"] as const;

const statesByCountry: Record<string, string[]> = {
  India: [
    "Andhra Pradesh",
    "Arunachal Pradesh",
    "Assam",
    "Bihar",
    "Chhattisgarh",
    "Goa",
    "Gujarat",
    "Haryana",
    "Himachal Pradesh",
    "Jharkhand",
    "Karnataka",
    "Kerala",
    "Madhya Pradesh",
    "Maharashtra",
    "Manipur",
    "Meghalaya",
    "Mizoram",
    "Nagaland",
    "Odisha",
    "Punjab",
    "Rajasthan",
    "Sikkim",
    "Tamil Nadu",
    "Telangana",
    "Tripura",
    "Uttar Pradesh",
    "Uttarakhand",
    "West Bengal",
    "Andaman and Nicobar Islands",
    "Chandigarh",
    "Dadra and Nagar Haveli and Daman and Diu",
    "Delhi",
    "Jammu and Kashmir",
    "Ladakh",
    "Lakshadweep",
    "Puducherry",
  ],
  Peru: [
    "Amazonas",
    "Ancash",
    "Apurimac",
    "Arequipa",
    "Ayacucho",
    "Cajamarca",
    "Callao",
    "Cusco",
    "Huancavelica",
    "Huanuco",
    "Ica",
    "Junin",
    "La Libertad",
    "Lambayeque",
    "Lima",
    "Loreto",
    "Madre de Dios",
    "Moquegua",
    "Pasco",
    "Piura",
    "Puno",
    "San Martin",
    "Tacna",
    "Tumbes",
    "Ucayali",
  ],
};

const initialForm = {
  organizationId: "",
  name: "",
  country: "",
  state: "",
  description: "",
  area: "",
};

// ============================================================
// COMPONENT
// ============================================================

export default function CreateRegion() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);

  const [form, setForm] = useState(initialForm);

  // Base64 KML
  const [kmlFile, setKmlFile] = useState<string | null>(null);

  // Original file name
  const [fileName, setFileName] = useState("");

  const [loadingOrganizations, setLoadingOrganizations] =
    useState(true);

  const [submitting, setSubmitting] = useState(false);

  const [uploadStatus, setUploadStatus] = useState("");

  const [message, setMessage] = useState("");

  const [error, setError] = useState("");

  const [completionOpen, setCompletionOpen] = useState(false);

  const [progress, setProgress] = useState(0);

  const [processStatus, setProcessStatus] = useState<
    "pending" | "running" | "success" | "error"
  >("pending");

  const [processDetail, setProcessDetail] = useState(
    "Not started"
  );

  const [notification, setNotification] = useState<{
    open: boolean;
    message: string;
    severity: "success" | "error";
  }>({
    open: false,
    message: "",
    severity: "success",
  });

  // ============================================================
  // LOAD ORGANIZATIONS
  // ============================================================

  useEffect(() => {
    const loadOrganizations = async () => {
      try {
        const result = await getOrganizations();

        setOrganizations(result);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load organizations."
        );
      } finally {
        setLoadingOrganizations(false);
      }
    };

    void loadOrganizations();
  }, []);

  // ============================================================
  // UPDATE FORM
  // ============================================================

  const updateField = (
    field: keyof typeof form,
    value: string
  ) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  // ============================================================
  // NOTIFICATION
  // ============================================================

  const showNotification = (
    severity: "success" | "error",
    notificationMessage: string
  ) => {
    setNotification({
      open: true,
      severity,
      message: notificationMessage,
    });
  };

  // ============================================================
  // KML FILE
  // ============================================================

  const handleFile = (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const selectedFile = event.target.files?.[0];

    if (!selectedFile) {
      return;
    }

    setError("");
    setMessage("");
    setUploadStatus("");
    setKmlFile(null);
    setFileName("");

    // ----------------------------------------------------------
    // Validate extension
    // ----------------------------------------------------------

    if (
      !selectedFile.name
        .toLowerCase()
        .endsWith(".kml")
    ) {
      setError("Please select a valid KML file.");
      return;
    }

    // ----------------------------------------------------------
    // Read file as Base64
    // ----------------------------------------------------------

    const reader = new FileReader();

    reader.onload = () => {
      try {
        const result = reader.result as string;

        const base64Content = result.includes(",")
          ? result.split(",")[1]
          : result;

        if (!base64Content) {
          throw new Error(
            "Unable to read KML file."
          );
        }

        setKmlFile(base64Content);

        setFileName(selectedFile.name);

        setUploadStatus(
          "KML file is ready to upload."
        );
      } catch {
        setKmlFile(null);
        setFileName("");

        setError(
          "Unable to read the selected KML file."
        );
      }
    };

    reader.onerror = () => {
      setKmlFile(null);
      setFileName("");

      setError(
        "Unable to read the selected KML file."
      );
    };

    reader.readAsDataURL(selectedFile);
  };

  // ============================================================
  // CREATE REGION
  // ============================================================

  const handleSubmit = async () => {
    setMessage("");
    setError("");
    setCompletionOpen(false);

    // ----------------------------------------------------------
    // VALIDATE FORM
    // ----------------------------------------------------------

    if (
      Object.values(form).some(
        (value) => !String(value).trim()
      )
    ) {
      const validationError =
        "All region details are required.";

      setError(validationError);

      showNotification(
        "error",
        validationError
      );

      return;
    }

    // ----------------------------------------------------------
    // VALIDATE KML
    // ----------------------------------------------------------

    if (!kmlFile) {
      const validationError =
        "Please select a KML file.";

      setError(validationError);

      showNotification(
        "error",
        validationError
      );

      return;
    }

    // ----------------------------------------------------------
    // VALIDATE AREA
    // ----------------------------------------------------------

    const regionArea = Number(form.area);

    if (
      !Number.isFinite(regionArea) ||
      regionArea <= 0
    ) {
      const validationError =
        "Region area must be a number greater than zero.";

      setError(validationError);

      showNotification(
        "error",
        validationError
      );

      return;
    }

    // ==========================================================
    // START PROCESS
    // ==========================================================

    try {
      setSubmitting(true);

      setProgress(25);

      setProcessStatus("running");

      setProcessDetail(
        "Sending region and KML to AWS..."
      );

      setUploadStatus(
        "Creating region and processing KML..."
      );

      // ========================================================
      // SINGLE API CALL
      // ========================================================

      const result =
        (await createRegion({
          organization_id:
            Number(form.organizationId),

          name: form.name.trim(),

          country: form.country,

          state: form.state,

          description:
            form.description.trim(),

          region_area: regionArea,

          kml_file_name: fileName,

          kml_file_content: kmlFile,
        })) as CreateRegionResponse;

      // ========================================================
      // SUCCESS
      // ========================================================

      setProgress(100);

      setProcessStatus("success");

      const regionId =
        result?.region?.region_id;

      const fieldCount =
        result?.fields?.count ?? 0;

      const successDetail = regionId
        ? `Region ID ${regionId} created successfully. ${fieldCount} field geometry record(s) imported.`
        : `Region created successfully. ${fieldCount} field geometry record(s) imported.`;

      setProcessDetail(successDetail);

      setMessage(
        "Region and KML processed successfully."
      );

      setUploadStatus(
        "Region creation and KML processing completed."
      );

      showNotification(
        "success",
        successDetail
      );

      setCompletionOpen(true);

      // --------------------------------------------------------
      // Reset form
      // --------------------------------------------------------

      setForm(initialForm);

      setKmlFile(null);

      setFileName("");
    } catch (submitError: unknown) {
      // ========================================================
      // ERROR
      // ========================================================

      setProgress(75);

      setProcessStatus("error");

      const detail =
        submitError instanceof Error
          ? submitError.message
          : typeof submitError === "object" &&
              submitError &&
              "message" in submitError
            ? String(
                (
                  submitError as {
                    message?: unknown;
                  }
                ).message
              )
            : "Failed to create region.";

      setProcessDetail(detail);

      setError(detail);

      setUploadStatus("");

      showNotification(
        "error",
        detail
      );

      setCompletionOpen(true);
    } finally {
      setSubmitting(false);
    }
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

        {/* ERROR */}

        {error && (
          <Alert
            severity="error"
            sx={{ mb: 2 }}
          >
            {error}
          </Alert>
        )}

        {/* SUCCESS */}

        {message && (
          <Alert
            severity="success"
            sx={{ mb: 2 }}
          >
            {message}
          </Alert>
        )}

        {/* ORGANIZATION */}

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
            value={form.organizationId}
            label="Organisation ID"
            onChange={(event) =>
              updateField(
                "organizationId",
                event.target.value
              )
            }
          >
            {organizations.map(
              (organization) => (
                <MenuItem
                  key={organization.id}
                  value={organization.id}
                >
                  {organization.id} —{" "}
                  {organization.name}
                </MenuItem>
              )
            )}
          </Select>
        </FormControl>

        {/* REGION NAME */}

        <TextField
          label="Region Name"
          fullWidth
          required
          disabled={submitting}
          sx={{ mb: 2 }}
          value={form.name}
          onChange={(event) =>
            updateField(
              "name",
              event.target.value
            )
          }
        />

        {/* COUNTRY */}

        <FormControl
          fullWidth
          required
          sx={{ mb: 2 }}
          disabled={submitting}
        >
          <InputLabel>
            Country
          </InputLabel>

          <Select
            value={form.country}
            label="Country"
            onChange={(event) => {
              updateField(
                "country",
                event.target.value
              );

              updateField(
                "state",
                ""
              );
            }}
          >
            {countries.map((country) => (
              <MenuItem
                key={country}
                value={country}
              >
                {country}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* STATE */}

        <FormControl
          fullWidth
          required
          sx={{ mb: 2 }}
          disabled={
            submitting ||
            !form.country
          }
        >
          <InputLabel>
            State
          </InputLabel>

          <Select
            value={form.state}
            label="State"
            onChange={(event) =>
              updateField(
                "state",
                event.target.value
              )
            }
          >
            {(statesByCountry[
              form.country
            ] ?? []).map((state) => (
              <MenuItem
                key={state}
                value={state}
              >
                {state}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* DESCRIPTION */}

        <TextField
          label="Description"
          fullWidth
          required
          multiline
          rows={3}
          disabled={submitting}
          sx={{ mb: 2 }}
          value={form.description}
          onChange={(event) =>
            updateField(
              "description",
              event.target.value
            )
          }
        />

        {/* AREA */}

        <TextField
          label="Region Area"
          fullWidth
          required
          type="number"
          disabled={submitting}
          inputProps={{
            min: 0,
            step: "any",
          }}
          helperText="Enter the area in the unit required by the backend."
          sx={{ mb: 3 }}
          value={form.area}
          onChange={(event) =>
            updateField(
              "area",
              event.target.value
            )
          }
        />

        {/* KML */}

        <Box sx={{ mb: 2 }}>
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
            disabled={submitting}
          >
            Upload KML

            <input
              hidden
              required
              type="file"
              accept=".kml,application/vnd.google-earth.kml+xml"
              onChange={handleFile}
            />
          </Button>

          {fileName && (
            <Typography
              variant="body2"
              sx={{ mt: 1 }}
            >
              Selected file: {fileName}
            </Typography>
          )}
        </Box>

        {/* PROCESS STATUS */}

        {processStatus !== "pending" && (
          <Box sx={{ mb: 2 }}>
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
              value={progress}
              color={
                processStatus === "error"
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
              {processDetail}
            </Typography>
          </Box>
        )}

        {/* STATUS */}

        {uploadStatus && (
          <Alert
            severity="info"
            sx={{ mb: 2 }}
          >
            {uploadStatus}
          </Alert>
        )}

        {/* CREATE BUTTON */}

        <Button
          variant="contained"
          fullWidth
          onClick={handleSubmit}
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

      {/* COMPLETION DIALOG */}

      <Dialog
        open={completionOpen}
        onClose={() =>
          setCompletionOpen(false)
        }
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          {processStatus === "success"
            ? "Region Process Completed"
            : "Region Process Failed"}
        </DialogTitle>

        <DialogContent>
          <Alert
            severity={
              processStatus === "success"
                ? "success"
                : "error"
            }
          >
            <Typography fontWeight="bold">
              uploadRegion Lambda:{" "}
              {processStatus}
            </Typography>

            {processDetail}
          </Alert>
        </DialogContent>

        <DialogActions>
          <Button
            onClick={() =>
              setCompletionOpen(false)
            }
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* SNACKBAR */}

      <Snackbar
        open={notification.open}
        autoHideDuration={6000}
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
          severity={notification.severity}
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
          {notification.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}