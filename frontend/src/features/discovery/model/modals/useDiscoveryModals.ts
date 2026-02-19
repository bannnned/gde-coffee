import { useState } from "react";

import type { Cafe } from "../../../../entities/cafe/model/types";

export default function useDiscoveryModals(selectedCafe: Cafe | null) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [detailsOpenRaw, setDetailsOpenRaw] = useState(false);
  const [photoAdminOpenRaw, setPhotoAdminOpenRaw] = useState(false);
  const [photoAdminKind, setPhotoAdminKind] = useState<"cafe" | "menu">("cafe");
  const [photoSubmitOpenRaw, setPhotoSubmitOpenRaw] = useState(false);
  const [photoSubmitKind, setPhotoSubmitKind] = useState<"cafe" | "menu">("cafe");
  const [cafeProposalOpen, setCafeProposalOpen] = useState(false);
  const hasSelectedCafe = Boolean(selectedCafe);
  const detailsOpen = hasSelectedCafe && detailsOpenRaw;
  const photoAdminOpen = hasSelectedCafe && photoAdminOpenRaw;
  const photoSubmitOpen = hasSelectedCafe && photoSubmitOpenRaw;

  const closePanelsForManualPick = () => {
    setDetailsOpenRaw(false);
    setSettingsOpen(false);
  };

  const setDetailsOpen = (next: boolean) => {
    setDetailsOpenRaw(next);
  };

  const setPhotoAdminOpen = (next: boolean) => {
    setPhotoAdminOpenRaw(next);
  };

  const setPhotoSubmitOpen = (next: boolean) => {
    setPhotoSubmitOpenRaw(next);
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
