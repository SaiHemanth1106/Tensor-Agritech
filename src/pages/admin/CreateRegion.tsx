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
  Snackbar,
  TextField,
  Typography,
} from "@mui/material";

import { createRegion, getOrganizations } from "../../services/api";

interface Organization {
  id: number;
  name: string;
}

const initialForm = {
  organizationId: "",
  country: "",
  state: "",
  name: "",
  description: "",
};

export default function CreateRegion() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);

  const [form, setForm] = useState(initialForm);

  const [loadingOrganizations, setLoadingOrganizations] =
    useState(true);

  const [submitting, setSubmitting] = useState(false);

  const [error, setError] = useState("");

  const [message, setMessage] = useState("");

  const [notification, setNotification] = useState({
    open: false,
    message: "",
    severity: "success" as "success" | "error",
  });

  // ============================================================
  // LOAD ORGANIZATIONS
  // ============================================================

  useEffect(() => {
    const loadOrganizations = async () => {
      try {
        const result = await getOrganizations();

        setOrganizations(result);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load organizations."
        );
      } finally {
        setLoadingOrganizations(false);
      }
    };

    void loadOrganizations();
  }, []);

  // ============================================================
  // UPDATE FORM
  // ============================================================

  const updateField = (
    field: keyof typeof form,
    value: string
  ) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  // ============================================================
  // NOTIFICATION
  // ============================================================

  const showNotification = (
    severity: "success" | "error",
    message: string
  ) => {
    setNotification({
      open: true,
      severity,
      message,
    });
  };

  // ============================================================
  // CREATE REGION
  // ============================================================

  const handleSubmit = async () => {
    setError("");
    setMessage("");

    if (
      !form.organizationId.trim() ||
      !form.country.trim() ||
      !form.state.trim() ||
      !form.name.trim() ||
      !form.description.trim()
    ) {
      const validationError =
        "Please fill in all region details.";

      setError(validationError);

      showNotification(
        "error",
        validationError
      );

      return;
    }

    try {
      setSubmitting(true);

      const result = await createRegion({
        organization_id: Number(form.organizationId),
        country: form.country.trim(),
        state: form.state.trim(),
        name: form.name.trim(),
        description: form.description.trim(),
      });

      const regionId =
        result?.region?.region_id ??
        result?.region_id;

      const successMessage = regionId
        ? `Region created successfully. Region ID: ${regionId}`
        : "Region created successfully.";

      setMessage(successMessage);

      showNotification(
        "success",
        successMessage
      );

      setForm(initialForm);

    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : "Failed to create region.";

      setError(errorMessage);

      showNotification(
        "error",
        errorMessage
      );
    } finally {
      setSubmitting(false);
    }
  };

  // ============================================================
  // UI
  // ============================================================

  return (
    <Box
      maxWidth={650}
      mx="auto"
    >
      <Paper
        elevation={3}
        sx={{
          p: 4,
          borderRadius: 3,
        }}
      >
        <Typography
          variant="h5"
          fontWeight="bold"
          mb={3}
        >
          📍 Create Region
        </Typography>

        {/* ERROR */}

        {error && (
          <Alert
            severity="error"
            sx={{ mb: 2 }}
          >
            {error}
          </Alert>
        )}

        {/* SUCCESS */}

        {message && (
          <Alert
            severity="success"
            sx={{ mb: 2 }}
          >
            {message}
          </Alert>
        )}

        {/* ORGANIZATION */}

        <FormControl
          fullWidth
          required
          sx={{ mb: 2 }}
          disabled={
            loadingOrganizations ||
            submitting
          }
        >
          <InputLabel>
            Organisation
          </InputLabel>

          <Select
            value={form.organizationId}
            label="Organisation"
            onChange={(event) =>
              updateField(
                "organizationId",
                event.target.value
              )
            }
          >
            {organizations.map((organization) => (
              <MenuItem
                key={organization.id}
                value={organization.id}
              >
                {organization.id} —{" "}
                {organization.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* COUNTRY */}

        <TextField
          label="Country"
          fullWidth
          required
          disabled={submitting}
          sx={{ mb: 2 }}
          value={form.country}
          onChange={(event) =>
            updateField(
              "country",
              event.target.value
            )
          }
        />

        {/* STATE */}

        <TextField
          label="State"
          fullWidth
          required
          disabled={submitting}
          sx={{ mb: 2 }}
          value={form.state}
          onChange={(event) =>
            updateField(
              "state",
              event.target.value
            )
          }
        />

        {/* REGION NAME */}

        <TextField
          label="Region Name"
          fullWidth
          required
          disabled={submitting}
          sx={{ mb: 2 }}
          value={form.name}
          onChange={(event) =>
            updateField(
              "name",
              event.target.value
            )
          }
        />

        {/* DESCRIPTION */}

        <TextField
          label="Description"
          fullWidth
          required
          multiline
          rows={4}
          disabled={submitting}
          sx={{ mb: 3 }}
          value={form.description}
          onChange={(event) =>
            updateField(
              "description",
              event.target.value
            )
          }
        />

        {/* CREATE BUTTON */}

        <Button
          variant="contained"
          fullWidth
          onClick={handleSubmit}
          disabled={
            submitting ||
            loadingOrganizations
          }
        >
          {submitting ? (
            <CircularProgress
              size={24}
              color="inherit"
            />
          ) : (
            "Create Region"
          )}
        </Button>
      </Paper>

      {/* SNACKBAR */}

      <Snackbar
        open={notification.open}
        autoHideDuration={5000}
        onClose={() =>
          setNotification((current) => ({
            ...current,
            open: false,
          }))
        }
      >
        <Alert
          severity={notification.severity}
          variant="filled"
          onClose={() =>
            setNotification((current) => ({
              ...current,
              open: false,
            }))
          }
        >
          {notification.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}