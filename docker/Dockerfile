# Stage 1: Build stage
FROM node:20 as builder

WORKDIR /app

# define bknd version to be used as:
# `docker build --build-arg VERSION=<version> -t bknd .`
ARG VERSION=0.10.2

# Install & copy required cli
RUN npm install --omit=dev bknd@${VERSION}
RUN mkdir /output && cp -r node_modules/bknd/dist /output/dist

# Stage 2: Final minimal image
FROM node:20-alpine

WORKDIR /app

# Install pm2 and libsql
RUN npm install -g pm2
RUN echo '{"type":"module"}' > package.json
RUN npm install @libsql/client

# Create volume and init args
VOLUME /data
ENV DEFAULT_ARGS="--db-url file:/data/data.db"

# Copy output from builder
COPY --from=builder /output/dist ./dist

EXPOSE 1337
CMD ["pm2-runtime", "dist/cli/index.js run ${ARGS:-${DEFAULT_ARGS}} --no-open"]