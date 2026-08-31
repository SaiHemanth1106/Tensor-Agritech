import { useEffect, useState } from "react";
import type { ChangeEvent } from "react";
import { Alert, Box, Button, CircularProgress, FormControl, InputLabel, MenuItem, Paper, Select, TextField, Typography } from "@mui/material";
import * as toGeoJSON from "@tmcw/togeojson";
import { createRegion, getOrganizations, updateRegionFromImport } from "../../services/api";

interface Organization { id: number; name: string; }
interface RegionIdentifier { id?: number; region_id?: number; }
interface CreateRegionResponse extends RegionIdentifier {
  region?: RegionIdentifier;
  data?: RegionIdentifier & { region?: RegionIdentifier };
}

const initialForm = { organizationId: "", name: "", description: "", area: "" };

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
  const [cropDataFile, setCropDataFile] = useState<string | null>(null);
  const [cropDataFileName, setCropDataFileName] = useState("");
  const [geometry, setGeometry] = useState("");
  const [loadingOrganizations, setLoadingOrganizations] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const loadOrganizations = async () => {
      try { setOrganizations(await getOrganizations()); }
      catch (loadError) { setError(loadError instanceof Error ? loadError.message : "Failed to load organizations."); }
      finally { setLoadingOrganizations(false); }
    };
    void loadOrganizations();
  }, []);

  const updateField = (field: keyof typeof form, value: string) => setForm((current) => ({ ...current, [field]: value }));

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

  const handleCropDataFile = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;
    setError("");
    setMessage("");

    if (!/\.(xlsx|xls)$/i.test(selectedFile.name)) {
      setCropDataFile(null);
      setCropDataFileName("");
      setError("Please select a valid Excel file (.xlsx or .xls).");
      return;
    }

    const dataReader = new FileReader();
    dataReader.onload = () => {
      setCropDataFile((dataReader.result as string).split(",")[1]);
      setCropDataFileName(selectedFile.name);
    };
    dataReader.onerror = () => {
      setCropDataFile(null);
      setCropDataFileName("");
      setError("The crop data Excel file could not be read.");
    };
    dataReader.readAsDataURL(selectedFile);
  };

  const handleSubmit = async () => {
    setMessage(""); setError("");
    if (Object.values(form).some((value) => !value.trim())) { setError("All region details are required."); return; }
    if (!kmlFile || !geometry) { setError("Upload a valid KML file before creating the region."); return; }
    const regionArea = Number(form.area);
    if (!Number.isFinite(regionArea) || regionArea <= 0) { setError("Region area must be a number greater than zero."); return; }

    let regionWasCreated = false;
    try {
      setSubmitting(true);
      setUploadStatus("Creating region…");
      const createdRegion = await createRegion({
        organization_id: Number(form.organizationId), name: form.name.trim(), description: form.description.trim(), geometry, region_area: regionArea
      }) as CreateRegionResponse;
      regionWasCreated = true;
      const regionId = findRegionId(createdRegion);
      if (!regionId) throw new Error("The region was created, but its ID was not returned so the KML could not be uploaded.");

      setUploadStatus("Sending KML and crop data to the import service…");
      await updateRegionFromImport({
        region_id: regionId,
        name: form.name.trim(),
        file: kmlFile,
        file_name: fileName,
        ...(cropDataFile ? {
          crop_data_file: cropDataFile,
          crop_data_file_name: cropDataFileName,
          crop_data_content_type: cropDataFileName.toLowerCase().endsWith(".xls")
            ? "application/vnd.ms-excel"
            : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        } : {})
      });
      setMessage("Region created and KML and crop data uploaded successfully.");
      setUploadStatus("Upload complete.");
      setForm(initialForm); setKmlFile(null); setFileName(""); setCropDataFile(null); setCropDataFileName(""); setGeometry("");
    } catch (submitError: unknown) {
      setUploadStatus("");
      const detail = submitError instanceof Error
        ? submitError.message
        : typeof submitError === "object" && submitError && "message" in submitError
          ? String(submitError.message)
          : "Failed to create region.";
      setError(regionWasCreated ? `Region was created, but its KML import failed: ${detail}` : detail);
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

        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle1" fontWeight="medium" mb={1}>Crop Data</Typography>
          <Button component="label" variant="outlined" fullWidth disabled={submitting}>
            Upload Crop Data Excel
            <input hidden type="file" accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" onChange={handleCropDataFile} />
          </Button>
          {cropDataFileName && <Typography variant="body2" sx={{ mt: 1 }}>{cropDataFileName}</Typography>}
        </Box>

        {uploadStatus && <Alert severity="info" sx={{ mb: 2 }}>{uploadStatus}</Alert>}
        <Button variant="contained" fullWidth onClick={handleSubmit} disabled={submitting || loadingOrganizations}>
          {submitting ? <CircularProgress size={24} color="inherit" /> : "Create Region"}
        </Button>
      </Paper>
    </Box>
  );
}
