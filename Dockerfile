FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production

RUN apk add --no-cache dumb-init libc6-compat

COPY package*.json ./

RUN npm ci --omit=dev && npm cache clean --force

COPY . .

# Đổi quyền sở hữu sang user node và chạy dưới quyền non-root
RUN chown -R node:node /app
USER node

EXPOSE 3000

CMD ["dumb-init", "node", "server.js"]
