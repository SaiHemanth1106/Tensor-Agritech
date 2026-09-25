import { useState } from "react";
import {
  Box,
  TextField,
  Button,
  Typography,
  Paper,
  CircularProgress,
  Alert
} from "@mui/material";

import { createOrganization } from "../../services/api";

export default function CreateOrganization() {

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // =========================
  // SUBMIT HANDLER
  // =========================
  const handleSubmit = async () => {

    setError("");
    setMessage("");

    if (!name.trim()) {
      setError("Organization name is required");
      return;
    }

    try {
      setLoading(true);

      await createOrganization({
        name: name.trim(),
        description: description.trim()
      });

      setMessage("Organization created successfully");

      // Reset form
      setName("");
      setDescription("");

      // ✅ Auto-clear message after 3 sec
      setTimeout(() => setMessage(""), 3000);

    } catch (err: any) {

      // ✅ Better error extraction
      const apiError =
        err?.message ||
        err?.error ||
        err?.response?.data?.message ||
        "Failed to create organization";

      setError(apiError);

    } finally {
      setLoading(false);
    }
  };

  return (
    <Box maxWidth={500} mx="auto">

      <Paper elevation={3} sx={{ p: 4, borderRadius: 3 }}>

        {/* TITLE */}
        <Typography variant="h5" fontWeight="bold" mb={3}>
          🏢 Create Organization
        </Typography>

        {/* NAME */}
        <TextField
          label="Organization Name"
          fullWidth
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          sx={{ mb: 2 }}
        />

        {/* DESCRIPTION */}
        <TextField
          label="Description"
          fullWidth
          multiline
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          sx={{ mb: 3 }}
        />

        {/* ERROR */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* SUCCESS */}
        {message && (
          <Alert severity="success" sx={{ mb: 2 }}>
            {message}
          </Alert>
        )}

        {/* BUTTON */}
        <Button
          variant="contained"
          fullWidth
          onClick={handleSubmit}
          disabled={loading || !name.trim()} // ✅ disable if empty
          sx={{
            bgcolor: "#2D6A4F",
            "&:hover": { bgcolor: "#1B4332" }
          }}
        >
          {loading ? (
            <CircularProgress size={24} color="inherit" />
          ) : (
            "Create Organization"
          )}
        </Button>

      </Paper>

    </Box>
  );
}