import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  TextField,
  Typography,
} from "@mui/material";

import {
  createRegionDetails,
  getOrganizations,
} from "../../services/api";

// ============================================================
// TYPES
// ============================================================

interface Organization {
  id: number | string;
  name?: string;
  organization_name?: string;
}

interface CreateRegionProps {
  onGoToCreateFields?: () => void;
}

// ============================================================
// COUNTRY / STATE OPTIONS
// ============================================================

const COUNTRY_OPTIONS = [
  "India",
  "Peru",
  "United States",
  "Canada",
  "Australia",
  "United Kingdom",
  "Brazil",
  "Others",
];

const STATE_OPTIONS: Record<
  string,
  string[]
> = {
  India: [
    "Andhra Pradesh",
    "Telangana",
    "Karnataka",
    "Tamil Nadu",
    "Kerala",
    "Maharashtra",
    "Madhya Pradesh",
    "Uttar Pradesh",
    "Rajasthan",
    "Gujarat",
    "Odisha",
    "Punjab",
    "Haryana",
    "West Bengal",
    "Bihar",
    "Jharkhand",
    "Chhattisgarh",
    "Assam",
    "Goa",
    "Uttarakhand",
    "Himachal Pradesh",
    "Others",
  ],

  Peru: [
    "Lima",
    "Arequipa",
    "Cusco",
    "Piura",
    "La Libertad",
    "Junín",
    "Ica",
    "Others",
  ],

  "United States": [
    "California",
    "Texas",
    "Florida",
    "New York",
    "Washington",
    "Others",
  ],

  Canada: [
    "Ontario",
    "Quebec",
    "British Columbia",
    "Alberta",
    "Others",
  ],

  Australia: [
    "New South Wales",
    "Victoria",
    "Queensland",
    "Western Australia",
    "Others",
  ],

  "United Kingdom": [
    "England",
    "Scotland",
    "Wales",
    "Northern Ireland",
    "Others",
  ],

  Brazil: [
    "São Paulo",
    "Minas Gerais",
    "Paraná",
    "Bahia",
    "Rio Grande do Sul",
    "Others",
  ],
};

// ============================================================
// COMPONENT
// ============================================================

