.PHONY: build deploy setup help

# Default target
help:
	@echo "Available commands:"
	@echo "  make setup       - Create Cloudflare Pages project (first time only)"
	@echo "  make build       - Build the Next.js application"
	@echo "  make deploy      - Build and deploy to Cloudflare Pages"
	@echo "  make dev         - Run development server"

# Build the Next.js app
build:
	@echo "Building Next.js application for Cloudflare..."
	pnpm pages:build

# Create Cloudflare Pages project (run this once)
setup:
	@echo "Creating Cloudflare Pages project..."
	CLOUDFLARE_ACCOUNT_ID=decadef1486d1696a5c4631bfdee2cd7 npx wrangler pages project create commitdetective --production-branch=main

# Deploy to Cloudflare Pages
deploy: build
	@echo "Deploying to Cloudflare Pages..."
	CLOUDFLARE_ACCOUNT_ID=decadef1486d1696a5c4631bfdee2cd7 npx wrangler pages deploy .vercel/output/static --project-name=commitdetective --commit-dirty=true

# Run development server
dev:
	pnpm dev
