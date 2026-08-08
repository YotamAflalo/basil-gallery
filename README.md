# Basil Swimmer Gallery

The paintings of **Basil Andrew Swimmer** — b. 1941, South Africa; lives and
works in Rishon LeZion, Israel.

A phone-first gallery of 258 paintings. Next.js on Vercel, images and their
details in ImageKit.

**The one thing to understand:** no painting data lives in this repository.
Titles, years, places and the images themselves are all in ImageKit, so the
collection is edited at `/admin` or in the ImageKit dashboard and the site
picks the change up on its own. Deploying a new version of the site never
touches it. See [ARCHITECTURE.md](./ARCHITECTURE.md) for why it is built that
way.

## Everyday tasks

### Add a painting

Two ways, neither of which needs a developer:

1. **ImageKit dashboard** → upload into `/paintings/<Country>` →
   [media library](https://imagekit.io/dashboard/media-library). It appears on
   the site within ten seconds.
2. Upload anywhere in `/paintings`, then open `/admin` and fill in the details.

### Fill in a painting's details

Go to `/admin` and sign in with `ADMIN_PASSWORD`. The queue defaults to works
that have not been checked yet. It is keyboard-driven because there are a lot
of them:

| Key | Does |
| --- | --- |
| `⌘/Ctrl` + `Enter` | Save and go to the next |
| `⌘/Ctrl` + `D` | Reuse the previous place, year and technique |
| `Alt` + `→` / `←` | Skip without saving |

`⌘/Ctrl D` is the one that saves time: a batch of paintings from one trip
shares a place and year, so tag the first and repeat it down the run.

### Hide a painting

Untick **Show on the site** in `/admin`. It stays in ImageKit; visitors do not
see it.

### Back up the details

```bash
npm run metadata:export      # -> backups/metadata-<date>.json
```

Everything: every painting's title, year, place, technique, description and
tags. Keep a copy somewhere other than this machine. To put it back, or to
move to a different ImageKit account:

```bash
npm run metadata:import -- backups/metadata-2026-08-08.json --dry   # preview
npm run metadata:import -- backups/metadata-2026-08-08.json
```

## Running it locally

Needs Node 22+.

```bash
npm install
cp .env.example .env     # then fill it in, see below
npm run dev              # http://localhost:3000
```

### Environment variables

| Variable | Where it comes from | Needed for |
| --- | --- | --- |
| `IMAGEKIT_PRIVATE_KEY` | [API keys](https://imagekit.io/dashboard/developer/api-keys) | everything — **never commit or paste this anywhere** |
| `IMAGEKIT_URL_ENDPOINT` | [URL endpoints](https://imagekit.io/dashboard/url-endpoints) | building image URLs |
| `NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT` | same value | the browser-side image loader |
| `ADMIN_PASSWORD` | you choose it | `/admin`. Without it `/admin` returns 503 rather than being left open |
| `IMAGEKIT_WEBHOOK_SECRET` | ImageKit generates it, starts `whsec_` | optional; only for uploads made in the ImageKit dashboard |
| `IMAGEKIT_PUBLIC_KEY` | API keys page | not used yet; for future browser uploads |

## Deploying

Vercel builds the `main` branch. Set the same variables under **Settings →
Environment Variables**, then redeploy — environment changes do not apply to
existing deployments.

To let ImageKit-dashboard uploads reach the site, add a webhook at
[Developer options](https://imagekit.io/dashboard/developer) pointing at
`https://your-site/api/webhooks/imagekit` for `file.created`, `file.updated`
and `file.deleted`, then put the `whsec_…` it gives you into
`IMAGEKIT_WEBHOOK_SECRET`.

## Scripts

| Command | Does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and serve |
| `npm run typecheck` / `npm run lint` | Types and lint |
| `npm run metadata:export` | Back up all painting details to `backups/` |
| `npm run metadata:import -- <file>` | Restore them. `--dry` previews |
| `npm run schema:setup` | Create the custom metadata fields in ImageKit. Idempotent |
| `npm run migrate` | One-off upload of `static/images`. Already done; idempotent |
| `npm run verify:live` | Checks an edit reaches the running site. Server must be up |

`npm run verify:live` is the regression test for the promise this whole design
rests on. It renames a real painting, checks the site, and puts the title
back. Run it after touching anything in `lib/paintings.ts`.

## Layout

```
app/            pages: / (about Basil), /gallery, /admin
components/     gallery grid, fullscreen viewer, wallpaper sheet
lib/            schema.ts is the single definition of a painting
scripts/        migration, backup, restore, verification
legacy/         the previous FastAPI site, kept for reference
static/images/  the original files, no longer tracked in git
```

## Credit

Built for the family. Paintings by Basil Andrew Swimmer.
