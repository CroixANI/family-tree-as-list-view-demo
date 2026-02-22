FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

ENV AUTH_HOST=0.0.0.0
ENV AUTH_PORT=8082

EXPOSE 8082

CMD ["npm", "run", "start:secure"]
