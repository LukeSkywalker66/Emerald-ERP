FROM node:22-alpine
WORKDIR /app
COPY package.json .
COPY package-lock.json .
# Instalar todas las dependencias (necesarias para modo dev)
RUN npm ci
# Exponemos el puerto de Vite
EXPOSE 5173
COPY . .
CMD ["npm", "run", "dev", "--", "--host"]




