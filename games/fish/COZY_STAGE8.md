## Cozy Stage 8: menu concept and trophy netting

- Main menu rebuilt on the existing UI with a wooden timber sign, warm sunrise over the lake, photographic tackle, gold primary button, compact 3×3 section grid, and profile strip.
- Nine existing game navigation buttons remain with their original IDs and handlers.
- A permanent «★ Оценить игру» control is visible in the menu footer alongside «Как играть». Calls the existing FZ.Platform.rate() handler, which opens the game's original RuStore page, not the side-by-side preview.
- Bigger trophied fish now have a simple finishing action once exhausted by the shore: hold the *existing* action button to land faster with the net. Waiting still lands safely and does not cause an extra random line break. Winter/small fish retain the old timing.
- No change to caught fish tables, ad rate, saves, RuStore publication, or original main branch.
