import { useEffect, useState } from "react";
import type { ChangeEvent } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
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
import { getOrganizations } from "../../services/api";

interface Organization {
  id: number;
  name: string;
}

const CreateRegion = () => {
  const [organizations, setOrganizations] = useState<Organization[]>([]);

  const [form, setForm] = useState({
    organizationId: "",
    name: "",
    description: "",
    area: "",
  });

  const [kmlFile, setKmlFile] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [geometry, setGeometry] = useState<unknown>(null);

  const [loadingOrganizations, setLoadingOrganizations] =
    useState(true);

  const [submitting, setSubmitting] = useState(false);

  const [uploadStatus, setUploadStatus] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [notification, setNotification] = useState({
    open: false,
    message: "",
    severity: "success" as
      | "success"
      | "error"
      | "info"
      | "warning",
  });

  // ==============================
  // STEP 2
  // ==============================
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);

  const [createdRegionName, setCreatedRegionName] =
    useState("");

  const [cropExcelFile, setCropExcelFile] =
    useState<string | null>(null);

  const [cropExcelFileName, setCropExcelFileName] =
    useState("");

  const [uploadingCropDetails, setUploadingCropDetails] =
    useState(false);

  const [cropUploadError, setCropUploadError] =
    useState("");

  const [cropUploadSuccess, setCropUploadSuccess] =
    useState("");

  // ==============================
  // LOAD ORGANIZATIONS
  // ==============================
  useEffect(() => {
    const loadOrganizations = async () => {
      try {
        setLoadingOrganizations(true);

        const response = await getOrganizations();

        const data = Array.isArray(response)
          ? response
          : response?.data ||
            response?.organizations ||
            [];

        setOrganizations(data);
      } catch (err) {
        console.error(
          "Failed to load organizations:",
          err
        );

        setError("Failed to load organizations.");
      } finally {
        setLoadingOrganizations(false);
      }
    };

    loadOrganizations();
  }, []);

  // ==============================
  // FORM UPDATE
  // ==============================
  const updateField = (
    field: string,
    value: string
  ) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // ==============================
  // NOTIFICATION
  // ==============================
  const showNotification = (
    msg: string,
    severity:
      | "success"
      | "error"
      | "info"
      | "warning" = "success"
  ) => {
    setNotification({
      open: true,
      message: msg,
      severity,
    });
  };

  // ==============================
  // KML HANDLER
  // ==============================
  const handleFile = async (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setError("");
    setMessage("");
    setUploadStatus("");

    if (!file.name.toLowerCase().endsWith(".kml")) {
      setError("Please upload a valid KML file.");
      return;
    }

    try {
      const reader = new FileReader();

      reader.onload = async () => {
        try {
          const result = reader.result;

          if (typeof result !== "string") {
            throw new Error(
              "Unable to read KML file."
            );
          }

          const base64 = result.split(",")[1];

          if (!base64) {
            throw new Error("Invalid KML file.");
          }

          const textReader = new FileReader();

          textReader.onload = () => {
            try {
              const text = String(
                textReader.result
              );

              const parser = new DOMParser();

              const xml =
                parser.parseFromString(
                  text,
                  "application/xml"
                );

              const parseError =
                xml.querySelector(
                  "parsererror"
                );

              if (parseError) {
                throw new Error(
                  "Invalid KML XML format."
                );
              }

              const geojson =
                toGeoJSON.kml(xml);

              if (
                !geojson ||
                !geojson.features ||
                geojson.features.length === 0
              ) {
                throw new Error(
                  "No geographic features found in the KML file."
                );
              }

              setKmlFile(base64);
              setFileName(file.name);
              setGeometry(geojson);

              setUploadStatus(
                "KML file selected successfully."
              );
            } catch (err) {
              console.error(
                "KML parsing error:",
                err
              );

              setError(
                err instanceof Error
                  ? err.message
                  : "Failed to process KML file."
              );

              setKmlFile(null);
              setFileName("");
              setGeometry(null);
            }
          };

          textReader.readAsText(file);
        } catch (err) {
          console.error(
            "KML read error:",
            err
          );

          setError(
            err instanceof Error
              ? err.message
              : "Failed to read KML file."
          );
        }
      };

      reader.readAsDataURL(file);
    } catch (err) {
      console.error(
        "KML upload error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Failed to upload KML file."
      );
    }
  };

  // ==============================
  // CREATE REGION
  // UI ONLY - NO BACKEND CALL
  // ==============================
  const handleSubmit = () => {
    setMessage("");
    setError("");
    setUploadStatus("");

    // Organisation validation
    if (!form.organizationId) {
      setError(
        "Please select an Organisation."
      );
      return;
    }

    // Region name validation
    if (!form.name.trim()) {
      setError(
        "Please enter Region Name."
      );
      return;
    }

    // Description validation
    if (!form.description.trim()) {
      setError(
        "Please enter Description."
      );
      return;
    }

    // Area validation
    if (!form.area.trim()) {
      setError(
        "Please enter Region Area."
      );
      return;
    }

    const numericArea = Number(form.area);

    if (
      Number.isNaN(numericArea) ||
      numericArea <= 0
    ) {
      setError(
        "Region Area must be a positive number."
      );
      return;
    }

    // KML validation
    if (!kmlFile || !geometry) {
      setError(
        "Please upload a valid KML file."
      );
      return;
    }

    // ==============================
    // STORE REGION NAME FOR STEP 2
    // ==============================
    setCreatedRegionName(
      form.name.trim()
    );

    // Clear old Excel state
    setCropExcelFile(null);
    setCropExcelFileName("");
    setCropUploadError("");
    setCropUploadSuccess("");

    // ==============================
    // DIRECTLY OPEN STEP 2
    // ==============================
    setCurrentStep(2);

    showNotification(
      "Region details completed. Please upload crop details Excel file.",
      "success"
    );
  };

  // ==============================
  // EXCEL FILE HANDLER
  // ==============================
  const handleCropExcelFile = (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setCropUploadError("");
    setCropUploadSuccess("");

    const lowerName =
      file.name.toLowerCase();

    if (
      !lowerName.endsWith(".xlsx") &&
      !lowerName.endsWith(".xls")
    ) {
      setCropExcelFile(null);
      setCropExcelFileName("");

      setCropUploadError(
        "Please upload a valid Excel file (.xlsx or .xls)."
      );

      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      try {
        const result = reader.result;

        if (typeof result !== "string") {
          throw new Error(
            "Unable to read Excel file."
          );
        }

        const base64 = result.split(",")[1];

        if (!base64) {
          throw new Error(
            "Invalid Excel file."
          );
        }

        setCropExcelFile(base64);
        setCropExcelFileName(file.name);

        setCropUploadSuccess(
          "Excel file selected successfully."
        );
      } catch (err) {
        console.error(
          "Excel file error:",
          err
        );

        setCropExcelFile(null);
        setCropExcelFileName("");

        setCropUploadError(
          err instanceof Error
            ? err.message
            : "Failed to read Excel file."
        );
      }
    };

    reader.onerror = () => {
      setCropUploadError(
        "Failed to read Excel file."
      );
    };

    reader.readAsDataURL(file);
  };

  // ==============================
  // SAVE CROP DETAILS
  // UI ONLY - NO BACKEND CALL
  // ==============================
  const handleCropDetailsUpload =
    () => {
      setCropUploadError("");
      setCropUploadSuccess("");

      if (!cropExcelFile) {
        setCropUploadError(
          "Please upload an Excel file."
        );
        return;
      }

      setUploadingCropDetails(true);

      // UI confirmation only
      setTimeout(() => {
        setUploadingCropDetails(false);

        setCropUploadSuccess(
          "Crop details Excel file saved successfully."
        );

        showNotification(
          "Crop details saved successfully.",
          "success"
        );
      }, 500);
    };

  // ==============================
  // STEP 1
  // ==============================
  const renderCreateRegionStep =
    () => (
      <Paper
        elevation={3}
        sx={{
          maxWidth: 650,
          margin: "0 auto",
          padding: 3,
        }}
      >
        <Typography
          variant="h5"
          sx={{
            fontWeight: 600,
            mb: 2,
          }}
        >
          📍 Create Region
        </Typography>

        {message && (
          <Alert
            severity="success"
            sx={{ mb: 2 }}
          >
            {message}
          </Alert>
        )}

        {error && (
          <Alert
            severity="error"
            sx={{ mb: 2 }}
          >
            {error}
          </Alert>
        )}

        <FormControl
          fullWidth
          sx={{ mb: 2 }}
        >
          <InputLabel>
            Organisation ID *
          </InputLabel>

          <Select
            value={form.organizationId}
            label="Organisation ID *"
            onChange={(event) =>
              updateField(
                "organizationId",
                String(event.target.value)
              )
            }
            disabled={
              loadingOrganizations ||
              submitting
            }
          >
            {loadingOrganizations ? (
              <MenuItem value="">
                Loading organizations...
              </MenuItem>
            ) : (
              organizations.map(
                (organization) => (
                  <MenuItem
                    key={organization.id}
                    value={
                      organization.id
                    }
                  >
                    {organization.id} -{" "}
                    {organization.name}
                  </MenuItem>
                )
              )
            )}
          </Select>
        </FormControl>

        <TextField
          fullWidth
          label="Region Name *"
          value={form.name}
          onChange={(event) =>
            updateField(
              "name",
              event.target.value
            )
          }
          disabled={submitting}
          sx={{ mb: 2 }}
        />

        <TextField
          fullWidth
          label="Description *"
          value={form.description}
          onChange={(event) =>
            updateField(
              "description",
              event.target.value
            )
          }
          disabled={submitting}
          sx={{ mb: 2 }}
          multiline
          rows={3}
        />

        <TextField
          fullWidth
          label="Region Area *"
          value={form.area}
          onChange={(event) =>
            updateField(
              "area",
              event.target.value
            )
          }
          disabled={submitting}
          sx={{ mb: 2 }}
          type="number"
        />

        <Box sx={{ mb: 2 }}>
          <Typography
            variant="body2"
            sx={{
              mb: 1,
              fontWeight: 500,
            }}
          >
            Region KML *
          </Typography>

          <Button
            component="label"
            variant="outlined"
            fullWidth
            disabled={submitting}
            sx={{
              height: 40,
            }}
          >
            UPLOAD KML

            <input
              type="file"
              hidden
              accept=".kml"
              onChange={handleFile}
            />
          </Button>

          {fileName && (
            <Typography
              variant="body2"
              sx={{
                mt: 1,
                color:
                  "text.secondary",
              }}
            >
              Selected file:{" "}
              {fileName}
            </Typography>
          )}
        </Box>

        {uploadStatus && (
          <Alert
            severity="info"
            sx={{ mb: 2 }}
          >
            {uploadStatus}
          </Alert>
        )}

        <Button
          fullWidth
          variant="contained"
          onClick={handleSubmit}
          disabled={submitting}
          sx={{
            backgroundColor:
              "#075d16",
            "&:hover": {
              backgroundColor:
                "#064d12",
            },
          }}
        >
          {submitting ? (
            <>
              <CircularProgress
                size={22}
                color="inherit"
                sx={{ mr: 1 }}
              />
              PROCESSING...
            </>
          ) : (
            "CREATE REGION"
          )}
        </Button>
      </Paper>
    );

  // ==============================
  // STEP 2
  // ==============================
  const renderCropDetailsStep =
    () => (
      <Paper
        elevation={3}
        sx={{
          maxWidth: 650,
          margin: "0 auto",
          padding: 3,
        }}
      >
        <Typography
          variant="h5"
          sx={{
            fontWeight: 600,
            mb: 3,
          }}
        >
          📊 Upload Crop Details
        </Typography>

        {cropUploadSuccess && (
          <Alert
            severity="success"
            sx={{ mb: 2 }}
          >
            {cropUploadSuccess}
          </Alert>
        )}

        {cropUploadError && (
          <Alert
            severity="error"
            sx={{ mb: 2 }}
          >
            {cropUploadError}
          </Alert>
        )}

        <TextField
          fullWidth
          label="Region"
          value={createdRegionName}
          disabled
          sx={{ mb: 3 }}
        />

        <Box sx={{ mb: 3 }}>
          <Typography
            variant="body2"
            sx={{
              mb: 1,
              fontWeight: 500,
            }}
          >
            Upload Excel Format File
          </Typography>

          <Button
            component="label"
            variant="outlined"
            fullWidth
            disabled={
              uploadingCropDetails
            }
            sx={{
              height: 45,
            }}
          >
            UPLOAD EXCEL FILE

            <input
              type="file"
              hidden
              accept=".xlsx,.xls"
              onChange={
                handleCropExcelFile
              }
            />
          </Button>

          {cropExcelFileName && (
            <Typography
              variant="body2"
              sx={{
                mt: 1,
                color:
                  "text.secondary",
              }}
            >
              Selected file:{" "}
              {cropExcelFileName}
            </Typography>
          )}
        </Box>

        <Button
          fullWidth
          variant="contained"
          onClick={
            handleCropDetailsUpload
          }
          disabled={
            uploadingCropDetails ||
            !cropExcelFile
          }
          sx={{
            backgroundColor:
              "#075d16",
            "&:hover": {
              backgroundColor:
                "#064d12",
            },
          }}
        >
          {uploadingCropDetails ? (
            <>
              <CircularProgress
                size={22}
                color="inherit"
                sx={{ mr: 1 }}
              />
              SAVING...
            </>
          ) : (
            "SAVE"
          )}
        </Button>
      </Paper>
    );

  // ==============================
  // MAIN UI
  // ==============================
  return (
    <>
      {currentStep === 1
        ? renderCreateRegionStep()
        : renderCropDetailsStep()}

      <Snackbar
        open={notification.open}
        autoHideDuration={5000}
        onClose={() =>
          setNotification(
            (prev) => ({
              ...prev,
              open: false,
            })
          )
        }
        message={
          notification.message
        }
      />
    </>
  );
};

export default CreateRegion;