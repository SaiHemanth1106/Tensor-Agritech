import { Box, Typography, Paper, CircularProgress } from "@mui/material";
import Grid from "@mui/material/Grid";
import { useEffect, useState } from "react";

import { getAdminDashboard } from "../../services/api";

export default function AdminDashboard() {

  const [loading, setLoading] = useState(true);

  const [stats, setStats] = useState({
    orgs: 0,
    activeOrgs: 0,
    users: 0,
    activeUsers: 0,
    regions: 0,
    activeRegions: 0
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        const data = await getAdminDashboard();

        setStats(data);

      } catch (e) {
        console.error("Dashboard load error:", e);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const Card = ({ title, total, active }: any) => (
    <Paper sx={{ p: 3, borderRadius: 3, textAlign: "center", boxShadow: 3 }}>
      <Typography variant="subtitle1" sx={{ color: "#555" }}>
        {title}
      </Typography>

      <Typography variant="h4" fontWeight="bold">
        {total}
      </Typography>

      <Typography sx={{ color: "#2D6A4F" }}>
        Active: {active}
      </Typography>

      <Typography sx={{ color: "#d00000" }}>
        Inactive: {total - active}
      </Typography>
    </Paper>
  );

  return (
    <Box>

      <Typography variant="h5" fontWeight="bold" mb={3}>
        📊 Admin Dashboard
      </Typography>

      {loading ? (
        <Box textAlign="center" mt={5}>
          <CircularProgress />
        </Box>
      ) : (
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Card title="Organizations" total={stats.orgs} active={stats.activeOrgs} />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Card title="Users" total={stats.users} active={stats.activeUsers} />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Card title="Regions" total={stats.regions} active={stats.activeRegions} />
          </Grid>
        </Grid>
      )}
    </Box>
  );
}