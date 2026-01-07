# Cloudflare Pages Deployment Guide

## Overview

This project is deployed to Cloudflare Pages using the `@cloudflare/next-on-pages` adapter, which allows Next.js applications to run on Cloudflare's Edge Runtime.

## Deployment URLs

- **Production**: https://commitdetective.pages.dev
- **Latest Deployment**: https://ef398467.commitdetective.pages.dev
- **Stage**: https://stage.commitdetective.pages.dev

## Prerequisites

1. Cloudflare account with Pages access
2. Wrangler CLI installed (installed automatically via npx)
3. Project created in Cloudflare Pages (done via `make setup`)

## Deployment Commands

### Quick Deploy

```bash
make deploy
```

This will:
1. Build the application using `@cloudflare/next-on-pages`
2. Deploy to Cloudflare Pages

### Available Make Commands

```bash
make help       # Show available commands
make setup      # Create Cloudflare Pages project (first time only)
make build      # Build the Next.js application for Cloudflare
make deploy     # Build and deploy to Cloudflare Pages
make dev        # Run development server
```

## Manual Deployment

If you need to deploy manually:

```bash
# Build the project
pnpm pages:build

# Deploy to Cloudflare Pages
CLOUDFLARE_ACCOUNT_ID=decadef1486d1696a5c4631bfdee2cd7 npx wrangler pages deploy .vercel/output/static --project-name=commitdetective --commit-dirty=true
```

## Technical Details

### Edge Runtime Configuration

All API routes are configured to use the Edge Runtime for Cloudflare compatibility:

```typescript
export const runtime = 'edge';
```

This is required for:
- `/api/analyze`
- `/api/analyze/config`
- `/api/analyze/status`
- `/api/docs`

### Build Process

1. **Next.js Build**: Standard Next.js build with SSR and Edge Runtime support
2. **Vercel Build**: Converts Next.js output to Vercel format
3. **Cloudflare Adapter**: Transforms Vercel output to Cloudflare Workers format
4. **Worker Deployment**: Uploads the Worker bundle to Cloudflare

### Build Output

- Static assets: `.vercel/output/static`
- Worker bundle: `.vercel/output/static/_worker.js`
- Functions: `.vercel/output/static/_worker.js/__next-on-pages-dist__/functions`

## Troubleshooting

### Build Fails with "Recursive Invocation"

Ensure the `build` script in package.json is set to `next build`, not the Cloudflare adapter. Use `pages:build` for Cloudflare builds.

### API Routes Not Working

Make sure all API routes have `export const runtime = 'edge';` at the top of the file.

### Node.js Compatibility Warnings

The build may show warnings about `node:buffer` and `node:async_hooks`. These are expected and the Worker will function correctly on Cloudflare.

## Environment Variables

To add environment variables:

1. Go to Cloudflare Dashboard > Pages > commitdetective
2. Navigate to Settings > Environment Variables
3. Add your variables for Production and Preview environments

## Continuous Deployment

For automatic deployments on git push:

1. Connect your GitHub repository in Cloudflare Pages dashboard
2. Set Build command: `pnpm pages:build`
3. Set Build output directory: `.vercel/output/static`
4. Set Root directory: `/` (or leave empty)

## Notes

- The `@cloudflare/next-on-pages` adapter is deprecated but still functional
- Consider migrating to OpenNext adapter in the future
- All deployments include a unique URL for easy testing
- The `.open-next` directory is excluded from git (build artifact)
