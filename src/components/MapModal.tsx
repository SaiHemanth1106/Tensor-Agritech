import { Dialog, DialogContent } from "@mui/material";
import LeafletMap from "./LeafletMap";

export default function MapModal({ kmlUrl, onClose }: any) {
  return (
    <Dialog open fullWidth maxWidth="lg" onClose={onClose}>
      <DialogContent>
        <LeafletMap kmlUrl={kmlUrl} />
      </DialogContent>
    </Dialog>
  );
}