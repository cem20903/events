#!/usr/bin/env bash
set -e

cd "$(dirname "$0")"

echo "Installing server dependencies..."
(cd server && npm install)

echo "Installing client dependencies..."
(cd client && npm install)

cleanup() {
  echo "Stopping servers..."
  kill 0
}
trap cleanup EXIT INT TERM

(cd server && npm run dev) &
(cd client && npm run dev) &

wait
