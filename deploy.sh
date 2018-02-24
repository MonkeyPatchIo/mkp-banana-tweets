#!/bin/bash

# Zip current work directory
./create_zip.sh

# Upload with AWS CLI
aws lambda update-function-code --function-name MKPBananaTweet --zip-file fileb://mkp-banana-tweet-lambda.zip
