#!/usr/bin/env sh
cd "$(dirname "$0")"
printf "Open http://127.0.0.1:8787/\n"
python3 -m http.server 8787
