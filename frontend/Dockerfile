FROM node:22-alpine
WORKDIR /app
COPY package.json .
COPY package-lock.json .
# Solo dependencias de producción, cero devDependencies
RUN npm ci --only=production
# Exponemos el puerto de Vite
EXPOSE 5173
COPY . .
CMD ["npm", "run", "dev", "--", "--host"]




