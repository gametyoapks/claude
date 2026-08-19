FROM node:18-alpine

LABEL maintainer="ToldClient"
LABEL description="Discord verification bot with Supabase integration"

WORKDIR /app

COPY package.json package-lock.json* ./

RUN npm ci --only=production

COPY bot.js .

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "console.log('ok')" || exit 1

CMD ["node", "bot.js"]