export default function CreateRegion({
  onGoToCreateFields,
}: CreateRegionProps) {
  const [
    organizations,
    setOrganizations,
  ] = useState<
    Organization[]
  >([]);

  const [
    organizationId,
    setOrganizationId,
  ] = useState("");

  const [
    country,
    setCountry,
  ] = useState("");

  const [
    customCountry,
    setCustomCountry,
  ] = useState("");

  const [
    state,
    setState,
  ] = useState("");

  const [
    customState,
    setCustomState,
  ] = useState("");

  const [
    regionName,
    setRegionName,
  ] = useState("");

  const [
    description,
    setDescription,
  ] = useState("");

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
    successOpen,
    setSuccessOpen,
  ] = useState(false);

  const [
    createdRegionId,
    setCreatedRegionId,
  ] = useState<
    string | number | null
  >(null);

  // ==========================================================
  // LOAD ONLY ORGANISATION OPTIONS
  //
  // IMPORTANT:
  // No getRegions()
  // No old region data fetch
  // No last-created-region autofill
  // ==========================================================

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
            Array.isArray(
              response
            )
              ? response
              : Array.isArray(
                    response
                      ?.organizations
                  )
                ? response
                    .organizations
                : Array.isArray(
                      response?.data
                    )
                  ? response.data
                  : [];

          setOrganizations(
            list
          );
        } catch (err) {
          console.error(
            "Failed to load organizations:",
            err
          );

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

  // ==========================================================
  // STATE OPTIONS
  // ==========================================================

  const availableStates =
    useMemo(() => {
      if (
        !country ||
        country === "Others"
      ) {
        return [];
      }

      return (
        STATE_OPTIONS[
          country
        ] ?? [
          "Others",
        ]
      );
    }, [
      country,
    ]);

  // ==========================================================
  // COUNTRY CHANGE
  // ==========================================================

  const handleCountryChange =
    (
      value: string
    ) => {
      setCountry(
        value
      );

      setState("");
      setCustomState("");

      if (
        value !==
        "Others"
      ) {
        setCustomCountry(
          ""
        );
      }

      setError("");
    };

  // ==========================================================
  // STATE CHANGE
  // ==========================================================

  const handleStateChange =
    (
      value: string
    ) => {
      setState(
        value
      );

      if (
        value !==
        "Others"
      ) {
        setCustomState(
          ""
        );
      }

      setError("");
    };

  // ==========================================================
  // CREATE REGION
  // ==========================================================

  const handleCreateRegion =
    async () => {
      setError("");

      const finalCountry =
        country ===
        "Others"
          ? customCountry.trim()
          : country;

      const finalState =
        country ===
        "Others"
          ? customState.trim()
          : state ===
              "Others"
            ? customState.trim()
            : state;

      if (
        !organizationId
      ) {
        setError(
          "Please select Organisation ID."
        );

        return;
      }

      if (
        !finalCountry
      ) {
        setError(
          "Please select or enter Country."
        );

        return;
      }

      if (
        !finalState
      ) {
        setError(
          "Please select or enter State."
        );

        return;
      }

      if (
        !regionName.trim()
      ) {
        setError(
          "Please enter Region Name."
        );

        return;
      }

      try {
        setSubmitting(
          true
        );

        // ==========================================
        // ONLY CREATE REGION API CALL
        // POST /s1/regions
        // ==========================================

        const response =
          await createRegionDetails(
            {
              organization_id:
                Number(
                  organizationId
                ),

              country:
                finalCountry,

              state:
                finalState,

              name:
                regionName.trim(),

              description:
                description.trim(),
            }
          );

        if (
          response?.success ===
          false
        ) {
          throw new Error(
            response?.details ||
              response?.error ||
              response?.message ||
              "Failed to create region."
          );
        }

        const regionId =
          response?.region_id ??
          response?.region
            ?.region_id ??
          response?.region
            ?.id ??
          response?.id;

        if (
          regionId ===
            undefined ||
          regionId === null
        ) {
          throw new Error(
            "Region created but region_id was not returned."
          );
        }

        const finalRegionName =
          response?.name ??
          response?.region
            ?.name ??
          regionName.trim();

        // ==========================================
        // SAVE REAL CREATED REGION FOR CREATE FIELDS
        // ==========================================

        localStorage.setItem(
          "lastCreatedRegion",
          JSON.stringify({
            regionId:
              String(
                regionId
              ),

            organizationId:
              String(
                organizationId
              ),

            country:
              response
                ?.country ??
              finalCountry,

            state:
              response
                ?.state ??
              finalState,

            regionName:
              finalRegionName,
          })
        );

        setCreatedRegionId(
          regionId
        );

        setSuccessOpen(
          true
        );
      } catch (err) {
        console.error(
          "Create region error:",
          err
        );

        setError(
          err instanceof Error
            ? err.message
            : "Failed to create region."
        );
      } finally {
        setSubmitting(
          false
        );
      }
    };

  // ==========================================================
  // UI
  // ==========================================================

  return (
    <>
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
            sx={{
              mb: 3,
            }}
          >
            📍 Create Region
          </Typography>

          {error && (
            <Alert
              severity="error"
              sx={{
                mb: 2,
              }}
            >
              {error}
            </Alert>
          )}

          {/* ========================================
              ORGANISATION DROPDOWN
          ======================================== */}

          <FormControl
            fullWidth
            required
            sx={{
              mb: 2,
            }}
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
                organizationId
              }
              label="Organisation ID"
              onChange={(e) =>
                setOrganizationId(
                  String(
                    e.target
                      .value
                  )
                )
              }
            >
              {organizations.map(
                (org) => (
                  <MenuItem
                    key={
                      org.id
                    }
                    value={String(
                      org.id
                    )}
                  >
                    {org.id}
                    {" — "}
                    {org.name ||
                      org.organization_name ||
                      "Organization"}
                  </MenuItem>
                )
              )}
            </Select>
          </FormControl>

          {loadingOrganizations && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                display:
                  "block",
                mb: 2,
              }}
            >
              Loading organisations...
            </Typography>
          )}

          {/* ========================================
              COUNTRY DROPDOWN
          ======================================== */}

          <FormControl
            fullWidth
            required
            sx={{
              mb: 2,
            }}
            disabled={
              submitting
            }
          >
            <InputLabel>
              Country
            </InputLabel>

            <Select
              value={
                country
              }
              label="Country"
              onChange={(e) =>
                handleCountryChange(
                  String(
                    e.target
                      .value
                  )
                )
              }
            >
              {COUNTRY_OPTIONS.map(
                (item) => (
                  <MenuItem
                    key={
                      item
                    }
                    value={
                      item
                    }
                  >
                    {item}
                  </MenuItem>
                )
              )}
            </Select>
          </FormControl>

          {/* COUNTRY = OTHERS */}

          {country ===
            "Others" && (
            <TextField
              fullWidth
              required
              label="Enter Country"
              value={
                customCountry
              }
              onChange={(e) =>
                setCustomCountry(
                  e.target
                    .value
                )
              }
              disabled={
                submitting
              }
              sx={{
                mb: 2,
              }}
            />
          )}

          {/* ========================================
              STATE DROPDOWN
          ======================================== */}

          {country !==
            "Others" ? (
            <FormControl
              fullWidth
              required
              sx={{
                mb: 2,
              }}
              disabled={
                !country ||
                submitting
              }
            >
              <InputLabel>
                State
              </InputLabel>

              <Select
                value={
                  state
                }
                label="State"
                onChange={(e) =>
                  handleStateChange(
                    String(
                      e.target
                        .value
                    )
                  )
                }
              >
                {availableStates.map(
                  (
                    item
                  ) => (
                    <MenuItem
                      key={
                        item
                      }
                      value={
                        item
                      }
                    >
                      {item}
                    </MenuItem>
                  )
                )}
              </Select>
            </FormControl>
          ) : (
            <TextField
              fullWidth
              required
              label="Enter State"
              value={
                customState
              }
              onChange={(e) =>
                setCustomState(
                  e.target
                    .value
                )
              }
              disabled={
                submitting
              }
              sx={{
                mb: 2,
              }}
            />
          )}

          {/* STATE = OTHERS */}

          {country !==
            "Others" &&
            state ===
              "Others" && (
              <TextField
                fullWidth
                required
                label="Enter State"
                value={
                  customState
                }
                onChange={(e) =>
                  setCustomState(
                    e.target
                      .value
                  )
                }
                disabled={
                  submitting
                }
                sx={{
                  mb: 2,
                }}
              />
            )}

          {/* ========================================
              REGION NAME
          ======================================== */}

          <TextField
            fullWidth
            required
            label="Region Name"
            value={
              regionName
            }
            onChange={(e) =>
              setRegionName(
                e.target.value
              )
            }
            disabled={
              submitting
            }
            sx={{
              mb: 2,
            }}
          />

          {/* ========================================
              DESCRIPTION
          ======================================== */}

          <TextField
            fullWidth
            label="Description"
            value={
              description
            }
            onChange={(e) =>
              setDescription(
                e.target.value
              )
            }
            disabled={
              submitting
            }
            multiline
            rows={3}
            sx={{
              mb: 3,
            }}
          />

          {/* ========================================
              CREATE REGION
          ======================================== */}

          <Button
            fullWidth
            variant="contained"
            onClick={
              handleCreateRegion
            }
            disabled={
              submitting ||
              loadingOrganizations
            }
            sx={{
              minHeight: 46,
            }}
          >
            {submitting ? (
              <>
                <CircularProgress
                  size={20}
                  color="inherit"
                  sx={{
                    mr: 1,
                  }}
                />

                CREATING...
              </>
            ) : (
              "CREATE REGION"
            )}
          </Button>
        </Paper>
      </Box>

      {/* ==========================================
          SUCCESS POPUP
      ========================================== */}

      <Dialog
        open={
          successOpen
        }
        onClose={() =>
          setSuccessOpen(
            false
          )
        }
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          Region Created
        </DialogTitle>

        <DialogContent>
          <Alert
            severity="success"
            sx={{
              mt: 1,
            }}
          >
            Create Region Lambda completed successfully.
            <br />
            Region ID:{" "}
            {createdRegionId}
          </Alert>
        </DialogContent>

        <DialogActions>
          <Button
            onClick={() =>
              setSuccessOpen(
                false
              )
            }
          >
            CLOSE
          </Button>

          {onGoToCreateFields && (
            <Button
              variant="contained"
              onClick={() => {
                setSuccessOpen(
                  false
                );

                onGoToCreateFields();
              }}
            >
              CREATE FIELDS
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </>
  );
}