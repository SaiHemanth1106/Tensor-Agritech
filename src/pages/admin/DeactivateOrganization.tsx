import { useEffect, useState } from "react";
import {
  Box,
  Select,
  MenuItem,
  Button,
  Typography,
  CircularProgress,
  Alert,
  FormControl,
  InputLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from "@mui/material";

import {
  getOrganizations,
  deactivateOrganization
} from "../../services/api";

export default function DeactivateOrganization() {

  const [orgs, setOrgs] = useState<any[]>([]);
  const [selected, setSelected] = useState("");

  const [loading, setLoading] = useState(false);
  const [btnLoading, setBtnLoading] = useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [confirmOpen, setConfirmOpen] = useState(false);

  // =========================
  // Helper functions (IMPORTANT)
  const showError = (msg: string) => {
    setMessage("");        // clear success
    setError(msg);         // set error
  };

  const showSuccess = (msg: string) => {
    setError("");          // clear error
    setMessage(msg);       // set success
  };

  const clearMessages = () => {
    setError("");
    setMessage("");
  };

  // =========================
  const fetchOrgs = async () => {
    try {
      clearMessages();     // ✅ ALWAYS clear before API call
      setLoading(true);

      const data = await getOrganizations();
      const active = data.filter((o: any) => o.is_active !== false);
      setOrgs(active);

    } catch (e: any) {
      showError(e?.message || "Failed to load organizations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrgs();
  }, []);

  // =========================
  const handleDeactivate = async () => {
    try {
      clearMessages();     // ✅ clear previous message
      setBtnLoading(true);

      await deactivateOrganization(Number(selected));

      showSuccess("Organization deactivated successfully");

      setSelected("");
      fetchOrgs();
      setConfirmOpen(false);

    } catch (e: any) {
      showError(e?.message || "Failed to deactivate");
    } finally {
      setBtnLoading(false);
    }
  };

  return (
    <Box maxWidth={500} mx="auto">

      <Typography variant="h5" mb={3}>
        🚫 Deactivate Organization
      </Typography>

      {loading ? (
        <CircularProgress />
      ) : (
        <>
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Select Organization</InputLabel>

            <Select
              value={selected}
              label="Select Organization"
              onChange={(e) => setSelected(e.target.value)}
            >
              {orgs.map((o) => (
                <MenuItem key={o.id} value={o.id}>
                  {o.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* ✅ ONLY ONE MESSAGE WILL EVER SHOW */}
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          {message && <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert>}

          <Button
            fullWidth
            variant="contained"
            color="error"
            disabled={!selected}
            onClick={() => setConfirmOpen(true)}
          >
            Deactivate
          </Button>

          {/* ✅ CONFIRMATION DIALOG */}
          <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
            <DialogTitle>Confirm Deactivation</DialogTitle>

            <DialogContent>
              Are you sure you want to deactivate this organization?
            </DialogContent>

            <DialogActions>
              <Button onClick={() => setConfirmOpen(false)}>
                Cancel
              </Button>

              <Button
                color="error"
                onClick={handleDeactivate}
                disabled={btnLoading}
              >
                {btnLoading ? <CircularProgress size={20} /> : "Confirm"}
              </Button>
            </DialogActions>
          </Dialog>
        </>
      )}

    </Box>
  );
}