import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Typography
} from "@mui/material";
import { getRegions, uploadCropDetailsExcel } from "../../services/api";

type Region = Record<string, unknown>;

const getRegionList = (response: unknown): Region[] => {
  if (Array.isArray(response)) return response as Region[];
  if (response && typeof response === "object") {
    const record = response as Record<string, unknown>;
    if (Array.isArray(record.regions)) return record.regions as Region[];
    if (Array.isArray(record.data)) return record.data as Region[];
  }
  return [];
};

const valueFor = (region: Region, ...keys: string[]) => {
  for (const key of keys) {
    const value = region[key];
    if (value !== undefined && value !== null && value !== "") return String(value);
  }
  return "-";
};

export default function UploadCropDetails() {
  const [regions, setRegions] = useState<Region[]>([]);
  const [selectedRegionName, setSelectedRegionName] = useState("");
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const loadRegions = async () => {
      try {
        setLoading(true);
        const nextRegions = getRegionList(await getRegions());
        setRegions(nextRegions);
        if (nextRegions.length > 0) {
          setSelectedRegionName(valueFor(nextRegions[0], "name", "region_name"));
        }
      } catch (loadError: unknown) {
        const message = loadError instanceof Error
          ? loadError.message
          : typeof loadError === "object" && loadError && "message" in loadError
            ? String(loadError.message)
            : "Failed to load regions.";
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    void loadRegions();
  }, []);

  const currentRegion = regions.find((region) => valueFor(region, "name", "region_name") === selectedRegionName) ?? regions[0] ?? null;

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    if (!/\.(xlsx|xls)$/i.test(selectedFile.name)) {
      setFileContent(null);
      setFileName("");
      setError("Please upload a valid Excel file (.xlsx or .xls).");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setFileContent((reader.result as string).split(",")[1]);
      setFileName(selectedFile.name);
      setError("");
      setSuccess("");
    };
    reader.onerror = () => {
      setFileContent(null);
      setFileName("");
      setError("The Excel file could not be read.");
    };
    reader.readAsDataURL(selectedFile);
  };

  const handleSave = async () => {
    if (!currentRegion) {
      setError("Please select a valid region.");
      return;
    }

    const regionId = currentRegion.id ?? currentRegion.region_id ?? currentRegion.regionId ?? currentRegion.regionID;
    if (!regionId) {
      setError("The selected region does not have a valid ID.");
      return;
    }

    if (!fileContent || !fileName) {
      setError("Please choose an Excel file before saving.");
      return;
    }

    try {
      setUploading(true);
      setError("");
      setSuccess("");
      await uploadCropDetailsExcel(String(regionId), {
        region_id: String(regionId),
        region_name: valueFor(currentRegion, "name", "region_name"),
        crop_data_file: fileContent,
        crop_data_file_name: fileName,
        crop_data_content_type: fileName.toLowerCase().endsWith(".xls")
          ? "application/vnd.ms-excel"
          : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      });
      setSuccess("Crop details uploaded and saved successfully.");
    } catch (saveError: unknown) {
      const message = saveError instanceof Error
        ? saveError.message
        : typeof saveError === "object" && saveError && "message" in saveError
          ? String(saveError.message)
          : "Failed to save crop details.";
      setError(message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Box maxWidth={700} mx="auto">
      <Paper sx={{ p: 4, borderRadius: 3 }}>
        <Typography variant="h5" fontWeight="bold" mb={2}>Upload Crop Details</Typography>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

        {loading ? (
          <Box display="flex" justifyContent="center" py={4}><CircularProgress /></Box>
        ) : (
          <>
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel id="crop-region-select-label">Region</InputLabel>
              <Select
                labelId="crop-region-select-label"
                label="Region"
                value={selectedRegionName || ""}
                onChange={(event) => setSelectedRegionName(event.target.value)}
              >
                {regions.map((region) => (
                  <MenuItem key={valueFor(region, "name", "region_name")} value={valueFor(region, "name", "region_name")}>
                    {valueFor(region, "name", "region_name")}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Button component="label" variant="outlined" fullWidth sx={{ mb: 2 }}>
              Upload Excel Format File
              <input hidden type="file" accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" onChange={handleFileChange} />
            </Button>

            {fileName && <Typography variant="body2" sx={{ mb: 2 }}>Selected file: {fileName}</Typography>}

            <Button variant="contained" fullWidth onClick={() => void handleSave()} disabled={uploading || !fileName}>
              {uploading ? "Saving..." : "Save"}
            </Button>
          </>
        )}
      </Paper>
    </Box>
  );
}
