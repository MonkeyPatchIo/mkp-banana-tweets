#!/bin/bash

# Zip current work directory
zip -r mkp-banana-tweet-lambda.zip . -x test/ -x *.zip -x *.png
