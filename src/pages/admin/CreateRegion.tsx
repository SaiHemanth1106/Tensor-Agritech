import {
  useEffect,
  useState,
} from "react";

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
  TextField,
  Typography,
} from "@mui/material";

import {
  createRegion,
  getOrganizations,
} from "../../services/regionApi";

interface Organization {
  id: number;
  name: string;
}

interface RegionForm {
  organizationId: string;
  country: string;
  state: string;
  name: string;
  description: string;
}

const initialForm: RegionForm = {
  organizationId: "",
  country: "",
  state: "",
  name: "",
  description: "",
};

const extractOrganizations = (
  response: any
): Organization[] => {
  if (Array.isArray(response)) {
    return response;
  }

  if (
    Array.isArray(
      response?.organizations
    )
  ) {
    return response.organizations;
  }

  if (
    Array.isArray(response?.data)
  ) {
    return response.data;
  }

  return [];
};

export default function CreateRegion() {
  const [
    organizations,
    setOrganizations,
  ] = useState<Organization[]>([]);

  const [
    form,
    setForm,
  ] = useState<RegionForm>(
    initialForm
  );

  const [
    loadingOrganizations,
    setLoadingOrganizations,
  ] = useState(true);

  const [
    submitting,
    setSubmitting,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    success,
    setSuccess,
  ] = useState("");

  useEffect(() => {
    const loadOrganizations =
      async () => {
        try {
          setLoadingOrganizations(
            true
          );

          setError("");

          const response =
            await getOrganizations();

          setOrganizations(
            extractOrganizations(
              response
            )
          );
        } catch (err) {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to load organizations."
          );
        } finally {
          setLoadingOrganizations(
            false
          );
        }
      };

    void loadOrganizations();
  }, []);

  const updateField = (
    field: keyof RegionForm,
    value: string
  ) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleSubmit =
    async () => {
      setError("");
      setSuccess("");

      if (!form.organizationId) {
        setError(
          "Please select Organisation ID."
        );

        return;
      }

      if (!form.country.trim()) {
        setError(
          "Please enter Country."
        );

        return;
      }

      if (!form.state.trim()) {
        setError(
          "Please enter State."
        );

        return;
      }

      if (!form.name.trim()) {
        setError(
          "Please enter Region Name."
        );

        return;
      }

      if (
        !form.description.trim()
      ) {
        setError(
          "Please enter Description."
        );

        return;
      }

      try {
        setSubmitting(true);

        const result =
          await createRegion({
            organization_id:
              Number(
                form.organizationId
              ),

            country:
              form.country.trim(),

            state:
              form.state.trim(),

            name:
              form.name.trim(),

            description:
              form.description.trim(),
          });

        if (
          result?.success ===
          false
        ) {
          throw new Error(
            result?.error ||
              result?.message ||
              "Region creation failed."
          );
        }

        const regionId =
          result?.region_id ??
          result?.region?.region_id ??
          result?.id;

        if (!regionId) {
          throw new Error(
            "Region was created but region_id was not returned."
          );
        }

        const regionData = {
          regionId:
            String(regionId),

          organizationId:
            String(
              result?.organization_id ??
                form.organizationId
            ),

          country:
            result?.country ??
            form.country.trim(),

          state:
            result?.state ??
            form.state.trim(),

          regionName:
            result?.name ??
            form.name.trim(),

          description:
            result?.description ??
            form.description.trim(),
        };

        localStorage.setItem(
          "lastCreatedRegion",
          JSON.stringify(
            regionData
          )
        );

        localStorage.setItem(
          "lastCreatedRegionId",
          String(regionId)
        );

        setSuccess(
          `Region created successfully. Region ID: ${regionId}`
        );

        setForm(initialForm);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to create region."
        );
      } finally {
        setSubmitting(false);
      }
    };

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
          mb={1}
        >
          📍 Create Region
        </Typography>

        <Typography
          variant="body2"
          color="text.secondary"
          mb={3}
        >
          Create the region first.
          KML upload is available
          separately under Create
          Field.
        </Typography>

        {error && (
          <Alert
            severity="error"
            sx={{ mb: 2 }}
          >
            {error}
          </Alert>
        )}

        {success && (
          <Alert
            severity="success"
            sx={{ mb: 2 }}
          >
            {success}
          </Alert>
        )}

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
            Organisation ID
          </InputLabel>

          <Select
            value={
              form.organizationId
            }
            label="Organisation ID"
            onChange={(event) =>
              updateField(
                "organizationId",
                String(
                  event.target.value
                )
              )
            }
          >
            {organizations.map(
              (organization) => (
                <MenuItem
                  key={
                    organization.id
                  }
                  value={
                    organization.id
                  }
                >
                  {organization.id} —{" "}
                  {organization.name}
                </MenuItem>
              )
            )}
          </Select>
        </FormControl>

        <TextField
          fullWidth
          required
          label="Country"
          value={form.country}
          disabled={submitting}
          onChange={(event) =>
            updateField(
              "country",
              event.target.value
            )
          }
          sx={{ mb: 2 }}
        />

        <TextField
          fullWidth
          required
          label="State"
          value={form.state}
          disabled={submitting}
          onChange={(event) =>
            updateField(
              "state",
              event.target.value
            )
          }
          sx={{ mb: 2 }}
        />

        <TextField
          fullWidth
          required
          label="Region Name"
          value={form.name}
          disabled={submitting}
          onChange={(event) =>
            updateField(
              "name",
              event.target.value
            )
          }
          sx={{ mb: 2 }}
        />

        <TextField
          fullWidth
          required
          multiline
          rows={3}
          label="Description"
          value={
            form.description
          }
          disabled={submitting}
          onChange={(event) =>
            updateField(
              "description",
              event.target.value
            )
          }
          sx={{ mb: 3 }}
        />

        <Button
          fullWidth
          variant="contained"
          disabled={submitting}
          onClick={handleSubmit}
          sx={{
            minHeight: 45,
            backgroundColor:
              "#075d16",

            "&:hover": {
              backgroundColor:
                "#064d12",
            },
          }}
        >
          {submitting ? (
            <>
              <CircularProgress
                size={21}
                color="inherit"
                sx={{ mr: 1 }}
              />

              CREATING...
            </>
          ) : (
            "CREATE REGION"
          )}
        </Button>
      </Paper>
    </Box>
  );
}