/* @vitest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import TasteOnboardingPage from "./TasteOnboardingPage";

const getTasteOnboardingMock = vi.fn();
const completeTasteOnboardingMock = vi.fn();

const authState = {
  user: { id: "u1", displayName: "Tester" },
  status: "authed",
  openAuthModal: vi.fn(),
};

vi.mock("../components/AuthGate", () => ({
  useAuth: () => authState,
}));

vi.mock("../api/taste", () => ({
  getTasteOnboarding: (...args: unknown[]) => getTasteOnboardingMock(...args),
  completeTasteOnboarding: (...args: unknown[]) => completeTasteOnboardingMock(...args),
}));

describe("TasteOnboardingPage smoke", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    vi.stubEnv("VITE_TASTE_MAP_V1_ENABLED", "1");

    getTasteOnboardingMock.mockResolvedValue({
      contract_version: "taste_map_v1",
      onboarding_version: "onboarding_v2",
      locale: "ru-RU",
      estimated_duration_sec: 45,
      steps: [
        {
          id: "drink_habit",
          type: "single_choice",
          required: true,
          title: "Что вы обычно выбираете?",
          options: [
            { id: "espresso", label: "Эспрессо" },
            { id: "filter", label: "Фильтр / воронка" },
          ],
        },
      ],
    });

    completeTasteOnboardingMock.mockResolvedValue({
      contract_version: "taste_map_v1",
      inference_version: "taste_inference_v1",
      session_id: "session-1",
      profile: {
        tags: [],
        updated_at: new Date().toISOString(),
      },
    });
  });

  it("completes onboarding happy path", async () => {
    render(
      <MemoryRouter initialEntries={["/taste/onboarding"]}>
        <Routes>
          <Route path="/taste/onboarding" element={<TasteOnboardingPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByText("Что вы обычно выбираете?");
    fireEvent.click(screen.getByRole("button", { name: "Эспрессо" }));
    fireEvent.click(screen.getByRole("button", { name: "Завершить" }));

    await screen.findByText("Карта вкуса сохранена");
    expect(completeTasteOnboardingMock).toHaveBeenCalledTimes(1);

    const payload = completeTasteOnboardingMock.mock.calls[0][0] as {
      onboarding_version: string;
      answers: Array<{ question_id: string; value: unknown }>;
    };

    expect(payload.onboarding_version).toBe("onboarding_v2");
    expect(payload.answers).toEqual([
      { question_id: "drink_habit", value: "espresso" },
    ]);
  });
});
