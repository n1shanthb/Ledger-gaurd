# Ledger-way keeper: Key Ring decrypt at boot (no USB). Master key never leaves Ledger.
# Build context = packages/keeper (includes vendor/graph-data for Docker).
FROM node:22-bookworm-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json ./
COPY vendor/graph-data ./vendor/graph-data

# Rewrite monorepo file:../graph-data → local vendor copy for this image
RUN node -e "const fs=require('fs'); const p=JSON.parse(fs.readFileSync('package.json','utf8')); p.dependencies['@lga/graph-data']='file:./vendor/graph-data'; fs.writeFileSync('package.json', JSON.stringify(p,null,2));" \
  && npm install --omit=dev \
  && npm install @ledgerhq/wallet-cli --no-save \
  && npm install -g @ledgerhq/wallet-cli \
  && npm install tsx typescript @types/node @types/express --no-save

COPY tsconfig.json ./
COPY src ./src
COPY secrets.env.enc ./secrets.env.enc

ENV NODE_ENV=production
ENV KEEPER_PORT=3001
ENV POLL_MS=0
ENV LGA_SECRETS_SOURCE=ring
ENV LGA_RING_KEY=lga-keeper
ENV LGA_SECRETS_ENC=/app/secrets.env.enc
ENV WALLET_CLI_BIN=/app/node_modules/@ledgerhq/wallet-cli/bin/wallet-cli
ENV PAY_ON_HIT=1
ENV WATCH_MS=30000

EXPOSE 3001

CMD ["sh", "-c", "export KEEPER_PORT=${PORT:-${KEEPER_PORT:-3001}}; export KEEPER_URL=http://127.0.0.1:${KEEPER_PORT}; node --import tsx src/index.ts"]
