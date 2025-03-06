#!/bin/bash
cp src/live-ifstat/LICENSE.md ./
cp src/live-ifstat/README.md ./
git commit -am "Update README/LICENSE"
git push
git push git@github.com:proggod/darkflows.git main

