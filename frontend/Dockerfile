# Use an official Node runtime as a parent image
FROM node:20-alpine

# Set work directory
WORKDIR /app

# Install dependencies first (for caching)
COPY package*.json ./
RUN npm install

# Copy project files
COPY . .

# Create a non-root user and set permissions
RUN addgroup -S appgroup && adduser -S appuser -G appgroup && \
    chown -R appuser:appgroup /app

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 3000

# Start the development server
CMD ["npm", "run", "dev"]
