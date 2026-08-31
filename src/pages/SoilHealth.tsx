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
import { getSoilSummary, getMap } from "../services/api";

export default function SoilHealth() {

  const [rows, setRows] = useState<any[]>([]);
  const [filteredRows, setFilteredRows] = useState<any[]>([]);
  const [mapUrl, setMapUrl] = useState<string>("");
  const [open, setOpen] = useState(false);

  const [regionFilter, setRegionFilter] = useState("");
  const [nutrientFilter, setNutrientFilter] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [rows, regionFilter, nutrientFilter]);

  const loadData = async () => {
    const res = await getSoilSummary();
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

    if (nutrientFilter) {
      data = data.filter(r => r.nutrient === nutrientFilter);
    }

    setFilteredRows(data);
  };

  // -------------------------
  // UNITS
  // -------------------------
  const soilUnits: any = {
    Nitrogen: "mg/kg",
    Phosphorous: "mg/kg",
    Potassium: "mg/kg",
    Humus: "%"
  };

  // -------------------------
  // COLOR LOGIC (SOIL)
  // -------------------------
  const getColor = (nutrient: string, value: number) => {

    // Basic thresholds (can refine later)
    if (nutrient === "Nitrogen") {
      if (value < 5) return "error";
      if (value < 15) return "warning";
      return "success";
    }

    if (nutrient === "Phosphorous") {
      if (value < 10) return "error";
      if (value < 20) return "warning";
      return "success";
    }

    if (nutrient === "Potassium") {
      if (value < 100) return "error";
      if (value < 150) return "warning";
      return "success";
    }

    if (nutrient === "Humus") {
      if (value < 1) return "error";
      if (value < 2) return "warning";
      return "success";
    }

    return "default";
  };

  // -------------------------
  // MAP FETCH (UNCHANGED)
  // -------------------------
  const handleViewMap = async (row: any) => {

    const res = await getMap({
      region_id: row.region_id,
      param: row.nutrient,
      date: row.date,
      type: "soil_map"
    });

    setMapUrl(res.map_url);
    setOpen(true);
  };

  // -------------------------
  // UNIQUE VALUES
  // -------------------------
  const regions = [...new Set(rows.map(r => r.region))];
  const nutrients = [...new Set(rows.map(r => r.nutrient))];

  // -------------------------
  // TABLE COLUMNS
  // -------------------------
  const columns = [
    { field: "region", headerName: "Region", flex: 1 },

    { field: "nutrient", headerName: "Nutrient", flex: 1 },

    {
      field: "value",
      headerName: "Value",
      flex: 1,
      renderCell: (params: any) => (
        <Chip
          label={`${params.value} ${soilUnits[params.row.nutrient] || ""}`}
          color={getColor(params.row.nutrient, Number(params.value))}
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
        🌱 Soil Health
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

        <FormControl sx={{ minWidth: 150 }}>
          <InputLabel>Nutrient</InputLabel>
          <Select
            value={nutrientFilter}
            onChange={(e) => setNutrientFilter(e.target.value)}
          >
            <MenuItem value="">All</MenuItem>
            {nutrients.map(n => (
              <MenuItem key={n} value={n}>{n}</MenuItem>
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