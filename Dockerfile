FROM node:20-alpine AS base
WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev && npm cache clean --force

COPY . .

RUN chown -R appuser:appgroup /app
USER appuser

EXPOSE 4000

CMD ["node", "src/index.js"]
