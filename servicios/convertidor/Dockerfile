# Convertidor Word → PDF de PascalPDF y Pascal Sign (LibreOffice sin interfaz)
FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
      libreoffice-writer-nogui fonts-crosextra-carlito fonts-crosextra-caladea \
      fonts-liberation2 fonts-dejavu-core fonts-noto-core fontconfig \
    && rm -rf /var/lib/apt/lists/* && fc-cache -f
WORKDIR /app
COPY servidor.mjs ./
ENV NODE_ENV=production
USER node
CMD ["node", "servidor.mjs"]
