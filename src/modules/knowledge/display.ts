/**
 * The name a person sees for a folder or file: the numeric ordering prefix and the `.md` extension are dropped and hyphens become
 * spaces (`03-sales-team` -> "Sales team", `daily-routine.md` -> "Daily routine"). `ai` is written "AI"; a name already in capitals (`README`) is kept.
 */
export function displayName(name: string): string {
  const base = name.replace(/\.md$/i, "").replace(/^\d+[-_.\s]+/, "").replace(/[-_]+/g, " ").trim();
  if (!base) return name;
  const words = base.split(" ").map((word) => (word.toLowerCase() === "ai" ? "AI" : word));
  const text = words.join(" ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}
