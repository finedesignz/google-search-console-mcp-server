# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app
ENV NODE_ENV=development
COPY package*.json tsconfig.json ./
COPY src ./src
RUN npm ci --ignore-scripts && npm run build

# Stage 2: Production
FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts

# Security: Non-root user
RUN addgroup -g 1001 -S mcp && adduser -S mcp -u 1001
RUN chown -R mcp:mcp /app
USER mcp

ENV NODE_ENV=production
ENV MCP_TRANSPORT=http
ENV HTTP_PORT=9100

EXPOSE 9100

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:9100/health || exit 1

ENTRYPOINT ["node", "dist/index.js"]
