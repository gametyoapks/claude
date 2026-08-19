FROM node:18-alpine

WORKDIR /app

COPY package.json package.json

RUN npm install

COPY bot.js bot.js

CMD ["node", "bot.js"]
