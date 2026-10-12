FROM node:24-alpine@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm@9.15.5
RUN pnpm install --frozen-lockfile

COPY . .

ARG NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL

RUN pnpm build

EXPOSE 3000

ENV NODE_ENV=production

CMD ["pnpm", "start"]
