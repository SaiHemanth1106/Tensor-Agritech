import { Box, Typography, Button } from "@mui/material";
import Sidebar from "./Sidebar";

export default function Layout({ children, setPage, logout }: any) {

  // ✅ DEFINE USER INSIDE COMPONENT
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  return (
    <Box display="flex">

      {/* SIDEBAR */}
      <Sidebar setPage={setPage} />

      {/* MAIN CONTENT */}
      <Box flex={1} bgcolor="#F5F7FA">

        {/* HEADER */}
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          bgcolor="white"
          p={2}
          boxShadow={1}
        >
          <Typography variant="h6" fontWeight="bold">
            🌱 Welcome {user?.org_name || "Organization"} User
          </Typography>

          <Button variant="outlined" onClick={logout}>
            Logout
          </Button>
        </Box>

        {/* CONTENT */}
        <Box p={3}>
          {children}
        </Box>

      </Box>
    </Box>
  );
}