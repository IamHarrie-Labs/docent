FROM node:20-bookworm-slim

# simple-git shells out to the system git binary (needs ca-certificates for TLS
# verification against github.com); better-sqlite3 needs build tools to compile
# its native addon on install.
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates python3 make g++ \
    && update-ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

ENV NODE_ENV=production
EXPOSE 3000
CMD ["npm", "run", "start"]
