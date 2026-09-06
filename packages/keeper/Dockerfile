# Ledger-way keeper: Key Ring decrypt at boot (no USB). Master key never leaves Ledger.
FROM node:22-bookworm-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# wallet-cli resolves via PATH / node_modules for ring decrypt
COPY package.json package-lock.json* ./
RUN npm install --omit=dev \
  && npm install -g @ledgerhq/wallet-cli \
  && npm install tsx typescript @types/node @types/express --no-save

COPY tsconfig.json ./
COPY src ./src
COPY secrets.env.enc ./secrets.env.enc

ENV NODE_ENV=production
ENV KEEPER_PORT=3001
ENV POLL_MS=30000
ENV LGA_SECRETS_SOURCE=ring
ENV LGA_RING_KEY=lga-keeper
ENV LGA_SECRETS_ENC=/app/secrets.env.enc

# Railway injects PORT — map if present
EXPOSE 3001

CMD ["sh", "-c", "export KEEPER_PORT=${PORT:-${KEEPER_PORT:-3001}}; node --import tsx src/index.ts"]
