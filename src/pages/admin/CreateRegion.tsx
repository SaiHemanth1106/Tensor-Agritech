import { useEffect, useState } from "react";
import type { ChangeEvent } from "react";
import { Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, InputLabel, LinearProgress, MenuItem, Paper, Select, Snackbar, TextField, Typography } from "@mui/material";
import * as toGeoJSON from "@tmcw/togeojson";
import { createRegion, getOrganizations, updateRegionFromImport } from "../../services/api";

interface Organization { id: number; name: string; }
interface RegionIdentifier { id?: number; region_id?: number; }
interface CreateRegionResponse extends RegionIdentifier {
  region?: RegionIdentifier;
  data?: RegionIdentifier & { region?: RegionIdentifier };
}

const initialForm = { organizationId: "", name: "", description: "", area: "" };
type LambdaStatus = "pending" | "running" | "success" | "error";
type LambdaResult = { status: LambdaStatus; detail: string };
type LambdaResults = { create: LambdaResult; import: LambdaResult };

const initialLambdaResults: LambdaResults = {
  create: { status: "pending", detail: "Not started" },
  import: { status: "pending", detail: "Not started" }
};

const findRegionId = (value: unknown, depth = 0): number | string | undefined => {
  if (!value || depth > 3) return undefined;

  if (typeof value === "string") {
    try { return findRegionId(JSON.parse(value), depth + 1); }
    catch { return undefined; }
  }

  if (typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  const id = record.region_id ?? record.id;
  if (typeof id === "number" || (typeof id === "string" && id.trim())) return id;

  return findRegionId(record.region, depth + 1)
    ?? findRegionId(record.data, depth + 1)
    ?? findRegionId(record.body, depth + 1);
};

export default function CreateRegion() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [form, setForm] = useState(initialForm);
  const [kmlFile, setKmlFile] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [geometry, setGeometry] = useState("");
  const [loadingOrganizations, setLoadingOrganizations] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [completionOpen, setCompletionOpen] = useState(false);
  const [lambdaResults, setLambdaResults] = useState<LambdaResults>(initialLambdaResults);
  const [processStarted, setProcessStarted] = useState(false);
  const [notification, setNotification] = useState<{ open: boolean; message: string; severity: "success" | "error" }>({ open: false, message: "", severity: "success" });

  useEffect(() => {
    const loadOrganizations = async () => {
      try { setOrganizations(await getOrganizations()); }
      catch (loadError) { setError(loadError instanceof Error ? loadError.message : "Failed to load organizations."); }
      finally { setLoadingOrganizations(false); }
    };
    void loadOrganizations();
  }, []);

  const updateField = (field: keyof typeof form, value: string) => setForm((current) => ({ ...current, [field]: value }));

  const updateLambdaResult = (lambda: keyof LambdaResults, status: LambdaStatus, detail: string) => {
    setLambdaResults((results) => ({ ...results, [lambda]: { status, detail } }));
  };

  const showNotification = (severity: "success" | "error", notificationMessage: string) =>
    setNotification({ open: true, severity, message: notificationMessage });

  const processProgress = lambdaResults.import.status === "success" ? 100
    : lambdaResults.import.status === "running" || lambdaResults.import.status === "error" ? 75
      : lambdaResults.create.status === "success" ? 50
        : lambdaResults.create.status === "running" || lambdaResults.create.status === "error" ? 25
          : 0;
  const processFailed = lambdaResults.create.status === "error" || lambdaResults.import.status === "error";
  const processLabel = processFailed
    ? "Process stopped. See the notification or completion status for the reason."
    : lambdaResults.import.status === "success"
      ? "Process completed successfully."
      : processProgress > 0
        ? "Process in progress."
        : "Waiting for valid region details.";

  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;
    setError("");
    setMessage("");
    setUploadStatus("");

    if (!selectedFile.name.toLowerCase().endsWith(".kml")) {
      setKmlFile(null); setFileName(""); setGeometry("");
      setError("Please select a valid KML file.");
      return;
    }

    const dataReader = new FileReader();
    dataReader.onload = () => setKmlFile((dataReader.result as string).split(",")[1]);
    dataReader.readAsDataURL(selectedFile);

    const textReader = new FileReader();
    textReader.onload = () => {
      try {
        const document = new DOMParser().parseFromString(textReader.result as string, "text/xml");
        if (document.querySelector("parsererror")) throw new Error("Invalid KML");
        const geoJson = toGeoJSON.kml(document);
        if (!geoJson.features.length) throw new Error("No geometry found");
        setGeometry(JSON.stringify(geoJson));
        setFileName(selectedFile.name);
        setUploadStatus("KML ready to upload when you create the region.");
      } catch {
        setKmlFile(null); setFileName(""); setGeometry("");
        setError("The KML file could not be read or does not contain a region geometry.");
      }
    };
    textReader.readAsText(selectedFile);
  };

  const handleSubmit = async () => {
    setMessage(""); setError("");
    setCompletionOpen(false);
    setLambdaResults(initialLambdaResults);
    setProcessStarted(true);
    if (Object.values(form).some((value) => !value.trim())) {
      const validationError = "All region details are required.";
      setError(validationError); showNotification("error", validationError); return;
    }
    if (!kmlFile || !geometry) {
      const validationError = "Upload a valid KML file before creating the region.";
      setError(validationError); showNotification("error", validationError); return;
    }
    const regionArea = Number(form.area);
    if (!Number.isFinite(regionArea) || regionArea <= 0) {
      const validationError = "Region area must be a number greater than zero.";
      setError(validationError); showNotification("error", validationError); return;
    }

    let regionWasCreated = false;
    let importStarted = false;
    try {
      setSubmitting(true);
      updateLambdaResult("create", "running", "Request sent to AWS API Gateway");
      setUploadStatus("Creating region…");
      const createdRegion = await createRegion({
        organization_id: Number(form.organizationId), name: form.name.trim(), description: form.description.trim(), geometry, region_area: regionArea
      }) as CreateRegionResponse;
      regionWasCreated = true;
      const regionId = findRegionId(createdRegion);
      if (!regionId) throw new Error("The region was created, but its ID was not returned so the KML could not be uploaded.");
      const createDetail = `Completed successfully. Region ID ${regionId} was returned.`;
      updateLambdaResult("create", "success", createDetail);
      showNotification("success", `Create-region Lambda completed. ${createDetail}`);

      importStarted = true;
      updateLambdaResult("import", "running", "KML sent to AWS API Gateway");
      setUploadStatus("Sending KML to the import service…");
      await updateRegionFromImport({
        region_id: regionId,
        name: form.name.trim(),
        file: kmlFile,
        file_name: fileName
      });
      const importDetail = "Completed successfully. Verify the imported values in Region Management.";
      updateLambdaResult("import", "success", importDetail);
      showNotification("success", "KML-import Lambda completed successfully.");
      setMessage("Region created and KML uploaded successfully.");
      setUploadStatus("Upload complete.");
      setCompletionOpen(true);
      setForm(initialForm); setKmlFile(null); setFileName(""); setGeometry("");
    } catch (submitError: unknown) {
      setUploadStatus("");
      const detail = submitError instanceof Error
        ? submitError.message
        : typeof submitError === "object" && submitError && "message" in submitError
          ? String(submitError.message)
          : "Failed to create region.";
      if (!regionWasCreated) {
        updateLambdaResult("create", "error", detail);
        updateLambdaResult("import", "pending", "Not started because the create-region Lambda failed");
      }
      else if (!importStarted) {
        updateLambdaResult("create", "error", detail);
        updateLambdaResult("import", "pending", "Not started because no region ID was returned");
      }
      else if (importStarted) {
        updateLambdaResult("import", "error", detail);
      }
      const processError = regionWasCreated && importStarted
        ? `Region was created, but its KML import failed: ${detail}`
        : detail;
      setError(processError);
      showNotification("error", `${importStarted ? "KML-import" : "Create-region"} Lambda failed: ${detail}`);
      setCompletionOpen(true);
    } finally { setSubmitting(false); }
  };

  return (
    <Box maxWidth={650} mx="auto">
      <Paper elevation={3} sx={{ p: 4, borderRadius: 3 }}>
        <Typography variant="h5" fontWeight="bold" mb={3}>📍 Create Region</Typography>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {message && <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert>}

        <FormControl fullWidth required sx={{ mb: 2 }} disabled={loadingOrganizations}>
          <InputLabel>Organisation ID</InputLabel>
          <Select value={form.organizationId} label="Organisation ID" onChange={(event) => updateField("organizationId", event.target.value)}>
            {organizations.map((organization) => <MenuItem key={organization.id} value={organization.id}>{organization.id} — {organization.name}</MenuItem>)}
          </Select>
        </FormControl>
        <TextField label="Region Name" fullWidth required sx={{ mb: 2 }} value={form.name} onChange={(event) => updateField("name", event.target.value)} />
        <TextField label="Description" fullWidth required multiline rows={3} sx={{ mb: 2 }} value={form.description} onChange={(event) => updateField("description", event.target.value)} />
        <TextField label="Region Area" fullWidth required type="number" inputProps={{ min: 0, step: "any" }} helperText="Enter the area in the unit required by the backend." sx={{ mb: 3 }} value={form.area} onChange={(event) => updateField("area", event.target.value)} />

        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle1" fontWeight="medium" mb={1}>Region KML *</Typography>
          <Button component="label" variant="outlined" fullWidth disabled={submitting}>
            Upload KML
            <input hidden required type="file" accept=".kml,application/vnd.google-earth.kml+xml" onChange={handleFile} />
          </Button>
          {fileName && <Typography variant="body2" sx={{ mt: 1 }}>{fileName}</Typography>}
        </Box>

        {processStarted && (
          <Box sx={{ mb: 2 }}>
            <Box display="flex" justifyContent="space-between" mb={0.75}>
              <Typography variant="body2" fontWeight="medium">Process status</Typography>
              <Typography variant="body2" color="text.secondary">{processProgress}%</Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={processProgress}
              color={processFailed ? "error" : "primary"}
              sx={{ height: 8, borderRadius: 1, mb: 1 }}
            />
            <Typography variant="caption" color="text.secondary" display="block" mt={0.5}>{processLabel}</Typography>
          </Box>
        )}
        {uploadStatus && <Alert severity="info" sx={{ mb: 2 }}>{uploadStatus}</Alert>}
        <Button variant="contained" fullWidth onClick={handleSubmit} disabled={submitting || loadingOrganizations}>
          {submitting ? <CircularProgress size={24} color="inherit" /> : "Create Region"}
        </Button>
      </Paper>

      <Dialog open={completionOpen} onClose={() => setCompletionOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{lambdaResults.import.status === "success" ? "Region Process Completed" : "Region Process Status"}</DialogTitle>
        <DialogContent>
          <Alert severity={lambdaResults.create.status === "success" ? "success" : "error"} sx={{ mb: 2 }}>
            <Typography fontWeight="bold">Create-region Lambda: {lambdaResults.create.status}</Typography>
            {lambdaResults.create.detail}
          </Alert>
          <Alert severity={lambdaResults.import.status === "success" ? "success" : lambdaResults.import.status === "error" ? "error" : "info"}>
            <Typography fontWeight="bold">KML-import Lambda: {lambdaResults.import.status}</Typography>
            {lambdaResults.import.detail}
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCompletionOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={notification.open}
        autoHideDuration={6000}
        onClose={() => setNotification((current) => ({ ...current, open: false }))}
      >
        <Alert severity={notification.severity} variant="filled" onClose={() => setNotification((current) => ({ ...current, open: false }))}>
          {notification.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
