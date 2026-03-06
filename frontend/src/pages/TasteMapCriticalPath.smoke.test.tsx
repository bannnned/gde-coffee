/* @vitest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Cafe } from "../entities/cafe/model/types";
import CafeCardFooter from "../features/discovery/components/cafe-card/CafeCardFooter";
import TasteOnboardingPage from "./TasteOnboardingPage";
import TasteProfilePage from "./TasteProfilePage";

const getTasteOnboardingMock = vi.fn();
const completeTasteOnboardingMock = vi.fn();
const getMyTasteMapMock = vi.fn();
const dismissTasteHypothesisMock = vi.fn();
const reportMetricEventMock = vi.fn();
const hapticsTriggerMock = vi.fn();
const getCafeRatingSnapshotMock = vi.fn();

const authState = {
  user: { id: "550e8400-e29b-41d4-a716-446655440000", displayName: "Tester" },
  status: "authed",
  openAuthModal: vi.fn(),
};

vi.mock("../components/AuthGate", () => ({
  useAuth: () => authState,
}));

vi.mock("../api/metrics", () => ({
  createJourneyID: () => "journey_test",
  reportMetricEvent: (...args: unknown[]) => reportMetricEventMock(...args),
}));

vi.mock("../api/taste", () => ({
  getTasteOnboarding: (...args: unknown[]) => getTasteOnboardingMock(...args),
  completeTasteOnboarding: (...args: unknown[]) => completeTasteOnboardingMock(...args),
  getMyTasteMap: (...args: unknown[]) => getMyTasteMapMock(...args),
  dismissTasteHypothesis: (...args: unknown[]) => dismissTasteHypothesisMock(...args),
  acceptTasteHypothesis: vi.fn(),
}));

vi.mock("../api/reviews", () => ({
  getCafeRatingSnapshot: (...args: unknown[]) => getCafeRatingSnapshotMock(...args),
}));

vi.mock("../lib/haptics", () => ({
  appHaptics: {
    trigger: (...args: unknown[]) => hapticsTriggerMock(...args),
  },
}));

function RegistrationStub() {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => void navigate("/taste/onboarding")}>
      Завершить регистрацию
    </button>
  );
}

function ProfileHubStub() {
  const navigate = useNavigate();
  return (
    <div>
      <p>Профиль</p>
      <button type="button" onClick={() => void navigate("/taste/profile")}>
        Профиль вкуса
      </button>
      <button type="button" onClick={() => void navigate("/")}>
        В поиск
      </button>
    </div>
  );
}

function DiscoveryStub() {
  const cafe: Cafe = {
    id: "caf-1",
    name: "Brew Point",
    address: "Невский проспект, 1",
    explainability: "Подходит вашему вкусу: чистая кислотность и фильтр-профиль.",
    latitude: 59.9386,
    longitude: 30.3141,
    amenities: [],
    distance_m: 140,
    is_favorite: false,
  };

  return (
    <div style={{ position: "relative", height: 220, width: 340 }}>
      <CafeCardFooter cafe={cafe} />
    </div>
  );
}

describe("Taste Map critical path smoke", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    vi.stubEnv("VITE_TASTE_MAP_V1_ENABLED", "1");
    hapticsTriggerMock.mockResolvedValue(true);
    getCafeRatingSnapshotMock.mockResolvedValue({
      api_contract_version: "v1",
      formula_versions: { rating: "rating_v1", quality: "quality_v1" },
      cafe_id: "caf-1",
      formula_version: "rating_v1",
      rating: 4.8,
      reviews_count: 12,
      verified_reviews_count: 8,
      verified_share: 0.66,
      fraud_risk: 0,
      best_review: null,
      descriptive_tags: [],
      specific_tags: [],
      ai_summary: null,
      components: { ratings_mean: 4.8 },
      computed_at: "2026-03-06T10:00:00Z",
    });

    getTasteOnboardingMock.mockResolvedValue({
      contract_version: "taste_map_v1",
      onboarding_version: "onboarding_v1",
      locale: "ru-RU",
      estimated_duration_sec: 50,
      steps: [
        {
          id: "brew_type",
          type: "single_choice",
          required: true,
          title: "Что вы чаще выбираете?",
          options: [
            { id: "espresso", label: "Эспрессо" },
            { id: "filter", label: "Фильтр" },
          ],
        },
      ],
    });

    completeTasteOnboardingMock.mockResolvedValue({
      contract_version: "taste_map_v1",
      inference_version: "taste_inference_v1",
      session_id: "sess-1",
      profile: {
        tags: [],
        updated_at: "2026-03-06T10:05:00Z",
      },
    });

    let hasPendingHypothesis = true;

    getMyTasteMapMock.mockImplementation(async () => ({
      contract_version: "taste_map_v1",
      inference_version: "taste_inference_v1",
      base_map: {
        onboarding_version: "onboarding_v1",
        completed_at: "2026-03-06T10:05:00Z",
      },
      active_tags: [
        {
          taste_code: "filter",
          polarity: "positive",
          score: 0.71,
          confidence: 0.8,
          source: "behavior",
        },
      ],
      hypotheses: hasPendingHypothesis
        ? [
            {
              id: "hyp-1",
              taste_code: "berry",
              polarity: "negative",
              score: -0.52,
              confidence: 0.68,
              reason: "Часто пропускаете ягодный профиль в последних отзывах.",
              status: "active",
              updated_at: "2026-03-06T10:10:00Z",
            },
          ]
        : [],
      updated_at: "2026-03-06T10:10:00Z",
    }));

    dismissTasteHypothesisMock.mockImplementation(async () => {
      hasPendingHypothesis = false;
      return {
        hypothesis: {
          id: "hyp-1",
          status: "dismissed",
        },
      };
    });
  });

  it("covers registration -> onboarding -> profile dismiss -> discovery explainability", async () => {
    render(
      <MemoryRouter initialEntries={["/register"]}>
        <Routes>
          <Route path="/register" element={<RegistrationStub />} />
          <Route path="/taste/onboarding" element={<TasteOnboardingPage />} />
          <Route path="/profile" element={<ProfileHubStub />} />
          <Route path="/taste/profile" element={<TasteProfilePage />} />
          <Route path="/" element={<DiscoveryStub />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Завершить регистрацию" }));

    await screen.findByText("Что вы чаще выбираете?");
    fireEvent.click(screen.getByRole("button", { name: "Эспрессо" }));
    fireEvent.click(screen.getByRole("button", { name: "Завершить" }));

    await screen.findByText("Карта вкуса сохранена");
    fireEvent.click(screen.getByRole("button", { name: "В профиль" }));

    await screen.findByText("Профиль");
    fireEvent.click(screen.getByRole("button", { name: "Профиль вкуса" }));

    await screen.findByText("Наши предположения");
    fireEvent.click(screen.getByRole("button", { name: "Не про меня" }));

    await screen.findByText(/Новых гипотез пока нет/i);
    fireEvent.click(screen.getByRole("button", { name: "Назад" }));

    await screen.findByText("Профиль");
    fireEvent.click(screen.getByRole("button", { name: "В поиск" }));

    await screen.findByText("Подходит вашему вкусу: чистая кислотность и фильтр-профиль.");
    expect(dismissTasteHypothesisMock).toHaveBeenCalledTimes(1);
    expect(reportMetricEventMock).toHaveBeenCalledWith(
      expect.objectContaining({ event_type: "taste_onboarding_started" }),
    );
    expect(reportMetricEventMock).toHaveBeenCalledWith(
      expect.objectContaining({ event_type: "taste_onboarding_completed" }),
    );
    expect(reportMetricEventMock).toHaveBeenCalledWith(
      expect.objectContaining({ event_type: "taste_hypothesis_dismissed" }),
    );
  });
});
