import type { AdminDrink } from "../../../api/adminDrinks";
import type { DrinkEditorState } from "./types";

export function normalizeDrinkText(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .join(" ");
}

export function normalizeDrinkToken(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9а-яё\s/_-]+/g, "")
    .replace(/[\s/_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function parseAliases(value: string): string[] {
  if (!value.trim()) return [];
  const seen = new Set<string>();
  const aliases: string[] = [];
  for (const raw of value.split(",")) {
    const next = normalizeDrinkText(raw);
    if (!next || seen.has(next)) continue;
    seen.add(next);
    aliases.push(next);
  }
  aliases.sort((a, b) => a.localeCompare(b, "ru"));
  return aliases;
}

export function toEditorState(drink: AdminDrink): DrinkEditorState {
  return {
    id: drink.id,
    name: drink.name,
    aliases: drink.aliases.join(", "),
    description: drink.description ?? "",
    category: drink.category ?? "other",
    popularityRank: String(drink.popularity_rank ?? 100),
    isActive: Boolean(drink.is_active),
  };
}
