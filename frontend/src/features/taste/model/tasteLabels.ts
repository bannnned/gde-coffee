const labels: Record<string, string> = {
  fruity_berry: "Фруктово-ягодный",
  citrus: "Цитрусовый",
  floral: "Цветочный",
  nutty_cocoa: "Орехово-шоколадный",
  caramel_sweet: "Карамельно-сладкий",
  spicy: "Пряный",
  roasted_bitter: "Обжарочно-горький",
  herbal_green: "Травянистый",

  acidity_high: "Яркая кислотность",
  acidity_low: "Низкая кислотность",
  sweetness_high: "Высокая сладость",
  bitterness_high: "Высокая горечь",
  body_light: "Легкое тело",
  body_heavy: "Плотное тело",
  aftertaste_long: "Долгое послевкусие",
  aftertaste_short: "Короткое послевкусие",

  espresso: "Эспрессо",
  milk_based: "Молочные напитки",
  filter: "Фильтр",
  cold: "Холодные напитки",

  black_only: "Черный кофе",
  milk_ok: "С молоком",
  plant_milk_preferred: "Растительное молоко",

  hot: "Горячая подача",
  iced: "Холодная подача",

  quick_pickup: "To-go",
  work_focus: "Для работы",
  slow_weekend: "Медленный выходной",
};

export function getTasteLabel(code: string): string {
  const key = code.trim();
  if (!key) return "Неизвестный тег";
  return labels[key] ?? key.replaceAll("_", " ");
}

export function getPolarityLabel(polarity: string): string {
  return polarity === "negative" ? "Не нравится" : "Нравится";
}

export function getSourceLabel(source: string): string {
  switch (source) {
    case "onboarding":
      return "Карта вкуса";
    case "behavior":
      return "Отзывы и визиты";
    case "explicit_feedback":
      return "Подтверждено вами";
    case "mixed":
      return "Смешанный сигнал";
    default:
      return source || "Источник не указан";
  }
}
