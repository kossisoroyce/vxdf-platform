# Stage 1: Builder
# This stage installs all dependencies and builds the application.
FROM node:20-slim AS builder

# Install system dependencies for Python
RUN apt-get update && apt-get install -y python3 python3-pip build-essential git && \
    rm -rf /var/lib/apt/lists/*

# Install the vxdf library from PyPI
RUN pip3 install --no-cache-dir vxdf

# Set the working directory
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy Node.js dependency manifests
COPY package.json pnpm-lock.yaml ./

# Install Node.js dependencies
RUN pnpm install --frozen-lockfile

# Copy the rest of the platform source code
COPY . .

# Build the Next.js application
RUN pnpm build

# --- #

# Stage 2: Runner
# This stage creates the final, lean image for production.
FROM node:20-slim AS runner

WORKDIR /app

# Install system dependencies required for runtime
RUN apt-get update && apt-get install -y python3 && \
    rm -rf /var/lib/apt/lists/*

# Copy environment configuration
COPY --from=builder /app/.env.example /app/.env.local

# Copy the public assets
COPY --from=builder /app/public /app/public

# Copy the standalone Next.js server output
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./ 

# Copy the static assets
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy the Python packages from the builder stage
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Expose the port the app runs on
EXPOSE 3000

# Set the user to run the app
USER nextjs

# The command to run the application
CMD ["node", "server.js"]
