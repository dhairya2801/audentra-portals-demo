FROM node:22.14.0-alpine AS dependencies
WORKDIR /workspace
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts/package.json packages/contracts/package.json
RUN npm ci \
      --include=dev \
      --workspaces \
      --include-workspace-root \
      --no-audit \
      --no-fund

FROM dependencies AS build
ARG NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
ARG NEXT_PUBLIC_SITE_URL=http://localhost:3000
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}
ENV NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL}
COPY . .
RUN npm run build

FROM node:22.14.0-alpine AS runtime
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
WORKDIR /workspace
COPY --from=build --chown=node:node /workspace/package.json /workspace/package.json
COPY --from=build --chown=node:node /workspace/node_modules /workspace/node_modules
COPY --from=build --chown=node:node /workspace/apps/web /workspace/apps/web
COPY --from=build --chown=node:node /workspace/packages/contracts /workspace/packages/contracts
USER node
EXPOSE 3000
CMD ["npm", "run", "start"]
