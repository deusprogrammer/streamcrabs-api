FROM node:20
WORKDIR /app
COPY package.json /app
RUN ulimit -u 1024
RUN npm install
RUN npm install -g nodemon esm
COPY . /app
CMD ["nodemon", "-r", "esm", "server.js"]
