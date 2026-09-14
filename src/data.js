const sources = [
  ["Breakfast", "data/breakfast.json"],
  ["Desserts", "data/desserts.json"],
  ["Dinner", "data/dinner.json"],
  ["Drinks", "data/drinks.json"],
  ["Miscellaneous", "data/miscellaneous.json"],
];

const stripFavorite = (name) => name.replace(/^⭐\s*/, "");
const isFavorite = (name) => name.startsWith("⭐");

// Some older recipe image filenames do not exactly match the recipe title.
const legacySlugs = {
  "Applesauce": "applesauce-grandma-peggy",
  "Sweet Potatoes Gratin": "sweet-potato-gratin",
};

const recipeSlug = (name) => {
  const cleanName = stripFavorite(String(name ?? "")).trim();

  if (legacySlugs[cleanName]) {
    return legacySlugs[cleanName];
  }

  return cleanName
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
};

export async function loadRecipes() {
  const entries = await Promise.all(sources.map(async ([category, url]) => {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`Unable to load ${url}`);
    const json = await response.json();
    return [category, json];
  }));

  const categories = {};
  const recipes = [];

  for (const [category, groups] of entries) {
    categories[category] = groups;

    for (const [subcategory, items] of Object.entries(groups)) {
      for (const recipe of items) {
        // Keep the existing legacy ID when url is present.
        // For recipes where url has been removed, recreate the same
        // legacy path from the recipe title so favorites, planner data,
        // recipe routing, and image lookup continue to work.
        const id = recipe.url || `recipes/${recipeSlug(recipe.name)}.html`;

        recipes.push({
          ...recipe,
          category,
          subcategory,
          favorite: isFavorite(recipe.name),
          displayName: stripFavorite(recipe.name),
          id,
        });
      }
    }
  }

  recipes.sort((a, b) => a.displayName.localeCompare(b.displayName));
  return { categories, recipes };
}
