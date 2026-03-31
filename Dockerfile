# Use Node.js base image
FROM node:20-slim

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy all source files
COPY . .

# Build the frontend (Vite)
ENV NODE_ENV=production
RUN npm run build

# Start the application
CMD ["npm", "start"]
