FROM oven/bun:1 as builder
WORKDIR /app
COPY package*.json .
RUN bun i --frozen-lockfile
COPY . .
RUN bun run build

FROM oven/bun:1
WORKDIR /app
COPY --from=builder /app/build build/
EXPOSE 3000
CMD [ "bun", "run", "./build" ]