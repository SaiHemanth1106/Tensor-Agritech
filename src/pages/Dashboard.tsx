import {
  Box,
  Typography,
  Grid,
  Paper,
  MenuItem,
  Select,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Chip
} from "@mui/material";

import { useEffect, useState } from "react";
import { getRegions, getSoilSummary, getCropSummary } from "../services/api";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer
} from "recharts";

export default function Dashboard() {

  const [regions, setRegions] = useState<any[]>([]);
  const [soil, setSoil] = useState<any[]>([]);
  const [crop, setCrop] = useState<any[]>([]);

  const [selectedNutrient, setSelectedNutrient] = useState("Nitrogen");
  const [selectedMetric, setSelectedMetric] = useState("NDVI");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setRegions(await getRegions());
    setSoil(await getSoilSummary());
    setCrop(await getCropSummary());
  };

  // -------------------------
  // LABELS
  // -------------------------
  const cropLabels: any = {
    NDVI: "Crop Health",
    NDMI: "Soil Moisture",
    GCI: "Chlorophyll Level",
    SAVI: "Crop Health (Soil Adjusted)"
  };

  const soilUnits: any = {
    Nitrogen: "mg/kg",
    Phosphorous: "mg/kg",
    Potassium: "mg/kg",
    Humus: "%"
  };

  // -------------------------
  // NORMALIZATION FIX
  // -------------------------
  const normalize = (v: string) =>
    v?.toLowerCase().replace(/\s/g, "");

  // -------------------------
  // TRENDS
  // -------------------------
  const soilTrend = soil
    .filter(i => normalize(i.nutrient) === normalize(selectedNutrient))
    .map(i => ({
      date: i.date,
      value: Number(i.value)
    }));

  const cropTrend = crop
    .filter(i => i.metric === selectedMetric)
    .map(i => ({
      date: i.date,
      value: Number(i.value)
    }));

  // -------------------------
  // COLOR LOGIC
  // -------------------------
  const getColor = (val: number) => {
    if (val < 5) return "error";
    if (val < 20) return "warning";
    return "success";
  };

  // -------------------------
  // LATEST VALUES
  // -------------------------
  const latestSoil: Record<string, any> = {};
  soil.forEach(i => {
    const key = i.region + "_" + i.nutrient;
    if (!latestSoil[key] || new Date(i.date) > new Date(latestSoil[key].date)) {
      latestSoil[key] = i;
    }
  });

  const latestCrop: Record<string, any> = {};
  crop.forEach(i => {
    const key = i.region + "_" + i.metric;
    if (!latestCrop[key] || new Date(i.date) > new Date(latestCrop[key].date)) {
      latestCrop[key] = i;
    }
  });

  return (
    <Box>

      <Typography variant="h5" mb={2}>📊 Dashboard</Typography>

      {/* KPI */}
      <Grid container spacing={2} mb={3}>
        <Grid size={{ xs: 6 }}>
          <Paper sx={{ p: 2 }}>
            <Typography>Total Regions</Typography>
            <Typography variant="h6">{regions.length}</Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* SOIL TREND */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box display="flex" justifyContent="space-between" mb={2}>
          <Typography>Soil Trend</Typography>

          <Select
            value={selectedNutrient}
            onChange={(e) => setSelectedNutrient(e.target.value)}
          >
            <MenuItem value="Nitrogen">Nitrogen</MenuItem>
            <MenuItem value="Phosphorous">Phosphorous</MenuItem>
            <MenuItem value="Potassium">Potassium</MenuItem>
            <MenuItem value="Humus">Humus</MenuItem>
          </Select>
        </Box>

        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={soilTrend}>
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Line dataKey="value" />
          </LineChart>
        </ResponsiveContainer>
      </Paper>

      {/* CROP TREND */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box display="flex" justifyContent="space-between" mb={2}>
          <Typography>{cropLabels[selectedMetric]} Trend</Typography>

          <Select
            value={selectedMetric}
            onChange={(e) => setSelectedMetric(e.target.value)}
          >
            <MenuItem value="NDVI">{cropLabels.NDVI}</MenuItem>
            <MenuItem value="NDMI">{cropLabels.NDMI}</MenuItem>
            <MenuItem value="GCI">{cropLabels.GCI}</MenuItem>
            <MenuItem value="SAVI">{cropLabels.SAVI}</MenuItem>
          </Select>
        </Box>

        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={cropTrend}>
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Line dataKey="value" />
          </LineChart>
        </ResponsiveContainer>
      </Paper>

      {/* TABLES */}
      <Grid container spacing={2}>
        {/* SOIL TABLE */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 2 }}>
            <Typography mb={2}>Latest Soil Values</Typography>

            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Region</TableCell>
                  <TableCell>Nutrient</TableCell>
                  <TableCell>Value</TableCell>
                  <TableCell>Date</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {Object.values(latestSoil).map((i: any, idx) => (
                  <TableRow key={idx}>
                    <TableCell>{i.region}</TableCell>
                    <TableCell>{i.nutrient}</TableCell>
                    <TableCell>
                      <Chip
                        label={`${i.value} ${soilUnits[i.nutrient]}`}
                        color={getColor(Number(i.value))}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>{i.date}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
        </Grid>

        {/* CROP TABLE */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 2 }}>
            <Typography mb={2}>Latest Crop Health</Typography>

            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Region</TableCell>
                  <TableCell>Metric</TableCell>
                  <TableCell>Value</TableCell>
                  <TableCell>Date</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {Object.values(latestCrop).map((i: any, idx) => (
                  <TableRow key={idx}>
                    <TableCell>{i.region}</TableCell>
                    <TableCell>{cropLabels[i.metric]}</TableCell>
                    <TableCell>
                      <Chip
                        label={i.value}
                        color={getColor(Number(i.value))}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>{i.date}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
        </Grid>

      </Grid>

    </Box>
  );
}