#!/bin/bash

# Install npm dependencies
npm install

# Zip current work directory
zip -r mkp-banana-tweet-lambda.zip . -x __tests__/ -x aws -x coverage -x *.zip -x *.png
