import { Box, Typography, Button } from "@mui/material";
import AdminSidebar from "./AdminSidebar";

export default function AdminLayout({ children, setPage, logout }: any) {

  // ✅ SAFE USER PARSE
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  return (
    <Box display="flex">

      {/* ================= SIDEBAR ================= */}
      <AdminSidebar setPage={setPage} />

      {/* ================= MAIN CONTENT ================= */}
      <Box flex={1} bgcolor="#F5F7FA" minHeight="100vh">

        {/* ================= HEADER ================= */}
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          bgcolor="white"
          p={2}
          boxShadow={1}
        >
          {/* LEFT */}
          <Typography variant="h6" fontWeight="bold">
            ⚙️ Admin Panel – {user?.org_name || "System"}
          </Typography>

          {/* RIGHT */}
          <Box display="flex" alignItems="center" gap={2}>

            <Typography variant="body2" sx={{ opacity: 0.7 }}>
              👤 {user?.username || "Admin"}
            </Typography>

            <Button
              variant="outlined"
              color="error"
              onClick={logout}
            >
              Logout
            </Button>

          </Box>
        </Box>

        {/* ================= CONTENT ================= */}
        <Box p={3}>
          {children}
        </Box>

      </Box>

    </Box>
  );
}