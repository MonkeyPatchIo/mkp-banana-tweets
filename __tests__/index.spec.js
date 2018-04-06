import AWS from 'aws-sdk-mock';
import Twitter from 'twitter';
import { promisify } from 'bluebird';
import lambda from '../lib/index';
import nock from 'nock';

import searchTweetsStub from './stubs/tweets_example.json';
import batchDetectSentiment from './stubs/Comprehend_batchDetectSentiment.json';
import batchWriteItem from './stubs/DynamoDB_batchWriteItem.json';

const handler = promisify(lambda);

const FetchTweets = require('../lib/index').FetchTweets;
const AnalyseTweets = require('../lib/index').AnalyseTweets;
const SaveTweets = require('../lib/index').SaveTweets;

describe('Lambda mkp-banana-tweets', () => {
  describe('FetchTweets', () => {
    beforeAll(() => {
      // Mock Twitter Client
      nock('https://api.twitter.com')
        .get('/1.1/search/tweets.json?q=%23banana')
        .reply(200, searchTweetsStub);
    });

    test('fetches tweets', () => {
      const result = new FetchTweets().execute('#banana');
      return result.then(data => {
        expect(data).toHaveLength(15);
      });
    });
  });

  describe('AnalyseTweets', () => {
    beforeAll(() => {
      // Mock AWS Comprehend
      AWS.mock('Comprehend', 'batchDetectSentiment', function (params, callback) {
        callback(null, batchDetectSentiment);
      });
    });

    afterAll(() => {
      AWS.restore('Comprehend');
    });

    test('analyses tweets', () => {
      const result = new AnalyseTweets().execute(searchTweetsStub.statuses);
      return result.then(data => {
        expect(data).toHaveLength(15);
        expect(data[0].sentiment).toEqual('MIXED');
      });
    });
  });

  describe('SaveTweets', () => {
    beforeAll(() => {
      // Mock AWS DynamoDB
      AWS.mock('DynamoDB', 'batchWriteItem', function (params, callback) {
        callback(null, batchWriteItem);
      });
    });

    afterAll(() => {
      AWS.restore('DynamoDB');
    });

    test('saves tweets', () => {
      const result = new SaveTweets().execute(searchTweetsStub.statuses);
      return result.then(data => {
        expect(data).toBeTruthy();
      });
    });
  });

  describe('handler', () => {
    beforeAll(() => {
      // Mock Twitter Client
      nock('https://api.twitter.com')
        .get('/1.1/search/tweets.json?q=%23banana')
        .reply(200, searchTweetsStub);

      // Mock AWS Comprehend
      AWS.mock('Comprehend', 'batchDetectSentiment', function (params, callback) {
        callback(null, batchDetectSentiment);
      });

      // Mock AWS DynamoDB
      AWS.mock('DynamoDB', 'batchWriteItem', function (params, callback) {
        callback(null, batchWriteItem);
      });
    });

    afterAll(() => {
      AWS.restore('Comprehend');
      AWS.restore('DynamoDB');
    });

    test('Replies back with a JSON for a twitter import success', () => {
      const event = {};
      const context = {};
      const awsCallback = (fn, data) => {};

      const result = handler(event, context, awsCallback);

      expect(result).resolves.toMatchSnapshot();
    });
  });
});
