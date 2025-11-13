FROM node:22-slim
WORKDIR /app

COPY src_clean/pipeline/ ./

RUN if [ -f package-lock.json ]; then npm ci --omit=dev; \
    elif [ -f package.json ]; then npm install --omit=dev; \
    else echo "No package.json found, skipping npm install"; fi

RUN npm install --omit=dev firebase-admin ajv ajv-formats && \
    npm list ajv ajv-formats

RUN chmod +x run.sh
CMD ["bash", "run.sh"]
