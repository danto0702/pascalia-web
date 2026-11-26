# Convertidor Word → PDF de PascalPDF y Pascal Sign (LibreOffice sin interfaz)
FROM node:22-trixie-slim
# Letras: las de Microsoft (Arial, Times, Verdana, Georgia, Trebuchet...) y equivalentes con la misma medida
# (Carlito = Calibri, Caladea = Cambria, Liberation Sans Narrow = Arial Narrow, URW = Century Gothic/Bookman...)
RUN sed -i 's/Components: main/Components: main contrib/' /etc/apt/sources.list.d/debian.sources \
    && apt-get update \
    && echo "ttf-mscorefonts-installer msttcorefonts/accepted-mscorefonts-eula select true" | debconf-set-selections \
    && apt-get install -y --no-install-recommends \
      libreoffice-writer-nogui fonts-crosextra-carlito fonts-crosextra-caladea fonts-liberation fonts-liberation2 \
      fonts-dejavu-core fonts-noto-core fonts-urw-base35 fontconfig zip unzip \
    && (apt-get install -y --no-install-recommends ttf-mscorefonts-installer || echo "sin fuentes de Microsoft") \
    && rm -rf /var/lib/apt/lists/*
COPY fuentes.conf /etc/fonts/local.conf
# Versión de LibreOffice en el registro de construcción (para comparar resultados)
RUN soffice --version || true
RUN fc-cache -f
WORKDIR /app
COPY servidor.mjs ./
ENV NODE_ENV=production
USER node
CMD ["node", "servidor.mjs"]
