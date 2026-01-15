# Use Node.js 20 base image
FROM node:20-slim

# Install system dependencies if required for canvas/pdf (though pdf-lib is pure JS)
# But we might need some tools for ts-node
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Expose the Purple Agent port
EXPOSE 9010

# Entrypoint to run the server
# We use npx ts-node to run the typescript server directly
ENTRYPOINT ["npx", "ts-node", "server.ts"]
CMD ["--host", "0.0.0.0", "--port", "9010"]
