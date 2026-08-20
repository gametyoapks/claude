FROM node:18.20.8-alpine

WORKDIR /app

COPY package.json .

RUN npm install --production

COPY bot.js .

CMD ["npm", "start"]
