FROM node:20-alpine

WORKDIR /app

COPY five-role-loop/package.json five-role-loop/package-lock.json ./five-role-loop/
RUN cd five-role-loop && npm ci --omit=dev --registry=https://registry.npmjs.org

COPY live-console/package.json live-console/package-lock.json ./live-console/
RUN cd live-console && npm ci --registry=https://registry.npmjs.org

COPY five-role-loop ./five-role-loop
COPY live-console ./live-console

WORKDIR /app/live-console
ENV PORT=4310
EXPOSE 4310

CMD ["npx", "tsx", "server.ts"]
