import { useEffect, useMemo, useState } from "react";

import type { ChangeEvent } from "react";

import { Country, State } from "country-state-city";




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

  Typography,

} from "@mui/material";



import {

  getOrganizations,

  getFieldRegions,

  uploadRegionKml,

} from "../../services/api";



type Region = Record<string, any>;



interface Organization {

  id: number | string;

  name: string;

  is_active?: boolean;

}



interface CreateFieldProps {

  onGoToCropDetails?: (

regionId: string,

regionName: string

  ) => void;

  onNavigate?: (page: string) => void;

}



const getList = (response: any): any[] => {

  if (Array.isArray(response)) return response;



  if (Array.isArray(response?.organizations)) {

    return response.organizations;

  }



  if (Array.isArray(response?.regions)) {

    return response.regions;

  }



  if (Array.isArray(response?.data)) {

    return response.data;

  }



  return [];

};



const getRegionId = (region: Region): string =>

  String(

    region?.region_id ??

      region?.id ??

      region?.regionId ??

      ""

  );



const getRegionName = (region: Region): string =>

  String(

    region?.name ??

      region?.region_name ??

      region?.regionName ??

      ""

  );



const getOrganizationId = (region: Region): string =>

  String(

    region?.organization_id ??

      region?.organizationId ??

      region?.org_id ??

      ""

  );



const getCountry = (region: Region): string =>

  String(

    region?.country ??

      region?.region_country ??

      ""

  ).trim();



const getState = (region: Region): string =>

  String(

    region?.state ??

      region?.region_state ??

      ""

  ).trim();



const fileToBase64 = (file: File): Promise<string> =>

  new Promise((resolve, reject) => {

const reader = new FileReader();



    reader.onload = () => {

const result = reader.result;



      if (typeof result !== "string") {

        reject(new Error("Unable to read KML file."));

        return;

      }



const base64 = result.includes(",")

        ? result.split(",")[1]

        : result;



      if (!base64) {

        reject(new Error("Invalid KML file."));

        return;

      }



      resolve(base64);

    };



    reader.onerror = () =>

      reject(new Error("Unable to read KML file."));



    reader.readAsDataURL(file);

  });



