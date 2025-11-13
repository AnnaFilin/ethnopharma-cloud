# ---- Base image ----
FROM node:22-slim

# ---- Set working directory inside container ----
WORKDIR /app

# ---- Copy only cleaned pipeline code from subfolder ----
# (в контейнер попадут только файлы из src_clean/pipeline)
COPY src_clean/pipeline/ ./

# ---- Install dependencies (only production) ----
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; \
    elif [ -f package.json ]; then npm install --omit=dev; \
    else echo "No package.json found, skipping npm install"; fi

# ---- Ensure required runtime deps ----
RUN npm install --omit=dev firebase-admin ajv ajv-formats && \
    npm list ajv ajv-formats

# ---- Make run script executable ----
RUN chmod +x run.sh

# ---- Default start command ----
CMD ["bash", "run.sh"]
