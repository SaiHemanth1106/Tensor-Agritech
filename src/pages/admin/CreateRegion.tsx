import {
  useEffect,
  useState
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
  Typography
} from "@mui/material";

import {
  getOrganizations
} from "../../services/api";


// ============================================================
// TYPES
// ============================================================

interface Organization {
  id: number;
  name: string;
}

interface StaticRegion {
  regionId: string;
  organizationId: string;
  country: string;
  state: string;
  name: string;
  description: string;
}


// ============================================================
// STORAGE
// ============================================================

const REGION_STORAGE_KEY =
  "frontendStaticRegions";


// ============================================================
// ORGANIZATION RESPONSE HELPER
// ============================================================

const getOrganizationList = (
  response: any
): Organization[] => {

  if (
    Array.isArray(response)
  ) {
    return response;
  }

  if (
    response &&
    Array.isArray(
      response.organizations
    )
  ) {
    return response.organizations;
  }

  if (
    response &&
    Array.isArray(
      response.data
    )
  ) {
    return response.data;
  }

  return [];
};


// ============================================================
// COMPONENT
// ============================================================

export default function CreateRegion() {

  const [
    organizations,
    setOrganizations
  ] =
    useState<
      Organization[]
    >([]);

  const [
    organizationId,
    setOrganizationId
  ] =
    useState("");

  const [
    country,
    setCountry
  ] =
    useState("");

  const [
    state,
    setState
  ] =
    useState("");

  const [
    regionName,
    setRegionName
  ] =
    useState("");

  const [
    description,
    setDescription
  ] =
    useState("");

  const [
    loadingOrganizations,
    setLoadingOrganizations
  ] =
    useState(true);

  const [
    error,
    setError
  ] =
    useState("");

  const [
    success,
    setSuccess
  ] =
    useState("");


  // ============================================================
  // LOAD ORGANIZATIONS
  // ============================================================

  useEffect(() => {

    const loadOrganizations =
      async () => {

        try {

          setLoadingOrganizations(
            true
          );

          const response =
            await getOrganizations();

          const list =
            getOrganizationList(
              response
            );

          setOrganizations(
            list
          );

        } catch (
          loadError
        ) {

          console.error(
            "Failed to load organizations:",
            loadError
          );

          setError(
            "Failed to load organizations."
          );

        } finally {

          setLoadingOrganizations(
            false
          );

        }

      };

    void loadOrganizations();

  }, []);


  // ============================================================
  // CREATE REGION - FRONTEND ONLY
  // ============================================================

  const handleCreateRegion =
    () => {

      setError("");
      setSuccess("");

      if (
        !organizationId ||
        !country.trim() ||
        !state.trim() ||
        !regionName.trim() ||
        !description.trim()
      ) {

        setError(
          "Please fill all region details."
        );

        return;
      }


      // --------------------------------------------------------
      // LOAD PREVIOUS STATIC REGIONS
      // --------------------------------------------------------

      let existingRegions:
        StaticRegion[] = [];

      try {

        const stored =
          localStorage.getItem(
            REGION_STORAGE_KEY
          );

        if (stored) {

          const parsed =
            JSON.parse(
              stored
            );

          if (
            Array.isArray(
              parsed
            )
          ) {

            existingRegions =
              parsed;

          }

        }

      } catch {

        existingRegions = [];

      }


      // --------------------------------------------------------
      // DUPLICATE CHECK
      // --------------------------------------------------------

      const duplicate =
        existingRegions.some(
          (region) =>

            String(
              region.organizationId
            ) ===
              String(
                organizationId
              ) &&

            region.name
              .trim()
              .toLowerCase() ===
              regionName
                .trim()
                .toLowerCase()

        );

      if (duplicate) {

        setError(
          "This region already exists for the selected organization."
        );

        return;
      }


      // --------------------------------------------------------
      // CREATE FRONTEND REGION
      // --------------------------------------------------------

      const newRegion:
        StaticRegion = {

        regionId:
          `STATIC-${Date.now()}`,

        organizationId:
          String(
            organizationId
          ),

        country:
          country.trim(),

        state:
          state.trim(),

        name:
          regionName.trim(),

        description:
          description.trim()

      };


      // --------------------------------------------------------
      // SAVE LOCALLY
      // --------------------------------------------------------

      localStorage.setItem(
        REGION_STORAGE_KEY,

        JSON.stringify([
          ...existingRegions,
          newRegion
        ])
      );


      // --------------------------------------------------------
      // SUCCESS
      // --------------------------------------------------------

      setSuccess(
        `Region "${newRegion.name}" created successfully.`
      );


      // --------------------------------------------------------
      // RESET FORM
      // --------------------------------------------------------

      setOrganizationId("");
      setCountry("");
      setState("");
      setRegionName("");
      setDescription("");

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
          borderRadius: 3
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
          Enter the region details.
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

        {success && (

          <Alert
            severity="success"
            sx={{ mb: 2 }}
          >
            {success}
          </Alert>

        )}


        {/* ==================================================== */}
        {/* ORGANIZATION */}
        {/* ==================================================== */}

        <FormControl
          fullWidth
          required
          sx={{ mb: 2 }}
        >

          <InputLabel>
            Organisation ID
          </InputLabel>

          <Select
            value={
              organizationId
            }

            label="Organisation ID"

            disabled={
              loadingOrganizations
            }

            onChange={(
              event
            ) => {

              setOrganizationId(
                String(
                  event.target.value
                )
              );

            }}
          >

            {organizations.map(
              (organization) => (

                <MenuItem
                  key={
                    organization.id
                  }

                  value={
                    String(
                      organization.id
                    )
                  }
                >
                  {organization.id}
                  {" — "}
                  {organization.name}
                </MenuItem>

              )
            )}

          </Select>

        </FormControl>


        {loadingOrganizations && (

          <Box
            display="flex"
            alignItems="center"
            gap={1}
            mb={2}
          >

            <CircularProgress
              size={18}
            />

            <Typography
              variant="body2"
              color="text.secondary"
            >
              Loading organizations...
            </Typography>

          </Box>

        )}


        {/* ==================================================== */}
        {/* COUNTRY */}
        {/* ==================================================== */}

        <TextField
          fullWidth
          required

          label="Country"

          value={
            country
          }

          onChange={(
            event
          ) =>
            setCountry(
              event.target.value
            )
          }

          sx={{ mb: 2 }}
        />


        {/* ==================================================== */}
        {/* STATE */}
        {/* ==================================================== */}

        <TextField
          fullWidth
          required

          label="State"

          value={
            state
          }

          onChange={(
            event
          ) =>
            setState(
              event.target.value
            )
          }

          sx={{ mb: 2 }}
        />


        {/* ==================================================== */}
        {/* REGION NAME */}
        {/* ==================================================== */}

        <TextField
          fullWidth
          required

          label="Region Name"

          value={
            regionName
          }

          onChange={(
            event
          ) =>
            setRegionName(
              event.target.value
            )
          }

          sx={{ mb: 2 }}
        />


        {/* ==================================================== */}
        {/* DESCRIPTION */}
        {/* ==================================================== */}

        <TextField
          fullWidth
          required
          multiline
          minRows={3}

          label="Description"

          value={
            description
          }

          onChange={(
            event
          ) =>
            setDescription(
              event.target.value
            )
          }

          sx={{ mb: 3 }}
        />


        {/* ==================================================== */}
        {/* CREATE */}
        {/* ==================================================== */}

        <Button
          fullWidth

          variant="contained"

          onClick={
            handleCreateRegion
          }

          sx={{
            py: 1.3,

            backgroundColor:
              "#2D6A4F",

            "&:hover": {
              backgroundColor:
                "#1B4332"
            }
          }}
        >
          Create Region
        </Button>

      </Paper>

    </Box>

  );
}