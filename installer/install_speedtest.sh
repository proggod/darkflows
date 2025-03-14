#!/bin/bash
cd /tmp
git clone git@github.com:proggod/SpeedTest.git
cd SpeedTest
DEBIAN_FRONTEND=noninteractive apt-get install -y build-essential libcurl4-openssl-dev libxml2-dev libssl-dev cmake
cmake -DCMAKE_BUILD_TYPE=Release .
make install


