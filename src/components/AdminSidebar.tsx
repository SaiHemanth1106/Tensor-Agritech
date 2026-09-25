import {
  Box,
  IconButton,
  Tooltip,
  Typography,
  Divider
} from "@mui/material";

import MenuIcon from "@mui/icons-material/Menu";
import BusinessIcon from "@mui/icons-material/Business";
import PersonIcon from "@mui/icons-material/Person";
import AddLocationAltIcon from "@mui/icons-material/AddLocationAlt";
import ListAltIcon from "@mui/icons-material/ListAlt";
import ToggleOffIcon from "@mui/icons-material/ToggleOff";
import DashboardIcon from "@mui/icons-material/Dashboard"; // ✅ ADD

import { useState, useEffect } from "react";

export default function AdminSidebar({ setPage }: any) {

  const [collapsed, setCollapsed] = useState(false);

  // ✅ FIX: default to dashboard
  const [active, setActive] = useState("admin-dashboard");

  const user = JSON.parse(localStorage.getItem("user") || "{}");

  const adminMenu = [
    {
      section: "Overview",
      items: [
        { label: "Dashboard", icon: <DashboardIcon />, key: "admin-dashboard" } // ✅ ADD
      ]
    },
    {
      section: "Organization",
      items: [
        { label: "Create Organization", icon: <BusinessIcon />, key: "org-create" },
        { label: "Deactivate Organization", icon: <ToggleOffIcon />, key: "org-deactivate" }
      ]
    },
    {
      section: "User Management",
      items: [
        { label: "Create User", icon: <PersonIcon />, key: "user-create" },
        { label: "Deactivate User", icon: <ToggleOffIcon />, key: "user-deactivate" }
      ]
    },
    {
      section: "Region Management",
      items: [
        { label: "Create Region", icon: <AddLocationAltIcon />, key: "region-create" },
        { label: "View Regions", icon: <ListAltIcon />, key: "region-management" },
        { label: "Upload Crop Details", icon: <ListAltIcon />, key: "region-upload-crop-details" },
        { label: "Disable Monitoring", icon: <ToggleOffIcon />, key: "region-disable-monitoring" }
      ]
    }
  ];

  // ✅ FIX: Only update page when active changes
  useEffect(() => {
    setPage(active);
  }, [active]);

  return (
    <Box
      width={collapsed ? 70 : 240}
      bgcolor="#1B4332"
      color="white"
      minHeight="100vh"
      display="flex"
      flexDirection="column"
      justifyContent="space-between"
      sx={{
        transition: "all 0.3s ease",
        boxShadow: "2px 0px 8px rgba(0,0,0,0.2)"
      }}
    >

      {/* TOP */}
      <Box p={1}>

        <IconButton
          onClick={() => setCollapsed(!collapsed)}
          sx={{ color: "white", mb: 2 }}
        >
          <MenuIcon />
        </IconButton>

        {!collapsed && (
          <Box textAlign="center" mb={2}>
            <img src="/logo.png" style={{ width: "140px" }} />
          </Box>
        )}

        {!collapsed && (
          <Typography textAlign="center" mb={2} sx={{ opacity: 0.85 }}>
            👤 {user?.username || "Admin"}
          </Typography>
        )}

        {/* MENU */}
        {adminMenu.map((section) => (
          <Box key={section.section} mb={1}>

            {!collapsed && (
              <Typography
                variant="caption"
                sx={{ ml: 1, mb: 1, display: "block", opacity: 0.7 }}
              >
                {section.section}
              </Typography>
            )}

            {section.items.map((item) => (
              <Tooltip
                key={item.key}
                title={collapsed ? item.label : ""}
                placement="right"
              >
                <Box
                  onClick={() => setActive(item.key)}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    cursor: "pointer",
                    px: collapsed ? 1 : 2,
                    py: 1.2,
                    borderRadius: 2,
                    backgroundColor:
                      active === item.key ? "#40916C" : "transparent",
                    "&:hover": { backgroundColor: "#2D6A4F" }
                  }}
                >
                  <Box width={30}>{item.icon}</Box>

                  {!collapsed && (
                    <Typography sx={{ ml: 2, fontSize: "14px" }}>
                      {item.label}
                    </Typography>
                  )}
                </Box>
              </Tooltip>
            ))}

            <Divider sx={{ my: 1, bgcolor: "rgba(255,255,255,0.2)" }} />

          </Box>
        ))}

      </Box>

      {/* FOOTER */}
      {!collapsed && (
        <Typography textAlign="center" sx={{ mb: 2, opacity: 0.7 }}>
          © 2026 Tensor AgriTech Pvt. Ltd.
        </Typography>
      )}

    </Box>
  );
}
