#!/bin/sh
set -e
cd "$(dirname "$0")"
if ! command -v npm >/dev/null 2>&1; then
  echo "Install Node.js 24 from https://nodejs.org, then run this file again."
  read -r _answer
  exit 1
fi
if [ ! -d node_modules ]; then npm install --cache .npm-cache --no-audit --no-fund; fi
if [ ! -f .browsers/READY ]; then npm run setup:browser; fi
npm start
