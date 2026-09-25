import { useEffect, useState } from "react";
import {
  Box,
  Typography,
  TextField,
  Button,
  Select,
  MenuItem,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  Alert
} from "@mui/material";
import { createRecommendation, getRegions } from "../services/api";

export default function AddRecommendation() {

  const [regions, setRegions] = useState<any[]>([]);
  const [regionId, setRegionId] = useState("");
  const [nutrient, setNutrient] = useState("");
  const [date, setDate] = useState("");
  const [recommendation, setRecommendation] = useState("");

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    loadRegions();
  }, []);

  const loadRegions = async () => {
    try {
      const res = await getRegions();
      setRegions(res);
    } catch (e) {
      console.error("Failed to load regions");
    }
  };

  // -------------------------
  // SUBMIT
  // -------------------------
  const submit = async () => {

    setMsg("");
    setError("");

    // ✅ VALIDATION
    if (!regionId || !nutrient || !date || !recommendation) {
      setError("All fields are required");
      return;
    }

    try {
      setLoading(true);

      await createRecommendation({
        region_id: regionId,
        nutrient,
        report_date: date,
        recommendation
      });

      setMsg("✅ Recommendation added successfully");

      // RESET
      setRegionId("");
      setNutrient("");
      setDate("");
      setRecommendation("");

    } catch (e) {
      console.error(e);
      setError("❌ Failed to add recommendation");
    } finally {
      setLoading(false);
    }
  };

  // -------------------------
  // NUTRIENT OPTIONS
  // -------------------------
  const nutrients = [
    "Nitrogen",
    "Phosphorous",
    "Potassium",
    "Humus"
  ];

  return (
    <Box
      display="flex"
      justifyContent="center"
      alignItems="center"
      minHeight="80vh"
    >

      <Card sx={{ width: 500, borderRadius: 3, boxShadow: 3 }}>
        <CardContent>

          <Typography variant="h5" mb={3} textAlign="center">
            ➕ Add Recommendation
          </Typography>

          {/* REGION */}
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Region</InputLabel>
            <Select
              value={regionId}
              label="Region"
              onChange={(e) => setRegionId(e.target.value)}
            >
              {regions.map((r) => (
                <MenuItem key={r.region_id} value={r.region_id}>
                  {r.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* NUTRIENT */}
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Nutrient</InputLabel>
            <Select
              value={nutrient}
              label="Nutrient"
              onChange={(e) => setNutrient(e.target.value)}
            >
              {nutrients.map((n) => (
                <MenuItem key={n} value={n}>{n}</MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* DATE */}
          <TextField
            fullWidth
            type="date"
            label="Date"
            InputLabelProps={{ shrink: true }}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            sx={{ mb: 2 }}
          />

          {/* RECOMMENDATION */}
          <TextField
            fullWidth
            multiline
            rows={4}
            label="Recommendation"
            placeholder="Enter fertilizer or soil treatment advice..."
            value={recommendation}
            onChange={(e) => setRecommendation(e.target.value)}
            sx={{ mb: 2 }}
          />

          {/* BUTTON */}
          <Button
            fullWidth
            variant="contained"
            size="large"
            onClick={submit}
            disabled={loading}
          >
            {loading ? "Submitting..." : "Submit Recommendation"}
          </Button>

          {/* SUCCESS */}
          {msg && (
            <Alert severity="success" sx={{ mt: 2 }}>
              {msg}
            </Alert>
          )}

          {/* ERROR */}
          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}

        </CardContent>
      </Card>

    </Box>
  );
}