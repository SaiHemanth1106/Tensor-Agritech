import { useState, useEffect } from "react";
import {
  Box,
  TextField,
  Button,
  Typography,
  RadioGroup,
  FormControlLabel,
  Radio,
  Paper,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent
} from "@mui/material";
import Grid from "@mui/material/GridLegacy";
import Autocomplete from "@mui/material/Autocomplete";

import { MapContainer, TileLayer, Polygon } from "react-leaflet";
import "leaflet/dist/leaflet.css";

import {
  getOrganizations,
  updateRegionFromImport,
  getRegionsByOrg
} from "../../services/api";

export default function UploadRegion() {

  // ================= STATE =================
  const [orgs, setOrgs] = useState<any[]>([]);
  const [regions, setRegions] = useState<any[]>([]);

  const [file, setFile] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [cropDataFile, setCropDataFile] = useState<string | null>(null);
  const [cropDataFileName, setCropDataFileName] = useState("");

  const [geometry, setGeometry] = useState<any[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);

  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState<any>({ type: null, text: "" });

  const [form, setForm] = useState<any>({
    organization_id: "",
    region_id: "",
    monitoring_enabled: false,
    start_date: "",
    end_date: "",
    crop_name: "",
    sowing_date: "",
    expected_harvest_date: "",
    field_preparation_date: "",
    fertilizer_application_date: "",
    crop_duration_days: "",
    notes: ""
  });

  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const isAdmin = user?.role === "admin";

  const isOrgSelected = !!form.organization_id;
  const isRegionSelected = !!form.region_id;
  const isFileSelected = !!file;

  // ================= LOAD ORGS =================
  useEffect(() => {
    getOrganizations().then(setOrgs);
  }, []);

  // ================= LOAD REGIONS =================
  useEffect(() => {
    if (!form.organization_id) return;

    getRegionsByOrg(form.organization_id)
      .then((res) => setRegions(res || []))
      .catch(() =>
        setAlert({ type: "error", text: "Failed to load regions" })
      );
  }, [form.organization_id]);

  // ================= AUTO CROP DURATION =================
  useEffect(() => {
    if (form.sowing_date && form.expected_harvest_date) {
      const sow = new Date(form.sowing_date);
      const har = new Date(form.expected_harvest_date);

      if (har > sow) {
        const diff = Math.ceil(
          (har.getTime() - sow.getTime()) / (1000 * 60 * 60 * 24)
        );

        setForm((prev: any) => ({
          ...prev,
          crop_duration_days: diff
        }));
      }
    }
  }, [form.sowing_date, form.expected_harvest_date]);

  // ================= KML PARSE =================
  const extractGeometry = (kmlText: string) => {
    const parser = new DOMParser();
    const xml = parser.parseFromString(kmlText, "text/xml");

    const coords = xml.getElementsByTagName("coordinates")[0];
    if (!coords) return [];

    return coords.textContent!.trim().split(" ").map(p => {
      const [lon, lat] = p.split(",");
      return [parseFloat(lat), parseFloat(lon)];
    });
  };

  // ================= FILE =================
  const handleFile = (e: any) => {
    const f = e.target.files[0];
    if (!f) return;

    if (!f.name.endsWith(".kml")) {
      setAlert({ type: "error", text: "Upload valid KML file" });
      return;
    }

    setFileName(f.name);

    const reader = new FileReader();
    reader.readAsDataURL(f);
    reader.onload = () =>
      setFile((reader.result as string).split(",")[1]);

    const textReader = new FileReader();
    textReader.readAsText(f);
    textReader.onload = () =>
      setGeometry(extractGeometry(textReader.result as string));
  };

  const handleCropDataFile = (e: any) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!/\.(xlsx|xls)$/i.test(selectedFile.name)) {
      setCropDataFile(null);
      setCropDataFileName("");
      setAlert({ type: "error", text: "Upload a valid Excel file (.xlsx or .xls)" });
      return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(selectedFile);
    reader.onload = () => {
      setCropDataFile((reader.result as string).split(",")[1]);
      setCropDataFileName(selectedFile.name);
    };
    reader.onerror = () =>
      setAlert({ type: "error", text: "Could not read the crop data Excel file" });
  };

  // ================= SUBMIT =================
  const handleSubmit = async () => {

    if (!isAdmin) return;

    if (!form.organization_id || !form.region_id || !file || !cropDataFile) {
      setAlert({ type: "error", text: "Fill required fields" });
      return;
    }

    if (!form.sowing_date || !form.expected_harvest_date) {
      setAlert({ type: "error", text: "Provide crop dates" });
      return;
    }

    const sow = new Date(form.sowing_date);
    const har = new Date(form.expected_harvest_date);

    if (har <= sow) {
      setAlert({ type: "error", text: "Harvest must be after sowing" });
      return;
    }

    const selectedRegion = regions.find(r => r.id === form.region_id);

    try {
      setLoading(true);

      await updateRegionFromImport({
        region_id: form.region_id,
        name: selectedRegion?.name,
        file,
        file_name: fileName,
        crop_data_file: cropDataFile,
        crop_data_file_name: cropDataFileName,
        crop_data_content_type: cropDataFileName.toLowerCase().endsWith(".xls")
          ? "application/vnd.ms-excel"
          : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",

        monitoring: {
          enabled: form.monitoring_enabled,
          start_date: form.start_date || null,
          end_date: form.end_date || null
        },

        crop_cycle: {
          crop_name: form.crop_name,
          sowing_date: form.sowing_date,
          field_preparation_date: form.field_preparation_date || null,
          fertilizer_application_date: form.fertilizer_application_date || null,
          expected_harvest_date: form.expected_harvest_date,
          crop_duration_days: form.crop_duration_days,
          notes: form.notes || null
        }
      });

      setAlert({ type: "success", text: "Uploaded successfully" });

    } catch (e: any) {
      setAlert({ type: "error", text: e.message });
    } finally {
      setLoading(false);
    }
  };

  // ================= UI =================
  return (
    <Box maxWidth={900} mx="auto">
      <Paper sx={{ p: 4 }}>

        <Typography variant="h5">Upload Region</Typography>

        {alert.type && <Alert severity={alert.type}>{alert.text}</Alert>}
        {!isAdmin && <Typography color="error">Admin only access</Typography>}

        {isAdmin && (
          <Grid container spacing={2}>

            {/* Organization */}
            <Grid item xs={12} md={6}>
              <Autocomplete
                options={orgs}
                getOptionLabel={(o) => o.name}
                onChange={(_event, val) =>
                  setForm({ ...form, organization_id: val?.id || "", region_id: "" })
                }
                renderInput={(params) => (
                  <TextField {...params} label="Organization" />
                )}
              />
            </Grid>

            {/* Region */}
            <Grid item xs={12} md={6}>
              <Autocomplete
                options={regions}
                getOptionLabel={(r) => r.name}
                disabled={!isOrgSelected}
                onChange={(_event, val) =>
                  setForm({ ...form, region_id: val?.id || "" })
                }
                renderInput={(params) => (
                  <TextField {...params} label="Region" />
                )}
              />
            </Grid>

            {/* File */}
            <Grid item xs={12}>
              <Button component="label" fullWidth disabled={!isRegionSelected}>
                Upload KML
                <input hidden type="file" onChange={handleFile} />
              </Button>
              {fileName && <Typography>{fileName}</Typography>}
            </Grid>

            <Grid item xs={12}>
              <Button component="label" fullWidth disabled={!isRegionSelected}>
                Upload Crop Data Excel
                <input
                  hidden
                  type="file"
                  accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                  onChange={handleCropDataFile}
                />
              </Button>
              {cropDataFileName && <Typography>{cropDataFileName}</Typography>}
            </Grid>

            {/* Map Preview */}
            {geometry.length > 0 && (
              <Grid item xs={12}>
                <Button onClick={() => setPreviewOpen(true)}>
                  Preview Map
                </Button>
              </Grid>
            )}

            {/* Monitoring */}
            {isFileSelected && (
              <>
                <Grid item xs={12}>
                  <Typography>Monitoring</Typography>
                  <RadioGroup
                    row
                    value={form.monitoring_enabled.toString()}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        monitoring_enabled: e.target.value === "true"
                      })
                    }
                  >
                    <FormControlLabel value="true" control={<Radio />} label="Yes" />
                    <FormControlLabel value="false" control={<Radio />} label="No" />
                  </RadioGroup>
                </Grid>

                {form.monitoring_enabled && (
                  <>
                    <Grid item xs={12} md={6}>
                      <TextField
                        label="Monitoring Start Date"
                        type="date"
                        fullWidth
                        InputLabelProps={{ shrink: true }}
                        onChange={(e) =>
                          setForm({ ...form, start_date: e.target.value })
                        }
                      />
                    </Grid>

                    <Grid item xs={12} md={6}>
                      <TextField
                        label="Monitoring End Date"
                        type="date"
                        fullWidth
                        InputLabelProps={{ shrink: true }}
                        onChange={(e) =>
                          setForm({ ...form, end_date: e.target.value })
                        }
                      />
                    </Grid>
                  </>
                )}

                {/* Crop Fields */}
                <Grid item xs={12} md={6}>
                  <TextField
                    label="Crop Name"
                    fullWidth
                    onChange={(e) =>
                      setForm({ ...form, crop_name: e.target.value })
                    }
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    label="Crop Duration (days)"
                    value={form.crop_duration_days}
                    fullWidth
                    InputProps={{ readOnly: true }}
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    label="Sowing Date"
                    type="date"
                    fullWidth
                    InputLabelProps={{ shrink: true }}
                    onChange={(e) =>
                      setForm({ ...form, sowing_date: e.target.value })
                    }
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    label="Harvest Date"
                    type="date"
                    fullWidth
                    InputLabelProps={{ shrink: true }}
                    onChange={(e) =>
                      setForm({ ...form, expected_harvest_date: e.target.value })
                    }
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    label="Field Preparation Date"
                    type="date"
                    fullWidth
                    InputLabelProps={{ shrink: true }}
                    onChange={(e) =>
                      setForm({ ...form, field_preparation_date: e.target.value })
                    }
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    label="Fertilizer Application Date"
                    type="date"
                    fullWidth
                    InputLabelProps={{ shrink: true }}
                    onChange={(e) =>
                      setForm({ ...form, fertilizer_application_date: e.target.value })
                    }
                  />
                </Grid>

                {/* Notes */}
                <Grid item xs={12}>
                  <TextField
                    label="Notes"
                    multiline
                    rows={4}
                    fullWidth
                    value={form.notes}
                    onChange={(e) =>
                      setForm({ ...form, notes: e.target.value })
                    }
                  />
                </Grid>
              </>
            )}

          </Grid>
        )}

        <Button
          fullWidth
          sx={{ mt: 2 }}
          variant="contained"
          onClick={handleSubmit}
          disabled={!isAdmin || !isFileSelected}
        >
          {loading ? <CircularProgress size={20} /> : "Upload"}
        </Button>

      </Paper>

      <Dialog open={previewOpen} onClose={() => setPreviewOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>Map Preview</DialogTitle>
        <DialogContent>
          <MapContainer style={{ height: 400 }} center={geometry[0] || [20, 78]} zoom={15}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <Polygon positions={geometry} />
          </MapContainer>
        </DialogContent>
      </Dialog>

    </Box>
  );
}
