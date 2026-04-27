FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN DATABASE_URL=/tmp/build.db BETTER_AUTH_SECRET=build ORIGIN=http://localhost npm run build


FROM node:22-alpine AS runner

WORKDIR /app

COPY --from=builder /app/build ./build
COPY --from=builder /app/package*.json ./
RUN npm ci --omit=dev && mkdir -p /app/data

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "build/index.js"]
