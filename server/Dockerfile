FROM node:22-alpine
WORKDIR /app
COPY server/package.json server/server.mjs ./
COPY client/ ./client/
ENV PORT=8787 DB_PATH=/data/level.db WEB_DIR=/app/client
RUN mkdir -p /data && chown -R node:node /data /app
USER node
EXPOSE 8787
CMD ["node","server.mjs"]
