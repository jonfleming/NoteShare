# Use official Node.js LTS image as the base
FROM node:20-alpine AS base

# Set working directory
WORKDIR /app

# Install dependencies only when needed
COPY package.json package-lock.json* ./
RUN npm install --production

# Copy the rest of the application code
COPY . .

# Build the Next.js app
RUN npm run build

# Expose the port the app runs on
EXPOSE 4000

# Start the Next.js app
CMD ["node", "server.js"]
