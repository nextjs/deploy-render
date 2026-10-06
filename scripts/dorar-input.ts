import fs from "node:fs";
import path from "node:path";
export function resolveDorarInput(explicit = process.env.DORAR_INPUT): string {
  if (explicit) {
    if (!fs.existsSync(explicit) || !fs.statSync(explicit).isFile() || !fs.readFileSync(explicit, "utf8").trim()) {
      throw new Error(`Dorar input is missing or empty: ${explicit}`);
    }
    return explicit;
  }
  const directory = "data/raw/dorar";
  const candidates = fs.existsSync(directory) ? fs.readdirSync(directory)
    .filter(name => name.endsWith(".jsonl"))
    .map(name => path.join(directory, name))
    .filter(file => fs.statSync(file).isFile() && fs.readFileSync(file, "utf8").trim()) : [];
  if (candidates.length !== 1) throw new Error(`Expected one nonempty Dorar input, found ${candidates.length}. Set DORAR_INPUT explicitly.`);
  return candidates[0];
}
