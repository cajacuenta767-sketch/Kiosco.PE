# Una sola imagen sirve la PWA y la API. Datos en /app/data (PGlite) o en Postgres externo vía DATABASE_URL.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/
COPY apps/api/package.json apps/api/
RUN npm ci
COPY . .
RUN npm run build && npm run build:api

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3000 PGLITE_DIR=/app/data/kiosco
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/packages/shared ./packages/shared
COPY --from=build /app/apps/api/package.json ./apps/api/
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/drizzle ./apps/api/drizzle
COPY --from=build /app/apps/web/dist ./apps/web/dist
RUN npm ci --omit=dev --workspace @kiosco/api --workspace @kiosco/shared && mkdir -p /app/data
VOLUME ["/app/data"]
EXPOSE 3000
CMD ["node", "apps/api/dist/index.js"]
