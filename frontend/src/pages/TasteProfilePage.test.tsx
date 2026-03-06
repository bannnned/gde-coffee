/* @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import TasteProfilePage from "./TasteProfilePage";

const getMyTasteMapMock = vi.fn();
const acceptTasteHypothesisMock = vi.fn();
const dismissTasteHypothesisMock = vi.fn();
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
  acceptTasteHypothesis: (...args: unknown[]) => acceptTasteHypothesisMock(...args),
  dismissTasteHypothesis: (...args: unknown[]) => dismissTasteHypothesisMock(...args),
}));

vi.mock("../lib/haptics", () => ({
  appHaptics: {
    trigger: (...args: unknown[]) => hapticsTriggerMock(...args),
  },
}));

describe("TasteProfilePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("VITE_TASTE_MAP_V1_ENABLED", "1");
    hapticsTriggerMock.mockResolvedValue(true);
  });

  it("renders active tags and accepts hypothesis", async () => {
    getMyTasteMapMock
      .mockResolvedValueOnce({
        contract_version: "taste_map_v1",
        inference_version: "taste_inference_v1",
        base_map: {
          onboarding_version: "onboarding_v1",
          completed_at: new Date("2026-03-01T10:00:00.000Z").toISOString(),
        },
        active_tags: [
          {
            taste_code: "citrus",
            polarity: "positive",
            score: 0.84,
            confidence: 0.77,
            source: "onboarding",
          },
        ],
        hypotheses: [
          {
            id: "h1",
            taste_code: "nutty_cocoa",
            polarity: "positive",
            score: 0.71,
            confidence: 0.64,
            status: "new",
            reason: "Часто ставите высокий рейтинг орехово-шоколадным напиткам.",
            updated_at: new Date("2026-03-02T11:00:00.000Z").toISOString(),
          },
        ],
        updated_at: new Date("2026-03-02T11:00:00.000Z").toISOString(),
      })
      .mockResolvedValueOnce({
        contract_version: "taste_map_v1",
        inference_version: "taste_inference_v1",
        base_map: {
          onboarding_version: "onboarding_v1",
          completed_at: new Date("2026-03-01T10:00:00.000Z").toISOString(),
        },
        active_tags: [
          {
            taste_code: "citrus",
            polarity: "positive",
            score: 0.84,
            confidence: 0.77,
            source: "onboarding",
          },
          {
            taste_code: "nutty_cocoa",
            polarity: "positive",
            score: 0.71,
            confidence: 0.64,
            source: "explicit_feedback",
          },
        ],
        hypotheses: [],
        updated_at: new Date("2026-03-02T11:05:00.000Z").toISOString(),
      });

    acceptTasteHypothesisMock.mockResolvedValue({
      id: "h1",
      status: "accepted",
      updated_at: new Date("2026-03-02T11:05:00.000Z").toISOString(),
    });

    render(
      <MemoryRouter initialEntries={["/taste/profile"]}>
        <Routes>
          <Route path="/taste/profile" element={<TasteProfilePage />} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByText("Ваш вкус сейчас");
    expect(screen.getByText("Цитрусовый")).toBeTruthy();
    expect(screen.getByText("Наши предположения")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Подтвердить" }));

    await waitFor(() => {
      expect(acceptTasteHypothesisMock).toHaveBeenCalledWith("h1", {
        feedback_source: "profile_screen",
      });
    });
    await waitFor(() => {
      expect(getMyTasteMapMock).toHaveBeenCalledTimes(2);
    });
  });

  it("shows error state and retries loading", async () => {
    getMyTasteMapMock
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce({
        contract_version: "taste_map_v1",
        inference_version: "taste_inference_v1",
        base_map: {},
        active_tags: [],
        hypotheses: [],
        updated_at: new Date("2026-03-02T11:00:00.000Z").toISOString(),
      });

    render(
      <MemoryRouter initialEntries={["/taste/profile"]}>
        <Routes>
          <Route path="/taste/profile" element={<TasteProfilePage />} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByText("Ошибка загрузки");
    fireEvent.click(screen.getByRole("button", { name: "Повторить" }));
    await screen.findByText("Ваш вкус сейчас");
  });
});
