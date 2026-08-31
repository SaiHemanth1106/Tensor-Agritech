import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import VisibilityIcon from "@mui/icons-material/Visibility";
import { getRegions } from "../../services/api";

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

const formatValue = (value: unknown) => {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
};

export default function RegionManagement() {
  const [regions, setRegions] = useState<Region[]>([]);
  const [selectedRegion, setSelectedRegion] = useState<Region | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadRegions = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      setRegions(getRegionList(await getRegions()));
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
  }, []);

  useEffect(() => {
    void loadRegions();
  }, [loadRegions]);

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h5" fontWeight="bold">Region Management</Typography>
          <Typography variant="body2" color="text.secondary">Review the regions currently returned by the database.</Typography>
        </Box>
        <Button variant="outlined" startIcon={<RefreshIcon />} onClick={() => void loadRegions()} disabled={loading}>
          Refresh
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Paper variant="outlined">
        {loading ? (
          <Box display="flex" justifyContent="center" p={5}><CircularProgress /></Box>
        ) : regions.length === 0 ? (
          <Box p={4}><Typography color="text.secondary">No regions were returned by the API.</Typography></Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>ID</TableCell>
                  <TableCell>Name</TableCell>
                  <TableCell>Organization</TableCell>
                  <TableCell>Area</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Details</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {regions.map((region, index) => (
                  <TableRow key={valueFor(region, "id", "region_id") !== "-" ? valueFor(region, "id", "region_id") : index} hover>
                    <TableCell>{valueFor(region, "id", "region_id")}</TableCell>
                    <TableCell>{valueFor(region, "name", "region_name")}</TableCell>
                    <TableCell>{valueFor(region, "organization_name", "organization_id", "org_name")}</TableCell>
                    <TableCell>{valueFor(region, "region_area", "area")}</TableCell>
                    <TableCell>{region.is_active === false ? "Inactive" : "Active"}</TableCell>
                    <TableCell align="right">
                      <Button size="small" startIcon={<VisibilityIcon />} onClick={() => setSelectedRegion(region)}>View</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      <Dialog open={Boolean(selectedRegion)} onClose={() => setSelectedRegion(null)} fullWidth maxWidth="md">
        <DialogTitle>Region Details</DialogTitle>
        <DialogContent dividers>
          {selectedRegion && Object.entries(selectedRegion).map(([key, value]) => (
            <Box key={key} display="grid" gridTemplateColumns={{ xs: "1fr", sm: "180px 1fr" }} gap={1} py={1} borderBottom="1px solid" borderColor="divider">
              <Typography fontWeight="medium">{key.replaceAll("_", " ")}</Typography>
              <Typography component="pre" sx={{ m: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: "inherit" }}>
                {formatValue(value)}
              </Typography>
            </Box>
          ))}
        </DialogContent>
      </Dialog>
    </Box>
  );
}
