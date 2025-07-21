#!/bin/bash

for dir in */; do
  [ -d "$dir" ] || continue
  rm -f "$dir/babel.config.cjs" "$dir/botTeacher.txt" "$dir/sourcePack.txt"
done
