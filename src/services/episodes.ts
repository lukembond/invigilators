export interface Track {
  n: number;
  artist: string;
  title: string;
  label: string;
  start?: string;
  startSeconds?: number;
}

export interface Episode {
  id: string;
  type: string;
  title: string;
  date: string;
  location: string;
  length: string;
  mixcloud?: string;
  hearthis_id?: string;
  hearthis_url?: string;
  image_cover?: string;
  image_bg?: string;
  description: string;
  tracks: Track[];
  waveform?: number[];
}

export async function getEpisodes(): Promise<Episode[]> {
  const episodesDir = "./src/content/episodes";
  const waveformsDir = "./src/content/waveforms";
  const fs = await import("node:fs");
  const files = fs.readdirSync(episodesDir);
  const episodes = files
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(fs.readFileSync(`${episodesDir}/${f}`, "utf-8")));

  for (const episode of episodes) {
    const waveformPath = `${waveformsDir}/${episode.id}.json`;
    if (fs.existsSync(waveformPath)) {
      episode.waveform = JSON.parse(fs.readFileSync(waveformPath, "utf-8"));
    }
  }

  episodes.sort((a, b) => {
    const dateA = new Date(a.date).getTime();
    const dateB = new Date(b.date).getTime();
    if (dateA !== dateB) return dateB - dateA;
    return b.title.localeCompare(a.title);
  });

  const ahPositions = episodes
    .map((e, i) => ({ episode: e, pos: i }))
    .filter((x) => x.episode.type === "aural-homework")
    .map((x) => x.pos);

  const auralHomework = episodes
    .filter((e) => e.type === "aural-homework")
    .sort((a, b) => b.id.localeCompare(a.id));

  for (let i = 0; i < ahPositions.length; i++) {
    episodes[ahPositions[i]] = auralHomework[i];
  }

  return episodes;
}
