# Stage 1: Build the Angular application
FROM node:22-alpine AS build

# Set the working directory inside the container
WORKDIR /app

# Copy package files first to leverage Docker layer caching
COPY package.json package-lock.json ./

# Install dependencies (ci is faster and more reliable for builds)
RUN npm ci

# Copy the rest of the application source code
COPY . .

# Build the Angular app for production
RUN npm run build -- --configuration=production


# Stage 2: Serve the built app with Nginx
FROM nginx:1.25-alpine AS production

# Remove the default Nginx static files
RUN rm -rf /usr/share/nginx/html/*

# Copy the built Angular files from the build stage
COPY --from=build /app/dist/timer-angular/browser /usr/share/nginx/html

# Copy a custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80

# Start Nginx in the foreground
CMD ["nginx", "-g", "daemon off;"]
