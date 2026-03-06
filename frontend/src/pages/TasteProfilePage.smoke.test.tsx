/* @vitest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import TasteProfilePage from "./TasteProfilePage";

const getMyTasteMapMock = vi.fn();
const hapticsTriggerMock = vi.fn();

const authState = {
  user: { id: "u1", displayName: "Tester" },
  status: "authed",
  openAuthModal: vi.fn(),
};

vi.mock("../components/AuthGate", () => ({
  useAuth: () => authState,
}));

vi.mock("../api/taste", () => ({
  getMyTasteMap: (...args: unknown[]) => getMyTasteMapMock(...args),
  acceptTasteHypothesis: vi.fn(),
  dismissTasteHypothesis: vi.fn(),
}));

vi.mock("../lib/haptics", () => ({
  appHaptics: {
    trigger: (...args: unknown[]) => hapticsTriggerMock(...args),
  },
}));

describe("TasteProfilePage smoke", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("VITE_TASTE_MAP_V1_ENABLED", "1");
    hapticsTriggerMock.mockResolvedValue(true);
    getMyTasteMapMock.mockResolvedValue({
      contract_version: "taste_map_v1",
      inference_version: "taste_inference_v1",
      base_map: {
        onboarding_version: "onboarding_v1",
        completed_at: new Date("2026-03-01T10:00:00.000Z").toISOString(),
      },
      active_tags: [
        {
          taste_code: "filter",
          polarity: "positive",
          score: 0.62,
          confidence: 0.8,
          source: "behavior",
        },
      ],
      hypotheses: [],
      updated_at: new Date("2026-03-02T11:00:00.000Z").toISOString(),
    });
  });

  it("opens onboarding restart from profile taste page", async () => {
    render(
      <MemoryRouter initialEntries={["/taste/profile"]}>
        <Routes>
          <Route path="/taste/profile" element={<TasteProfilePage />} />
          <Route path="/taste/onboarding" element={<div>Taste onboarding page</div>} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByText("Ваш вкус сейчас");
    fireEvent.click(screen.getByRole("button", { name: "Пройти карту заново" }));
    await screen.findByText("Taste onboarding page");

    expect(hapticsTriggerMock).toHaveBeenCalledWith("medium");
  });
});
