import { randomBytes } from "crypto";

const WORDS: readonly string[] = [
  "amber", "anchor", "apple", "arch", "arrow", "aspen", "atlas", "autumn",
  "azure", "basin", "beach", "birch", "blade", "blaze", "bloom", "bluff",
  "brass", "brave", "brook", "brush", "cairn", "cedar", "chase", "cliff",
  "cloud", "clover", "coral", "crane", "creek", "crest", "crisp", "crown",
  "curve", "cycle", "dagger", "dawn", "delta", "depth", "dew", "drift",
  "dune", "eagle", "earth", "echo", "ember", "field", "fjord", "flame",
  "fleet", "flint", "flood", "flora", "foam", "forge", "forth", "frost",
  "glade", "gleam", "glide", "glow", "grace", "grain", "grand", "grant",
  "grove", "guide", "haven", "hawk", "heath", "helm", "herald", "hill",
  "hollow", "horizon", "hunter", "inlet", "iris", "isle", "ivory", "jade",
  "jasper", "keen", "kindle", "lake", "lance", "lark", "latch", "laurel",
  "leaf", "ledge", "light", "linden", "loch", "lodge", "lunar", "lynx",
  "maple", "marsh", "mast", "meadow", "mesa", "mist", "moss", "mount",
  "nebula", "nether", "noble", "north", "ocean", "olive", "onyx", "orbit",
  "osprey", "otter", "palm", "path", "petal", "pine", "plover", "pond",
  "prism", "quest", "quill", "radiant", "rapid", "raven", "reef", "ridge",
  "river", "robin", "rocky", "root", "rose", "rune", "rush", "sage",
  "sail", "salt", "sand", "scout", "serene", "shade", "shore", "sierra",
  "silent", "silver", "sky", "slate", "slope", "snow", "solar", "song",
  "spark", "spire", "spring", "spruce", "star", "steel", "stone", "storm",
  "stream", "summit", "surge", "swift", "thorn", "tide", "timber", "torch",
  "trail", "vale", "valley", "vapor", "vault", "veil", "vine", "violet",
  "vista", "wave", "willow", "wind", "wolf", "zenith",
];

export function generateMagicToken(): string {
  return randomBytes(32).toString("hex");
}

export function generateReadablePassword(): string {
  const pick = () => WORDS[Math.floor(Math.random() * WORDS.length)];
  return `${pick()}-${pick()}-${pick()}-${pick()}`;
}
