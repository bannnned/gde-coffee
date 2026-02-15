import { useEffect, useState } from "react";

import type { Cafe } from "../../../../entities/cafe/model/types";

export default function useDiscoveryModals(selectedCafe: Cafe | null) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [photoAdminOpen, setPhotoAdminOpen] = useState(false);
  const [photoAdminKind, setPhotoAdminKind] = useState<"cafe" | "menu">("cafe");
  const [photoSubmitOpen, setPhotoSubmitOpen] = useState(false);
  const [photoSubmitKind, setPhotoSubmitKind] = useState<"cafe" | "menu">("cafe");
  const [cafeProposalOpen, setCafeProposalOpen] = useState(false);

  useEffect(() => {
    if (selectedCafe) return;
    setDetailsOpen(false);
    setPhotoAdminOpen(false);
    setPhotoSubmitOpen(false);
  }, [selectedCafe]);

  const closePanelsForManualPick = () => {
    setDetailsOpen(false);
    setSettingsOpen(false);
  };

  return {
    settingsOpen,
    detailsOpen,
    photoAdminOpen,
    photoAdminKind,
    photoSubmitOpen,
    photoSubmitKind,
    cafeProposalOpen,
    setSettingsOpen,
    setDetailsOpen,
    setPhotoAdminOpen,
    setPhotoAdminKind,
    setPhotoSubmitOpen,
    setPhotoSubmitKind,
    setCafeProposalOpen,
    closePanelsForManualPick,
  };
}
