import {
  Box,
  IconButton,
  Tooltip,
  Typography
} from "@mui/material";

import DashboardIcon from "@mui/icons-material/Dashboard";
import GrassIcon from "@mui/icons-material/Grass";
import SpaIcon from "@mui/icons-material/Spa";
import RecommendIcon from "@mui/icons-material/Recommend";
import AddIcon from "@mui/icons-material/Add";
import MenuIcon from "@mui/icons-material/Menu";

import { useState, useEffect } from "react";

export default function Sidebar({ setPage }: any) {

  const [collapsed, setCollapsed] = useState(false);
  const [active, setActive] = useState("dashboard");

  // ✅ SAFE USER PARSE (IMPORTANT FIX)
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const role = user?.role || "farmer";

  // -------------------------
  // MENU CONFIG
  // -------------------------
  const menuItems = [
    { label: "Dashboard", icon: <DashboardIcon />, key: "dashboard" },
    { label: "Soil Health", icon: <GrassIcon />, key: "soil" },
    { label: "Crop Health", icon: <SpaIcon />, key: "crop" },
    { label: "Recommendations", icon: <RecommendIcon />, key: "rec" },
    { label: "Add Recommendation", icon: <AddIcon />, key: "rec-input" }
  ];

  // -------------------------
  // ROLE FILTER
  // -------------------------
  const filteredMenu = menuItems.filter(item => {

    if (item.key === "rec-input" && !["scientist", "admin"].includes(role)) {
      return false;
    }

    return true;
  });

  // -------------------------
  // SYNC ACTIVE PAGE
  // -------------------------
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

      {/* ================= TOP ================= */}
      <Box p={1}>

        {/* TOGGLE */}
        <IconButton
          onClick={() => setCollapsed(!collapsed)}
          sx={{ color: "white", mb: 2 }}
        >
          <MenuIcon />
        </IconButton>

        {/* LOGO */}
        {!collapsed && (
          <Box textAlign="center" mb={2}>
            <img
              src="/logo.png"
              alt="logo"
              style={{
                width: "140px",
                borderRadius: "8px"
              }}
            />
          </Box>
        )}

        {/* USER */}
        {!collapsed && (
          <Typography
            variant="body2"
            textAlign="center"
            mb={2}
            sx={{ opacity: 0.85 }}
          >
            👤 {user?.username || "User"}
          </Typography>
        )}

        {/* MENU */}
        <Box display="flex" flexDirection="column" gap={1}>

          {filteredMenu.map((item) => (
            <Tooltip
              title={collapsed ? item.label : ""}
              placement="right"
              key={item.key}
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
                  transition: "0.2s",
                  backgroundColor:
                    active === item.key ? "#40916C" : "transparent",
                  "&:hover": {
                    backgroundColor: "#2D6A4F"
                  }
                }}
              >

                {/* ICON */}
                <Box display="flex" justifyContent="center" width={30}>
                  {item.icon}
                </Box>

                {/* LABEL */}
                {!collapsed && (
                  <Typography sx={{ ml: 2, fontSize: "14px" }}>
                    {item.label}
                  </Typography>
                )}

              </Box>
            </Tooltip>
          ))}

        </Box>

      </Box>

      {/* ================= FOOTER ================= */}
      {!collapsed && (
        <Typography
          variant="caption"
          textAlign="center"
          sx={{ mb: 2, opacity: 0.7 }}
        >
          © 2026 Tensor AgriTech Pvt. Ltd.
        </Typography>
      )}

    </Box>
  );
}