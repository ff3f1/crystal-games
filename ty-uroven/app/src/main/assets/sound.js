/* Original locally generated music and SFX; never starts before interaction. */
window.LevelSound = (() => {
  let settings = { music: 0, sfx: 0.45, track: "haven" },
    music = null,
    unlocked = false,
    muted = false,
    track = "";
  const effects = new Set();
  function configure(s) {
    settings = { ...s };
    if (music) {
      music.volume = settings.music;
      if (track !== settings.track) {
        music.pause();
        music = null;
      }
      if (!settings.music) pause();
    }
    if (unlocked && settings.music) start();
  }
  function start() {
    if (document.hidden || muted || !settings.music) return;
    unlocked = true;
    if (!music) {
      track = settings.track;
      music = new Audio("assets/" + track + ".ogg");
      music.loop = true;
      music.preload = "none";
    }
    music.volume = settings.music;
    music.play().catch(() => {});
  }
  function play(name) {
    unlocked = true;
    if (!settings.sfx || document.hidden) return;
    const a = new Audio(
      "assets/" +
        ({ level: "level", reward: "reward", tap: "tap" }[name] || "tap") +
        ".wav",
    );
    a.volume = settings.sfx;
    effects.add(a);
    a.onended = () => effects.delete(a);
    a.onerror = () => effects.delete(a);
    a.play().catch(() => effects.delete(a));
  }
  function pause() {
    music?.pause();
    for (const a of effects) a.pause();
    effects.clear();
  }
  return { configure, start, play, pause };
})();
