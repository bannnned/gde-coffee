/* @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

describe("TasteOnboardingPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    vi.stubEnv("VITE_TASTE_MAP_V1_ENABLED", "1");

    getTasteOnboardingMock.mockResolvedValue({
      contract_version: "taste_map_v1",
      onboarding_version: "onboarding_v1",
      locale: "ru-RU",
      estimated_duration_sec: 55,
      steps: [
        {
          id: "drink_format",
          type: "single_choice",
          required: true,
          title: "Что вы чаще пьете?",
          options: [
            { id: "espresso", label: "Эспрессо" },
            { id: "filter", label: "Фильтр" },
          ],
        },
        {
          id: "flavor_likes",
          type: "multi_choice",
          required: true,
          min_choices: 1,
          max_choices: 3,
          title: "Какие вкусы нравятся?",
          options: [
            { id: "citrus", label: "Цитрус" },
            { id: "nutty_cocoa", label: "Шоколад" },
          ],
        },
      ],
    });
  });

  it("validates required step and moves to next after answer", async () => {
    render(
      <MemoryRouter initialEntries={["/taste/onboarding"]}>
        <Routes>
          <Route path="/taste/onboarding" element={<TasteOnboardingPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByText("Что вы чаще пьете?");

    fireEvent.click(screen.getByRole("button", { name: "Дальше" }));
    expect(screen.getByText("Выберите один вариант.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Эспрессо" }));
    fireEvent.click(screen.getByRole("button", { name: "Дальше" }));

    await screen.findByText("Какие вкусы нравятся?");

    await waitFor(() => {
      const cached = window.localStorage.getItem("gdeCoffeeTasteOnboardingProgress:u1");
      expect(cached).toBeTruthy();
    });
  });
});
