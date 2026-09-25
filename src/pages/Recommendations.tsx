import { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Select,
  MenuItem,
  Card,
  CardContent
} from "@mui/material";
import { getRecommendations } from "../services/api";

export default function Recommendations() {
  const [data, setData] = useState<any[]>([]);
  const [region, setRegion] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const res = await getRecommendations();
    setData(res);
  };

  // 🔹 Filter
  const filtered = region
    ? data.filter((d) => d.region === region)
    : data;

  const regions = [...new Set(data.map((d) => d.region))];

  return (
    <Box>

      {/* 🔹 Title */}
      <Typography variant="h5" mb={2}>
        Soil Recommendations
      </Typography>

      {/* 🔹 Filter */}
      <Box mb={3}>
        <Select
          value={region}
          displayEmpty
          onChange={(e) => setRegion(e.target.value)}
        >
          <MenuItem value="">All Regions</MenuItem>
          {regions.map((r) => (
            <MenuItem key={r} value={r}>{r}</MenuItem>
          ))}
        </Select>
      </Box>

      {/* 🔹 Cards */}
      <Box display="grid" gap={2}>

        {filtered.map((item) => (
          <Card key={item.id}>
            <CardContent>

              <Typography variant="h6">
                {item.region}
              </Typography>

              <Typography>
                <b>Nutrient:</b> {item.nutrient}
              </Typography>

              <Typography>
                <b>Date:</b> {item.date}
              </Typography>

              <Typography mt={1} color="green">
                {item.recommendation}
              </Typography>

            </CardContent>
          </Card>
        ))}

      </Box>
    </Box>
  );
}