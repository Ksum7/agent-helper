FROM node:24-alpine

WORKDIR /app

COPY package.json ./
COPY server.js ./

# Create non-root user
RUN addgroup -S sandbox && adduser -S sandbox -G sandbox

USER sandbox

EXPOSE 3001

CMD ["node", "server.js"]
