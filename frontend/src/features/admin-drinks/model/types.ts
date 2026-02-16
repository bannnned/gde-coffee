export type DrinkEditorState = {
  id: string;
  name: string;
  aliases: string;
  description: string;
  category: string;
  popularityRank: string;
  isActive: boolean;
};

export type UnknownStatusOption = "" | "new" | "mapped" | "ignored";
