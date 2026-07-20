FROM node:20-alpine

WORKDIR /app

# Copier les manifestes npm et workspaces
COPY package.json package-lock.json ./
COPY packages/core/package.json ./packages/core/
COPY packages/content/package.json ./packages/content/

# Installer les dépendances, workspaces inclus
RUN npm ci

# Copier le reste du code source
COPY . .

# Variables d'environnement de build
ARG NEXT_DEPLOYMENT_ID
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_DEPLOYMENT_ID=${NEXT_DEPLOYMENT_ID}

# Construire les bundles de production Next.js
RUN npm run build

# Exposer le port Next.js par défaut
EXPOSE 3000

# Variables d'environnement d'exécution
ENV PORT=3000
ENV OWNER_NAME="Emberdex Keeper"
ENV EMBERDEX_DATA_DIR="/app/data"

# Créer le répertoire de persistance
RUN mkdir -p /app/data

# Démarrer l'application
CMD ["npm", "run", "start"]
