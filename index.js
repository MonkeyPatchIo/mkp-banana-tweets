'use strict'

console.log('Loading function')

// Setup Twitter client
var Twitter = require('twitter')
var twitterClient = new Twitter({
  consumer_key: process.env.TWITTER_CONSUMER_KEY,
  consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
  access_token_key: process.env.TWITTER_ACCESS_TOKEN,
  access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET
})

// Setup AWS clients
var AWS = require('aws-sdk')
var comprehend = new AWS.Comprehend({region: process.env.AWS_REGION_COMPREHEND})
var dynamodb = new AWS.DynamoDB({region: process.env.AWS_REGION_DYNAMODB})

/**
 * The handler method is invoked by AWS Lambda when an event is triggered.
 * The following list of actions is executed:
 * - Fetch the list of tweets from Twitter API
 * - Call AWS Comprehend to analyse sentiment of tweet content
 * - Store results in DynamoDB
**/
exports.handler = (event, context, callback) => {
  // console.log('Received event:', JSON.stringify(event, null, 2));

  const done = (err, res) => callback(null, {
    statusCode: err ? '400' : '200',
    body: err ? err.message : JSON.stringify(res),
    headers: {'Content-Type': 'application/json'}
  })

  // Fetch tweets
  console.log('Fetch twitter tweets!')
  twitterClient.get('search/tweets', {q: '#banana'}, function (err, data, response) {
    if (err) callback(done(err, data))
    else {
      // console.log('Received tweets: ' + JSON.stringify(data, null, 2));

      // The list of tweets for sentiment analysis
      var tweets = data['statuses']
      console.log('Processing ' + tweets.length + ' tweets')

      // Extract the list of tweets text
      var tweetsText = []
      for (var i in tweets) { tweetsText.push(tweets[i]['text']) }

      // Process sentiment analysis on tweets with AWS Comprehend
      var comprehendParams = {LanguageCode: 'en', TextList: tweetsText}
      comprehend.batchDetectSentiment(comprehendParams, function (err, data) {
        if (err) callback(done(err, data))
        else {
          console.log('Processing ' + data['ResultList'].length + ' analysed tweets')

          // Combine sentiment analysis with tweet data
          for (var i in data['ResultList']) {
            var result = data['ResultList'][i]
            var tweet = tweets[i]
            tweet['sentiment'] = result['Sentiment']
            tweet['sentiment_score'] = result['SentimentScore']
          }

          // Batch DynamoDB Operation
          var dynamoParams = {RequestItems: {'MKPTweets': []}}
          for (i in tweets) {
            tweet = tweets[i]

            var operation = {
              PutRequest: {
                Item: {
                  id: {S: tweet['id_str']},
                  text: {S: tweet['text']},
                  timestamp: {N: '' + Date.parse(tweet['created_at'].replace(/( \+)/, ' UTC$1'))},
                  sentiment: {S: tweet['sentiment']}
                }
              }
            }
            dynamoParams['RequestItems']['MKPTweets'].push(operation)
          }

          // Insert Tweets into DynamoDB
          console.log('Sending request to Dynamo')
          dynamodb.batchWriteItem(dynamoParams, function (err, data) {
            if (err) callback(done(err, data))
            else {
              // console.log('Received DynamoDB response: ' + JSON.stringify(data, null, 2));
              console.log('Data stored in DynamoDB')
              callback(done(err, data))
            }
          })
        }
      })
    }
  })
}
