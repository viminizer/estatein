#!/bin/bash

# Production
#
git reset --hard
git checkout master
git pull origin master

# docker compose up -d --no-deps --build
docker compose stop
docker compose rm -f
docker compose up -d
