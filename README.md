# Markson's Blog

This repository contains the source code for <https://marksoniiii.github.io/>.
It is built with Astro and deployed to GitHub Pages.

## Project Structure

```text
.
├── .github/workflows/deploy.yml  # GitHub Pages deployment
├── public/                       # Static assets copied as-is
├── src/
│   ├── assets/                   # Images and icons
│   ├── components/               # Astro components
│   ├── content/
│   │   ├── pages/                # Standalone page content
│   │   └── posts/                # Blog posts
│   ├── layouts/                  # Page layouts
│   ├── pages/                    # Routes
│   ├── styles/                   # Global styles and theme
│   └── utils/                    # Shared helpers
├── astro-paper.config.ts         # Site-level configuration
├── astro.config.ts               # Astro configuration
└── package.json
```

## Development

Use npm for this repository because `package-lock.json` is committed.

```bash
npm install
npm run dev
```

Common commands:

| Command                | Description                                                  |
| ---------------------- | ------------------------------------------------------------ |
| `npm run dev`          | Start the local development server.                          |
| `npm run build`        | Type-check, build the site, and generate the Pagefind index. |
| `npm run preview`      | Preview the built site locally.                              |
| `npm run lint`         | Run ESLint.                                                  |
| `npm run format:check` | Check formatting with Prettier.                              |

## Writing Posts

Add Markdown or MDX posts under `src/content/posts/`. The folder path becomes
part of the final URL.

Site metadata, social links, pagination, and feature switches are configured in
`astro-paper.config.ts`.

## Deployment

Pushing to `main` triggers `.github/workflows/deploy.yml`, which builds the
Astro site and publishes it to GitHub Pages.
