import { http } from "./http";

export type DrinkSuggestion = {
  id: string;
  name: string;
  aliases?: string[];
};

type SearchDrinksResponse = {
  drinks?: DrinkSuggestion[];
};

export async function searchDrinks(
  query: string,
  limit: number = 12,
): Promise<DrinkSuggestion[]> {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) {
    return [];
  }

  const request = () =>
    http.get<SearchDrinksResponse>("/api/drinks", {
      params: {
        q: normalizedQuery,
        limit,
      },
    });

  let res;
  try {
    res = await request();
  } catch (error: unknown) {
    const status =
      typeof error === "object" && error !== null && "response" in error
        ? (error as { response?: { status?: number } }).response?.status
        : undefined;
    if (status !== 425) {
      throw error;
    }
    await new Promise((resolve) => window.setTimeout(resolve, 240));
    res = await request();
  }

  if (!Array.isArray(res.data?.drinks)) {
    return [];
  }
  return res.data.drinks;
}