export default function CreateField({

onGoToCropDetails,

onNavigate,

}: CreateFieldProps) {

const [organizations, setOrganizations] =

    useState<Organization[]>([]);



const [selectedOrganizationId, setSelectedOrganizationId] =

    useState("");



const [regions, setRegions] = useState<Region[]>([]);

const [selectedCountry, setSelectedCountry] = useState("");

const [selectedState, setSelectedState] = useState("");

const [selectedRegionId, setSelectedRegionId] = useState("");



const [loadingOrganizations, setLoadingOrganizations] =

    useState(true);



const [loadingRegions, setLoadingRegions] = useState(false);

const [submitting, setSubmitting] = useState(false);



const [kmlFile, setKmlFile] = useState<File | null>(null);

const [error, setError] = useState("");

const [success, setSuccess] = useState("");



const [completionOpen, setCompletionOpen] = useState(false);



const [lambdaStatus, setLambdaStatus] =

    useState<"success" | "error">("success");



const [lambdaDetail, setLambdaDetail] = useState("");

const [createdFieldCount, setCreatedFieldCount] = useState(0);



  // ------------------------------------------------------------

  // LOAD ORGANIZATIONS

  // ------------------------------------------------------------



  useEffect(() => {

let cancelled = false;



const loadOrganizations = async () => {

      setLoadingOrganizations(true);

      setError("");



      try {

const response = await getOrganizations();

const list = getList(response) as Organization[];



const activeOrganizations = list.filter(

          (organization) =>

            organization.is_active !== false

        );



        if (!cancelled) {

          setOrganizations(activeOrganizations);

        }

      } catch (err) {

        if (!cancelled) {

          setError(

            err instanceof Error

              ? err.message

              : "Failed to load organizations."

          );

        }

      } finally {

        if (!cancelled) {

          setLoadingOrganizations(false);

        }

      }

    };



    void loadOrganizations();



    return () => {

      cancelled = true;

    };

  }, []);



  // ------------------------------------------------------------

  // LOAD REGIONS FOR THE SELECTED ORGANIZATION

  // ------------------------------------------------------------



  useEffect(() => {

let cancelled = false;



const loadRegions = async () => {

      setRegions([]);

      setSelectedCountry("");

      setSelectedState("");

      setSelectedRegionId("");

      setKmlFile(null);

      setSuccess("");



      if (!selectedOrganizationId) {

        setLoadingRegions(false);

        return;

      }



      setLoadingRegions(true);

      setError("");



      try {

const response = await getFieldRegions({

          organization_id: Number(selectedOrganizationId),

        });



const list = getList(response).filter(

          (region) =>

            getOrganizationId(region) ===

            selectedOrganizationId

        );



        if (!cancelled) {

          setRegions(list);

        }

      } catch (err) {

        if (!cancelled) {

          setError(

            err instanceof Error

              ? err.message

              : "Failed to load saved regions."

          );

        }

      } finally {

        if (!cancelled) {

          setLoadingRegions(false);

        }

      }

    };



    void loadRegions();



    return () => {

      cancelled = true;

    };

  }, [selectedOrganizationId]);



  // ------------------------------------------------------------

  // COUNTRY OPTIONS

  // ------------------------------------------------------------

const countries = useMemo(
  () =>
    Country.getAllCountries()
      .map((country) => ({
        label: country.name,
        value: country.name,
        isoCode: country.isoCode,
      }))
      .sort((a, b) => a.label.localeCompare(b.label)),
  []
);

const selectedCountryData = useMemo(
  () =>
    countries.find(
      (country) => country.value === selectedCountry
    ),
  [countries, selectedCountry]
);

const states = useMemo(
  () =>
    selectedCountryData
      ? State.getStatesOfCountry(
          selectedCountryData.isoCode
        )
          .map((state) => ({
            label: state.name,
            value: state.name,
            isoCode: state.isoCode,
          }))
          .sort((a, b) => a.label.localeCompare(b.label))
      : [],
  [selectedCountryData]
);



  // ------------------------------------------------------------

  // REGION OPTIONS FOR THE SELECTED COUNTRY AND STATE

  // ------------------------------------------------------------



const filteredRegions = useMemo(

    () =>

      regions.filter(

        (region) =>

          getCountry(region) === selectedCountry &&

          getState(region) === selectedState

      ),

    [regions, selectedCountry, selectedState]

  );



const selectedRegion =

    filteredRegions.find(

      (region) =>

        getRegionId(region) === selectedRegionId

    ) ?? null;



const organizationId = selectedOrganizationId;

const country = selectedCountry;

const state = selectedState;



const regionName = selectedRegion

    ? getRegionName(selectedRegion)

    : "";



  // ------------------------------------------------------------

  // SELECT KML FILE

  // ------------------------------------------------------------



const handleFile = (

event: ChangeEvent<HTMLInputElement>

  ) => {

    setError("");

    setSuccess("");



const file = event.target.files?.[0];



    if (!file) return;



    if (!file.name.toLowerCase().endsWith(".kml")) {

      setKmlFile(null);

      setError("Please upload a valid .kml file.");

      event.target.value = "";

      return;

    }



    setKmlFile(file);

    setSuccess("KML file selected successfully.");

  };



  // ------------------------------------------------------------

  // CREATE FIELD

  // ------------------------------------------------------------



const handleSubmit = async () => {

    setError("");

    setSuccess("");



    if (

      !organizationId ||

      !country ||

      !state ||

      !selectedRegionId

    ) {

      setError(

        "Please select an organization, country, state, and region."

      );

      return;

    }



    if (!selectedRegion || !regionName) {

      setError(

        "The selected region could not be found. Please select it again."

      );

      return;

    }



    if (!kmlFile) {

      setError("Please upload a KML file.");

      return;

    }



    try {

      setSubmitting(true);



const base64 = await fileToBase64(kmlFile);



const result = await uploadRegionKml({

        region_id: selectedRegionId,

        kml_file_name: kmlFile.name,

        kml_file_content: base64,

      });



      if (result?.success === false) {

        throw new Error(

          result?.error ||

            result?.message ||

            "KML upload failed."

        );

      }



const fields = result?.fields?.items ?? [];



const count =

        result?.fields?.count ?? fields.length;



      // Preserve geometry for the crop-details workflow.

const geoJson = {

        type: "FeatureCollection",

        features: fields.map(

          (field: any, index: number) => ({

            type: "Feature",

            geometry: field.geometry,

            properties: {

              geometry_reference_id:

                field.geometry_reference_id,

              temp_field_id: field.temp_field_id,

              field_index:

                field.field_index ?? index + 1,

              field_name:

                field.field_name ?? `Field ${index + 1}`,

              region_id: selectedRegionId,

              organization_id: organizationId,

              country,

              state,

            },

          })

        ),

      };



      localStorage.setItem(

        `regionGeometry:${selectedRegionId}`,

        JSON.stringify(geoJson)

      );



      localStorage.setItem(

        "pendingCropRegion",

        JSON.stringify({

          regionId: selectedRegionId,

          regionName,

          organizationId,

          country,

          state,

        })

      );



      setCreatedFieldCount(count);

      setLambdaStatus("success");



      setLambdaDetail(

        result?.message ||

          "KML processed successfully."

      );



      setSuccess(

        `${count} field polygon(s) created successfully.`

      );



      setKmlFile(null);

      setCompletionOpen(true);

    } catch (err) {

const message =

        err instanceof Error

          ? err.message

          : "KML upload failed.";



      setError(message);

      setLambdaStatus("error");

      setLambdaDetail(message);

      setCompletionOpen(true);

    } finally {

      setSubmitting(false);

    }

  };



  // ------------------------------------------------------------

  // NAVIGATE TO UPLOAD CROP DETAILS

  // ------------------------------------------------------------



const handleUploadCropDetails = () => {

    setCompletionOpen(false);



    if (onGoToCropDetails) {

      onGoToCropDetails(

        selectedRegionId,

        regionName

      );

      return;

    }



    if (onNavigate) {

      onNavigate("region-upload-crop-details");

      return;

    }



    setSuccess(

      "Open Upload Crop Details from the sidebar."

    );

  };



const busy =

    loadingOrganizations ||

    loadingRegions ||

    submitting;



  // ------------------------------------------------------------

  // UI

  // ------------------------------------------------------------



  return (

    <>

      <Box maxWidth={650} mx="auto">

        <Paper

          elevation={3}

          sx={{ p: 4, borderRadius: 3 }}

        >

          <Typography

            variant="h5"

            fontWeight="bold"

            mb={1}

          >

            🗺️ Create Field

          </Typography>



          <Typography

            variant="body2"

            color="text.secondary"

            mb={3}

          >

            Select an organization, country, state,

            and saved region. Upload a KML file for

            the selected region.

          </Typography>



          {error && (

            <Alert severity="error" sx={{ mb: 2 }}>

              {error}

            </Alert>

          )}



          {success && (

            <Alert severity="success" sx={{ mb: 2 }}>

              {success}

            </Alert>

          )}



          {/* ORGANIZATION */}



          <FormControl

            fullWidth

            required

            sx={{ mb: 2 }}

            disabled={

              loadingOrganizations || submitting

            }

          >

            <InputLabel id="organization-label">

              Organisation ID

            </InputLabel>



            <Select

              labelId="organization-label"

              value={selectedOrganizationId}

              label="Organisation ID"

              onChange={(event) => {

                setSelectedOrganizationId(

                  String(event.target.value)

                );

                setError("");

                setSuccess("");

              }}

            >

              {organizations.map((organization) => (

                <MenuItem

                  key={organization.id}

                  value={String(organization.id)}

                >

                  {organization.id} — {organization.name}

                </MenuItem>

              ))}

            </Select>

          </FormControl>



          {/* COUNTRY */}



          <FormControl

            fullWidth

            required

            sx={{ mb: 2 }}

            disabled={

              !selectedOrganizationId ||

              loadingRegions ||

              submitting

            }

          >

            <InputLabel id="country-label">

              Country

            </InputLabel>



            <Select

              labelId="country-label"

              value={selectedCountry}

              label="Country"

              onChange={(event) => {

                setSelectedCountry(

                  String(event.target.value)

                );

                setSelectedState("");

                setSelectedRegionId("");

                setKmlFile(null);

                setError("");

                setSuccess("");

              }}

            >

              
{countries.map((country) => (
  <MenuItem
    key={country.isoCode}
    value={country.value}
  >
    {country.label}
  </MenuItem>
))}


            </Select>

          </FormControl>



          {/* STATE */}



          <FormControl

            fullWidth

            required

            sx={{ mb: 2 }}

            disabled={

              !selectedCountry ||

              loadingRegions ||

              submitting

            }

          >

            <InputLabel id="state-label">

              State

            </InputLabel>



            <Select

              labelId="state-label"

              value={selectedState}

              label="State"

              onChange={(event) => {

                setSelectedState(

                  String(event.target.value)

                );

                setSelectedRegionId("");

                setKmlFile(null);

                setError("");

                setSuccess("");

              }}

            >

              
{states.map((state) => (
  <MenuItem
    key={state.isoCode}
    value={state.value}
  >
    {state.label}
  </MenuItem>
))}


            </Select>

          </FormControl>



          {/* REGION */}



          <FormControl

            fullWidth

            required

            sx={{ mb: 3 }}

            disabled={

              !selectedState ||

              loadingRegions ||

              submitting

            }

          >

            <InputLabel id="region-label">

              Region

            </InputLabel>



            <Select

              labelId="region-label"

              value={selectedRegionId}

              label="Region"

              onChange={(event) => {

                setSelectedRegionId(

                  String(event.target.value)

                );

                setKmlFile(null);

                setError("");

                setSuccess("");

              }}

            >

              {filteredRegions.length > 0 ? (
                filteredRegions.map((region) => {
                  const id = getRegionId(region);
                  return (
                    <MenuItem key={id} value={id}>
                      {getRegionName(region)}
                    </MenuItem>
                  );
                })
              ) : (
                <MenuItem disabled value="">
                  No regions available for this country and state
                </MenuItem>
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

              <CircularProgress size={18} />

              <Typography variant="body2">

                Loading organizations...

              </Typography>

            </Box>

          )}



          {loadingRegions &&

            selectedOrganizationId && (

              <Box

                display="flex"

                alignItems="center"

                gap={1}

                mb={2}

              >

                <CircularProgress size={18} />

                <Typography variant="body2">

                  Loading saved regions...

                </Typography>

              </Box>

            )}



          {!loadingRegions &&

            selectedOrganizationId &&

            regions.length === 0 &&

            !error && (

              <Alert severity="info" sx={{ mb: 2 }}>

                No saved regions were returned for

                this organization.

              </Alert>

            )}



          {!loadingRegions &&

            selectedCountry &&

            selectedState &&

            filteredRegions.length === 0 &&

            regions.length > 0 && (

              <Alert severity="info" sx={{ mb: 2 }}>

                No regions are available for this

                country and state.

              </Alert>

            )}



          {/* KML FILE */}



          <Button

            component="label"

            variant="outlined"

            fullWidth

            disabled={busy || !selectedRegionId}

            sx={{ minHeight: 45, mb: 1 }}

          >

            UPLOAD KML



            <input

              hidden

              type="file"

              accept=".kml,application/vnd.google-earth.kml+xml"

              onChange={handleFile}

            />

          </Button>



          {kmlFile ? (

            <Typography

              variant="body2"

              color="text.secondary"

              sx={{ mt: 1, mb: 3 }}

            >

              Selected file: {kmlFile.name}

            </Typography>

          ) : (

            <Box mb={3} />

          )}



          {/* SUBMIT */}



          <Button

            fullWidth

            variant="contained"

            onClick={handleSubmit}

            disabled={

              busy ||

              !selectedRegionId ||

              !kmlFile

            }

            sx={{

              minHeight: 45,

              backgroundColor: "#075d16",

              "&:hover": {

                backgroundColor: "#064d12",

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

                PROCESSING KML...

              </>

            ) : (

              "CREATE FIELD"

            )}

          </Button>

        </Paper>

      </Box>



      {/* LAMBDA RESULT DIALOG */}



      <Dialog

        open={completionOpen}

        onClose={() => setCompletionOpen(false)}

        fullWidth

        maxWidth="sm"

      >

        <DialogTitle>

          {lambdaStatus === "success"

            ? "Field Process Completed"

            : "Field Process Failed"}

        </DialogTitle>



        <DialogContent>

          <Alert

            severity={

              lambdaStatus === "success"

                ? "success"

                : "error"

            }

            sx={{ mt: 1 }}

          >

            <Typography

              fontWeight="bold"

              mb={1}

            >

              UploadRegion Lambda: {lambdaStatus}

            </Typography>



            <Typography

              variant="body2"

              mb={1}

            >

              {lambdaDetail}

            </Typography>



            {lambdaStatus === "success" && (

              <>

                <Typography variant="body2">

                  Organization ID: {organizationId}

                </Typography>



                <Typography variant="body2">

                  Region: {regionName}

                </Typography>



                <Typography variant="body2">

                  Region ID: {selectedRegionId}

                </Typography>



                <Typography variant="body2">

                  Field polygons: {createdFieldCount}

                </Typography>

              </>

            )}

          </Alert>

        </DialogContent>



        <DialogActions>

          <Button

            onClick={() => setCompletionOpen(false)}

          >

            CLOSE

          </Button>



          {lambdaStatus === "success" && (

            <Button

              variant="contained"

              onClick={handleUploadCropDetails}

              sx={{

                backgroundColor: "#075d16",

                "&:hover": {

                  backgroundColor: "#064d12",

                },

              }}

            >

              UPLOAD CROP DETAILS

            </Button>

          )}

        </DialogActions>

      </Dialog>

    </>

  );

}
