# --- Build stage ---
FROM node:20-alpine AS build
WORKDIR /app

# Install deps
COPY package*.json ./
RUN npm ci

# Copy sources & build
COPY . .
RUN npm run build

# --- Runtime stage ---
FROM nginx:1.27-alpine

# Nginx config (serve dist on port 3000)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Static files
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 3000
CMD ["nginx", "-g", "daemon off;"]
