FROM node:22-alpine AS build
WORKDIR /app
RUN npm install -g bun
COPY package.json bun.lock bunfig.toml ./
RUN bun install --frozen-lockfile
COPY . .
ARG VITE_API_URL
ENV NITRO_PRESET=node-server
ENV VITE_API_URL=${VITE_API_URL}
RUN bun run build

FROM node:22-alpine AS runner

LABEL org.opencontainers.image.source="https://github.com/rushikeshsakharleofficial/server-inventory"
LABEL org.opencontainers.image.description="ServerInventory frontend — self-hosted multi-cloud server inventory UI"
LABEL org.opencontainers.image.licenses="MIT"

WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/.output ./output
RUN chown -R node:node /app
USER node
EXPOSE 3000
ENV PORT=3000
CMD ["node", "output/server/index.mjs"]
