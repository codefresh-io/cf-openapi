FROM node:12.16.2-alpine

ENV NPM_CONFIG_CACHE=/app/cache/npm
ENV XDG_CONFIG_HOME=/app/cache/

# Create app directory
RUN mkdir -p /app
WORKDIR /app

# Bundle app source
COPY . /app

# Install  app dependencies
# NOTE: devDependencies are installed intentionalyh
RUN apk update && apk add --no-cache --virtual deps python make g++ krb5-dev bash jq git openssh-client && \
    yarn install && \
    yarn cache clean && \
    apk del deps && apk upgrade && \
    rm -rf /tmp/*

RUN chgrp -R 0 /app && chmod -R g=u /app

CMD [ "node", "./bin/cf-openapi" ]
