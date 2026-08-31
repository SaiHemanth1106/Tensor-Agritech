import { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Button,
  Modal,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import { getCropSummary, getMap } from "../services/api";

export default function CropHealth() {

  const [rows, setRows] = useState<any[]>([]);
  const [filteredRows, setFilteredRows] = useState<any[]>([]);
  const [mapUrl, setMapUrl] = useState<string>("");
  const [open, setOpen] = useState(false);

  const [regionFilter, setRegionFilter] = useState("");
  const [metricFilter, setMetricFilter] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [rows, regionFilter, metricFilter]);

  const loadData = async () => {
    const res = await getCropSummary();
    setRows(res);
  };

  // -------------------------
  // FILTER
  // -------------------------
  const applyFilters = () => {
    let data = rows;

    if (regionFilter) {
      data = data.filter(r => r.region === regionFilter);
    }

    if (metricFilter) {
      data = data.filter(r => r.metric === metricFilter);
    }

    setFilteredRows(data);
  };

  // -------------------------
  // FRIENDLY LABELS
  // -------------------------
  const cropLabels: any = {
    NDVI: "Crop Health",
    NDMI: "Soil Moisture",
    GCI: "Chlorophyll Level",
    SAVI: "Crop Health (Soil Adjusted)"
  };

  // -------------------------
  // COLOR LOGIC
  // -------------------------
  const getColor = (val: number) => {
    if (val < 0.4) return "error";
    if (val < 0.6) return "warning";
    return "success";
  };

  // -------------------------
  // MAP FETCH (MATCH SOIL)
  // -------------------------
  const handleViewMap = async (row: any) => {

    console.log("CROP MAP ROW:", row);

    const res = await getMap({
      region_id: row.region_id,
      param: row.metric,
      date: row.date,
      type: "crop_map"
    });

    console.log("MAP RESPONSE:", res);

    // ✅ IMPORTANT FIX
    setMapUrl(res.map_url);
    setOpen(true);
  };

  // -------------------------
  // UNIQUE FILTER VALUES
  // -------------------------
  const regions = [...new Set(rows.map(r => r.region))];
  const metrics = [...new Set(rows.map(r => r.metric))];

  // -------------------------
  // TABLE COLUMNS
  // -------------------------
  const columns = [
    { field: "region", headerName: "Region", flex: 1 },

    {
      field: "metric",
      headerName: "Metric",
      flex: 1,
      renderCell: (params: any) =>
        cropLabels[params.value] || params.value
    },

    {
      field: "value",
      headerName: "Value",
      flex: 1,
      renderCell: (params: any) => (
        <Chip
          label={params.value}
          color={getColor(Number(params.value))}
          size="small"
        />
      )
    },

    { field: "date", headerName: "Date", flex: 1 },

    {
      field: "map",
      headerName: "Map",
      renderCell: (params: any) => (
        <Button
          variant="contained"
          onClick={() => handleViewMap(params.row)}
        >
          View Map
        </Button>
      )
    }
  ];

  return (
    <Box>

      <Typography variant="h5" mb={2}>
        🌿 Crop Health
      </Typography>

      {/* FILTERS */}
      <Box display="flex" gap={2} mb={2}>

        <FormControl sx={{ minWidth: 150 }}>
          <InputLabel>Region</InputLabel>
          <Select
            value={regionFilter}
            onChange={(e) => setRegionFilter(e.target.value)}
          >
            <MenuItem value="">All</MenuItem>
            {regions.map(r => (
              <MenuItem key={r} value={r}>{r}</MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl sx={{ minWidth: 200 }}>
          <InputLabel>Metric</InputLabel>
          <Select
            value={metricFilter}
            onChange={(e) => setMetricFilter(e.target.value)}
          >
            <MenuItem value="">All</MenuItem>
            {metrics.map(m => (
              <MenuItem key={m} value={m}>
                {cropLabels[m]}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

      </Box>

      {/* TABLE */}
      <DataGrid
        rows={filteredRows.map((r, i) => ({ id: i, ...r }))}
        columns={columns}
        autoHeight
      />

      {/* MAP MODAL */}
      <Modal open={open} onClose={() => setOpen(false)}>
        <Box
          sx={{
            position: "absolute",
            top: "5%",
            left: "5%",
            width: "90%",
            height: "90%",
            bgcolor: "white",
            p: 2,
            borderRadius: 2
          }}
        >
          <Typography variant="h6" mb={2}>Map View</Typography>

          {mapUrl ? (
            <iframe
              src={mapUrl}
              width="100%"
              height="90%"
              style={{ border: "none" }}
            />
          ) : (
            <Typography>Loading map...</Typography>
          )}
        </Box>
      </Modal>

    </Box>
  );
}