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
  const res = await http.get<SearchDrinksResponse>("/api/drinks", {
    params: {
      q: query,
      limit,
    },
  });

  if (!Array.isArray(res.data?.drinks)) {
    return [];
  }
  return res.data.drinks;
}
