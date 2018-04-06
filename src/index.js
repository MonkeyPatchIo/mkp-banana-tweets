'use strict'

console.log('Loading function')

// Setup Twitter client
import Twitter from 'twitter'
var twitterClient = new Twitter({
  consumer_key: process.env.TWITTER_CONSUMER_KEY,
  consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
  access_token_key: process.env.TWITTER_ACCESS_TOKEN,
  access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET
})

// Setup AWS clients
import AWS from 'aws-sdk'

/**
 * The handler method is invoked by AWS Lambda when an event is triggered.
 * The following list of actions is executed:
 * - Fetch the list of tweets from Twitter API
 * - Call AWS Comprehend to analyse sentiment of tweet content
 * - Store results in DynamoDB
**/
export const handler = (event, context, callback) => {
  // console.log('Received event:', JSON.stringify(event, null, 2));

  const done = (err, res) => callback(null, {
    statusCode: err ? '400' : '200',
    body: err ? err.message : JSON.stringify(res),
    headers: {'Content-Type': 'application/json'}
  })

  return new FetchTweets().execute('#banana')
    .then((tweets) => {
      return new AnalyseTweets().execute(tweets)
    })
    .then((tweets) => {
      return new SaveTweets().execute(tweets)
    })
    .then(function(data) {
      return callback(done(undefined, data));
    })
    .catch(function(error) {
      return callback(done(error, undefined));
    })
}

export default handler;

/**
 * Fetch Twitter tweets
**/
class FetchTweets {
  constructor() {}

  execute(q) {
    // Fetch tweets
    console.log('Fetching tweets')

    return twitterClient.get('search/tweets', {q: q})
      .then((data) => {
        // console.log('Received tweets Promise: ' + JSON.stringify(data, null, 2));

        // Return the list of tweets
        return data['statuses']
      })
  }
}

/**
 * Analyse tweets with AWS Comprehend
**/
class AnalyseTweets {
  constructor() {
    this.comprehend = new AWS.Comprehend({region: process.env.AWS_REGION_COMPREHEND})
  }

  execute(tweets) {
    // The list of tweets for sentiment analysis
    console.log('Processing ' + tweets.length + ' tweets')

    // Extract the list of tweets text
    var tweetsText = []
    for (var i in tweets) { tweetsText.push(tweets[i]['text']) }

    // Process sentiment analysis on tweets with AWS Comprehend
    var comprehendParams = {LanguageCode: 'en', TextList: tweetsText}
    // console.log('Call comprehend.batchDetectSentiment: ' + JSON.stringify(comprehendParams, null, 2));

    return this.comprehend.batchDetectSentiment(comprehendParams).promise()
      .then((data) => {
        console.log('Processing ' + data['ResultList'].length + ' analysed tweets')

        // Combine sentiment analysis with tweet data
        for (var i in data['ResultList']) {
          var result = data['ResultList'][i]
          var tweet = tweets[i]
          tweet['sentiment'] = result['Sentiment']
          tweet['sentiment_score'] = result['SentimentScore']
        }

        return tweets
      })
  }
}

/**
 * Save analysed tweets in AWS DynamoDB
**/
class SaveTweets {
  constructor() {
    this.dynamodb = new AWS.DynamoDB({region: process.env.AWS_REGION_DYNAMODB})
  }

  execute(tweets) {
    // The list of tweets with sentiment analysis
    console.log('Saving ' + tweets.length + ' tweets')

    // Batch DynamoDB Operation
    var dynamoParams = {RequestItems: {'MKPTweets': []}}
    for (var i in tweets) {
      var tweet = tweets[i]

      // Create put statement
      var operation = {
        PutRequest: {
          Item: {
            id: {S: tweet['id_str']},
            text: {S: tweet['text']},
            timestamp: {N: '' + Date.parse(tweet['created_at'].replace(/( \+)/, ' UTC$1'))}
          }
        }
      }

      // Add sentiment attribute if available
      if(tweet['sentiment']) {
        operation.PutRequest.Item['sentiment'] = {S: tweet['sentiment']}
      }

      // Add to batch operation
      dynamoParams['RequestItems']['MKPTweets'].push(operation)
    }

    // Insert Tweets into DynamoDB
    console.log('Sending request to Dynamo')
    return this.dynamodb.batchWriteItem(dynamoParams).promise()
      .then((data) => {
        // console.log('Received DynamoDB response: ' + JSON.stringify(data, null, 2));
        console.log('Data stored in DynamoDB')

        return data
      })
  }
}

// Expose modules for unit testing
module.exports.FetchTweets = FetchTweets;
module.exports.AnalyseTweets = AnalyseTweets;
module.exports.SaveTweets = SaveTweets;
