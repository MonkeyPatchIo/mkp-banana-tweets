'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.handler = undefined;

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _twitter = require('twitter');

var _twitter2 = _interopRequireDefault(_twitter);

var _awsSdk = require('aws-sdk');

var _awsSdk2 = _interopRequireDefault(_awsSdk);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

console.log('Loading function');

// Setup Twitter client

var twitterClient = new _twitter2.default({
  consumer_key: process.env.TWITTER_CONSUMER_KEY,
  consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
  access_token_key: process.env.TWITTER_ACCESS_TOKEN,
  access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET
});

// Setup AWS clients


/**
 * The handler method is invoked by AWS Lambda when an event is triggered.
 * The following list of actions is executed:
 * - Fetch the list of tweets from Twitter API
 * - Call AWS Comprehend to analyse sentiment of tweet content
 * - Store results in DynamoDB
**/
var handler = exports.handler = function handler(event, context, callback) {
  // console.log('Received event:', JSON.stringify(event, null, 2));

  var done = function done(err, res) {
    return callback(null, {
      statusCode: err ? '400' : '200',
      body: err ? err.message : JSON.stringify(res),
      headers: { 'Content-Type': 'application/json' }
    });
  };

  return new FetchTweets().execute('#banana').then(function (tweets) {
    return new AnalyseTweets().execute(tweets);
  }).then(function (tweets) {
    return new SaveTweets().execute(tweets);
  }).then(function (data) {
    return callback(done(undefined, data));
  }).catch(function (error) {
    return callback(done(error, undefined));
  });
};

exports.default = handler;

/**
 * Fetch Twitter tweets
**/

var FetchTweets = function () {
  function FetchTweets() {
    _classCallCheck(this, FetchTweets);
  }

  _createClass(FetchTweets, [{
    key: 'execute',
    value: function execute(q) {
      // Fetch tweets
      console.log('Fetching tweets');

      return twitterClient.get('search/tweets', { q: q }).then(function (data) {
        // console.log('Received tweets Promise: ' + JSON.stringify(data, null, 2));

        // Return the list of tweets
        return data['statuses'];
      });
    }
  }]);

  return FetchTweets;
}();

/**
 * Analyse tweets with AWS Comprehend
**/


var AnalyseTweets = function () {
  function AnalyseTweets() {
    _classCallCheck(this, AnalyseTweets);

    this.comprehend = new _awsSdk2.default.Comprehend({ region: process.env.AWS_REGION_COMPREHEND });
  }

  _createClass(AnalyseTweets, [{
    key: 'execute',
    value: function execute(tweets) {
      // The list of tweets for sentiment analysis
      console.log('Processing ' + tweets.length + ' tweets');

      // Extract the list of tweets text
      var tweetsText = [];
      for (var i in tweets) {
        tweetsText.push(tweets[i]['text']);
      }

      // Process sentiment analysis on tweets with AWS Comprehend
      var comprehendParams = { LanguageCode: 'en', TextList: tweetsText
        // console.log('Call comprehend.batchDetectSentiment: ' + JSON.stringify(comprehendParams, null, 2));

      };return this.comprehend.batchDetectSentiment(comprehendParams).promise().then(function (data) {
        console.log('Processing ' + data['ResultList'].length + ' analysed tweets');

        // Combine sentiment analysis with tweet data
        for (var i in data['ResultList']) {
          var result = data['ResultList'][i];
          var tweet = tweets[i];
          tweet['sentiment'] = result['Sentiment'];
          tweet['sentiment_score'] = result['SentimentScore'];
        }

        return tweets;
      });
    }
  }]);

  return AnalyseTweets;
}();

/**
 * Save analysed tweets in AWS DynamoDB
**/


var SaveTweets = function () {
  function SaveTweets() {
    _classCallCheck(this, SaveTweets);

    this.dynamodb = new _awsSdk2.default.DynamoDB({ region: process.env.AWS_REGION_DYNAMODB });
  }

  _createClass(SaveTweets, [{
    key: 'execute',
    value: function execute(tweets) {
      // The list of tweets with sentiment analysis
      console.log('Saving ' + tweets.length + ' tweets');

      // Batch DynamoDB Operation
      var dynamoParams = { RequestItems: { 'MKPTweets': [] } };
      for (var i in tweets) {
        var tweet = tweets[i];

        // Create put statement
        var operation = {
          PutRequest: {
            Item: {
              id: { S: tweet['id_str'] },
              text: { S: tweet['text'] },
              timestamp: { N: '' + Date.parse(tweet['created_at'].replace(/( \+)/, ' UTC$1')) }
            }
          }

          // Add sentiment attribute if available
        };if (tweet['sentiment']) {
          operation.PutRequest.Item['sentiment'] = { S: tweet['sentiment'] };
        }

        // Add to batch operation
        dynamoParams['RequestItems']['MKPTweets'].push(operation);
      }

      // Insert Tweets into DynamoDB
      console.log('Sending request to Dynamo');
      return this.dynamodb.batchWriteItem(dynamoParams).promise().then(function (data) {
        // console.log('Received DynamoDB response: ' + JSON.stringify(data, null, 2));
        console.log('Data stored in DynamoDB');

        return data;
      });
    }
  }]);

  return SaveTweets;
}();

// Expose modules for unit testing


module.exports.FetchTweets = FetchTweets;
module.exports.AnalyseTweets = AnalyseTweets;
module.exports.SaveTweets = SaveTweets;