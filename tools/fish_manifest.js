// Собирает tools/fish_assets.json — список всех картинок игры с промптами для Flux.
// Запуск: node tools/fish_manifest.js
const fs = require("fs"), path = require("path");
global.window = global;
const G = path.join(__dirname, "..", "games", "fish", "js");
["util.js", "data.js"].forEach((f) => eval(fs.readFileSync(path.join(G, f), "utf8")));
const FZ = global.FZ;

const STYLE_BG = "painterly realistic digital illustration for a mobile game background, soft natural daylight, rich but natural colors, highly detailed, wide panoramic composition, no people, no boats, no animals, no text, no watermark, no frame";
const PLACE = {
  pond: "a small Russian village pond, birch trees and willows on the far bank, a few wooden village houses and a small white Orthodox church with a blue onion dome, reeds along the bank, a small wooden pier",
  oka: "the Oka river in central Russia, a sandy spit on the right, willows and mixed forest on the gentle far bank",
  platnik: "a paid fishing pond resort in the Russian countryside, small wooden gazebos and fishing platforms along the far shore, a birch grove behind",
  volga: "the vast Rybinsk reservoir on the Volga, a very distant low shoreline with dark forest, a tiny white bell tower and a small lighthouse far away, huge sky",
  ladoga: "lake Ladoga in Karelia, smooth granite rocks and boulders on the far shore, tall Scots pines",
  akhtuba: "the Akhtuba river in the Volga delta near Astrakhan, low banks with big willow trees, dense reeds, sandy shore",
  baikal: "lake Baikal, rugged mountains with snowy peaks on the far side, rocky shore with larch and pine trees",
  taiga: "a wild Siberian taiga river, steep hills covered with dense spruce and larch forest, rocky banks, light mist"
};
const SEASON = {
  spring: "early spring, fresh light green leaves, some trees still bare, small patches of melting snow in the shade",
  summer: "midsummer, lush green foliage, warm clear day with a few fluffy clouds",
  autumn: "golden autumn, yellow and orange birch leaves, dark green spruces, crisp clear day",
  winter: "deep winter, everything covered with fresh snow, snowy spruces, the lake is frozen and covered with flat white ice and snow"
};
const ITEMS = {
  worm: "a pink earthworm used as fishing bait", maggot: "a small pile of white fishing maggots", bloodworm: "a bundle of thin red bloodworm larvae, fishing bait",
  bread: "a slice of white bread", dough: "a ball of yellow fishing dough paste", corn: "a handful of yellow sweet corn kernels",
  barley: "a small pile of boiled pearl barley grains", livebait: "a small live silver minnow fish used as live bait", grasshopper: "a green grasshopper",
  boilie: "three round carp fishing boilies, orange and red", crawler: "a large dark red nightcrawler earthworm", amphipod: "a small freshwater amphipod shrimp (gammarus)",
  spinner: "a silver inline spinner fishing lure with a red bead and a treble hook", spoon: "a gold casting spoon fishing lure with a red stripe and a treble hook",
  wobbler: "a minnow wobbler crankbait fishing lure, blue back and silver belly, two treble hooks", jig: "a chartreuse soft plastic paddle-tail swimbait on a lead jig head",
  mouse: "a brown mouse-imitation fishing lure for taimen with a treble hook", balancer: "an ice fishing balance jig lure, yellow and red, hooks on both ends",
  icespoon: "a narrow silver vertical ice fishing spoon lure", mormy: "a tiny black tungsten ice fishing jig (mormyshka) with a gold bead",
  gb: "a paper bag of fishing groundbait with some crumbs spilled", float: "a classic fishing float bobber, red top and white body",
  feeder: "a metal mesh feeder cage for feeder fishing", ice: "a short winter ice fishing rod with a small reel and a spring nod indicator",
  line: "a spool of blue monofilament fishing line", hook: "a single steel fishing hook"
};

const out = { comment: "Списки картинок для Flux. size — [ширина, высота]. Генерация: python tools/fish_generate.py", images: [] };
FZ.LOCATIONS.forEach((l) => FZ.SEASON_ORDER.forEach((s) => {
  out.images.push({ key: "bg/" + l.id + "_" + s, group: "bg", size: [1024, 896],
    prompt: "Landscape view from the near shore across the water: " + PLACE[l.id] + ". " + SEASON[s] + ". The far shoreline runs straight across the lower part of the image, the water is visible only as a thin calm band along the very bottom edge, sky fills the upper half. " + STYLE_BG });
}));
FZ.SPECIES.forEach((sp) => {
  out.images.push({ key: "fish/" + sp.id, group: "fish", size: [1152, 640], cutout: true,
    prompt: "A " + sp.en + " (" + sp.lat + "), freshwater fish, full body in strict side view, head pointing to the LEFT, tail on the right, accurate natural coloration and anatomy, detailed scales and fins, wet glossy skin, high quality realistic natural history illustration, soft even studio lighting, isolated on a plain light gray background, centered, the whole fish visible with margins, no text, no watermark, no hook, no hands" });
});
Object.keys(ITEMS).forEach((id) => {
  out.images.push({ key: "items/" + id, group: "items", size: [768, 768], cutout: true,
    prompt: ITEMS[id] + ", fishing tackle game item icon, single object centered, clean detailed semi-realistic illustration, soft studio lighting, isolated on a plain light gray background, no text, no watermark" });
});
out.images.push({ key: "ui/icon", group: "ui", size: [1024, 1024], optional: true,
  prompt: "Mobile game app icon for a fishing game: a striped European perch leaping out of a calm lake at golden sunset next to a red and white fishing float, water splashes, bold readable silhouette, vibrant colors, centered composition, no text, no letters, no border" });
out.music = [
  { key: "music_summer", tags: "relaxing acoustic folk instrumental, warm fingerpicked acoustic guitar, soft mandolin, gentle shaker, summer morning by a lake, peaceful, nature, cozy game background music", bpm: 84, keyscale: "D major", seconds: 90 },
  { key: "music_spring", tags: "light cheerful acoustic instrumental, wooden flute melody, acoustic guitar, soft hand percussion, spring morning, birds, hopeful, game background music", bpm: 92, keyscale: "G major", seconds: 90 },
  { key: "music_autumn", tags: "calm melancholic instrumental, russian folk melody on balalaika and acoustic guitar, soft piano, autumn river, nostalgic, warm, game background music", bpm: 72, keyscale: "A minor", seconds: 90 },
  { key: "music_winter", tags: "cozy winter instrumental, soft felt piano, gentle sleigh bells, warm strings pad, snowy frozen lake, calm, game background music", bpm: 70, keyscale: "C major", seconds: 90 },
  { key: "music_night", tags: "slow dreamy ambient instrumental, warm analog synth pads, soft electric piano, distant crickets, night lake under the moon, lo-fi chill, game background music", bpm: 64, keyscale: "E minor", seconds: 90 }
];
const first = ["bg/pond_summer", "fish/pike", "items/worm"];
out.images.sort((a, b) => (first.indexOf(b.key) >= 0) - (first.indexOf(a.key) >= 0));
fs.writeFileSync(path.join(__dirname, "fish_assets.json"), JSON.stringify(out, null, 1));
console.log("images:", out.images.length, "music:", out.music.length);
