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
            { id: "milk_drinks", label: "Капучино / латте" },
            { id: "filter", label: "Фильтр / воронка" },
          ],
        },
        {
          id: "profile_refine",
          type: "single_choice",
          required: true,
          title: "Какой кофе приятнее?",
          options: [
            { id: "mellow_comfort", label: "Помягче и без резкой кислинки" },
            { id: "bright_exploratory", label: "Поярче и интереснее" },
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

    await screen.findByText("Что вы обычно выбираете?");

    fireEvent.click(screen.getByRole("button", { name: "Дальше" }));
    expect(screen.getByText("Выберите один вариант.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Фильтр / воронка" }));
    fireEvent.click(screen.getByRole("button", { name: "Дальше" }));

    await screen.findByText("Что важнее в чашке?");

    await waitFor(() => {
      const cached = window.localStorage.getItem("gdeCoffeeTasteOnboardingProgress:u1");
      expect(cached).toBeTruthy();
    });
  });

  it("keeps friendlier wording for everyday drinkers on the final step", async () => {
    render(
      <MemoryRouter initialEntries={["/taste/onboarding"]}>
        <Routes>
          <Route path="/taste/onboarding" element={<TasteOnboardingPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByText("Что вы обычно выбираете?");
    fireEvent.click(screen.getByRole("button", { name: "Капучино / латте" }));
    fireEvent.click(screen.getByRole("button", { name: "Дальше" }));

    await screen.findByText("Какой кофе приятнее?");
    expect(screen.getByRole("button", { name: "Помягче и без резкой кислинки" })).toBeTruthy();
  });
});
