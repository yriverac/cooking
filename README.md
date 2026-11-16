# Sazón & Sugar

A personal recipe box, published as a private Claude artifact. Data syncs through the artifact's hosted database.

- **Recipes:** cook mode (big text, one step at a time, screen stays awake, step timers) and servings scaling.
- **Adding recipes:** manual entry, or import from a link using pasted page text or screenshots. With screenshots, the dish photo is cropped automatically.
- **Meal prep:** a weekly planner with prep and cook days, plus a prep-day checklist that groups shared steps.
- **Freezer log:** portions and use-by dates for what's in the freezer.
- **Kitchen:** pantry, fridge and freezer inventory with best-by dates, and "What can I make?" suggestions.
- **Shopping list:** built from the plan minus your inventory, grouped by store section.
- **Allergy and meat checks:** shellfish and fish warnings, and a warning when a recipe uses more than one meat.
- **Data:** JSON export, weekly in-app backups, and restore.

## Build

```
cd src
node seed.js      # data/recipes-from-doc.json -> data/recipes.json (parsed fields + flags)
node inv.js       # kitchen inventory seed -> data/kitchen.json
python3 build.py  # shell.html + core.js + app parts + seed data -> app/index.html
```
