# The Invigilators

Trance and progressive music mixers.

## Tech Stack

- **Astro** - Static site generator
- **Bun** - Package manager
- **Tailwind CSS 4** - Styling
- **TypeScript** - Type safety

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

```
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

Add new episode JSON files to `src/content/episodes/`:

```json
{
  "id": "ah033",
  "type": "aural-homework",
  "title": "Aural Homework 033",
  "date": "2025-01-01",
  "location": "London, UK",
  "length": "1:00:00",
  "mixcloud": "theInvigilators/...",
  "image": "/img/ah033.jpg",
  "description": "Episode description...",
  "tracks": [
    { "n": 1, "artist": "Artist", "title": "Track Title", "label": "Label" }
  ]
}
```

## Deployment

Push to `main` branch - GitHub Actions automatically builds and deploys to GitHub Pages.
