# The Invigilators

Trance and progressive music mixers.

## Tech Stack

- **Astro** - Static site generator
- **Bun** - Package manager
- **Tailwind** - Styling
- **TypeScript** - Type safety
- **Playwright** - End-to-End test suite

## Development

```bash
# Install dependencies
bun install

# Start dev server
bun run dev

# Build for production
bun run build

# Preview production build
bun run preview
```

## Project Structure

```plaintext
src/
├── components/    # Astro components
├── content/      # Episode JSON data
├── layouts/      # Page layouts
├── pages/        # Astro pages
└── styles/       # Global CSS
public/
├── favicons/    # Site favicons
├── font/        # Avant Garde font
├── img/         # Episode images
└── video/      # Hero video
```

## Adding Episodes

1. Add WebP artwork using the episode ID as its filename:

   - `public/img/episode-cover/<id>.webp`
   - `public/img/episode-bg/<id>.webp`

2. Add `src/content/episodes/<id>.json`. The `hearthis_url` is required to generate a waveform.

```json
{
  "id": "ah035",
  "type": "aural-homework",
  "title": "Aural Homework 035",
  "date": "2024-06-30",
  "location": "London, UK",
  "length": "1:33:00",
  "image_cover": "/img/episode-cover/ah035.webp",
  "image_bg": "/img/episode-bg/ah035.webp",
  "description": "Episode description...",
  "cuesheet": "../cuesheets/the_invigilators-aural_homework_035.cue",
  "hearthis_id": "14609663",
  "hearthis_url": "https://hearthis.at/theinvigilators/ah035/",
  "tracks": [
    {
      "n": 1,
      "artist": "Artist",
      "title": "Track Title",
      "label": "Label",
      "index": "00:55:00",
      "start": "0:55",
      "startSeconds": 55
    }
  ]
}
```

1. For a track list with timing data, add a cue sheet at
   `src/content/cuesheets/the_invigilators-<episode-name>.cue`. Use the
   `cuesheet` property in the JSON to link it. Run the timing helper first as a
   dry run, then write the detected track timings:

```bash
bun run cuesheet-timings
bun run cuesheet-timings -- --write
```

The cue sheet's track artist/title values must correspond to the JSON track list
so the script can match them. It writes `start` and `startSeconds`; add each cue
`INDEX 01 MM:SS:FF` value to the matching JSON track as `index` manually.

1. Generate the waveform peak data after the episode is available on HearThis:

```bash
# Generate only the new episode
bun run waveforms -- ah035

# Regenerate every episode with a hearthis_url
bun run waveforms
```

This writes `src/content/waveforms/ah035.json`. Commit the episode JSON, artwork,
cue sheet (when used), and generated waveform file together.

## Deployment

Push to `main` branch - GitHub Actions automatically builds and deploys to GitHub Pages.
