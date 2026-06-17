FROM node:20-bookworm-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
# public/ is pre-generated on the host (npm run build) and shipped in the image,
# because generate.js reads ../build (outside the kiosk/ build context).
COPY . .
ENV PORT=8080
EXPOSE 8080
CMD ["node", "server.js"]
