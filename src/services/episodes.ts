export interface Track {
  n: number;
  artist: string;
  title: string;
  label: string;
}

export interface Episode {
  id: string;
  type: string;
  title: string;
  date: string;
  location: string;
  length: string;
  mixcloud: string;
  hearthis?: string;
  image: string;
  description: string;
  tracks: Track[];
}

export async function getEpisodes(): Promise<Episode[]> {
  const episodesDir = "./src/content/episodes";
  const fs = await import("node:fs");
  const files = fs.readdirSync(episodesDir);
  return files
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(fs.readFileSync(`${episodesDir}/${f}`, "utf-8")))
    .sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      // Sort by date newest first
      if (dateA !== dateB) return dateB - dateA;
      // Same date - sort by title descending (Part 2 before Part 1)
      return b.title.localeCompare(a.title);
    });
}
