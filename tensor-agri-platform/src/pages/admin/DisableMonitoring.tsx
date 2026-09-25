import { useEffect, useState } from "react";
import { Box, Select, MenuItem, Button, Typography } from "@mui/material";
import { getRegions, disableMonitoring } from "../../services/api";

export default function DisableMonitoring() {

  const [regions, setRegions] = useState<any[]>([]);
  const [selected, setSelected] = useState("");

  useEffect(() => {
    getRegions().then(setRegions);
  }, []);

  const handleDisable = async () => {
    await disableMonitoring(Number(selected));
    alert("Monitoring disabled");
  };

  return (
    <Box>
      <Typography variant="h5">Disable Monitoring</Typography>

      <Select fullWidth value={selected} onChange={(e) => setSelected(e.target.value)}>
        {regions.map(r => (
          <MenuItem key={r.id} value={r.id}>{r.name}</MenuItem>
        ))}
      </Select>

      <Button sx={{ mt: 2 }} variant="contained" onClick={handleDisable}>
        Disable
      </Button>
    </Box>
  );
}