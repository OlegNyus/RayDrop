# Stage 1: Build client
FROM node:22-alpine AS build-client
WORKDIR /app/client
COPY client/package.json client/package-lock.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# Stage 2: Build server
FROM node:22-alpine AS build-server
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci
COPY server/ ./
RUN npm run build

# Stage 3: Production
FROM node:22-alpine
WORKDIR /app

COPY --from=build-client /app/client/dist ./client/dist
COPY --from=build-server /app/server/dist ./server/dist
COPY --from=build-server /app/server/node_modules ./server/node_modules
COPY --from=build-server /app/server/package.json ./server/package.json

EXPOSE 3001

CMD ["node", "server/dist/index.js"]
