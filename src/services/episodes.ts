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

function extractEpisodeNumber(title: string): number {
  const match = title.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

export async function getEpisodes(): Promise<Episode[]> {
  const episodesDir = "./src/content/episodes";
  const fs = await import("node:fs");
  const files = fs.readdirSync(episodesDir);
  return files
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(fs.readFileSync(`${episodesDir}/${f}`, "utf-8")))
    .sort((a, b) => {
      const numA = extractEpisodeNumber(a.title);
      const numB = extractEpisodeNumber(b.title);
      // Sort by episode number descending (higher first)
      return numB - numA;
    });
}
