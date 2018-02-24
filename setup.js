/**
 * Configure the required AWS Services:
 * - Create the IAM Role MKPBananaTweetRole with access to Comprehend, DynamoDB and CloudWatch logs
 * - Create the Lamnda Function MKPBananaTweet and assigne it with the role MKPBananaTweetRole
 * - Create the DynamDB table MKPTweets
**/

// Load the AWS SDK for Node.js
var AWS = require('aws-sdk')

function createIAMRole() {
  // Ensure IAM MKPBananaTweetRole exists
  var iam = new AWS.IAM()
  var params = {RoleName: 'MKPBananaTweetRole'}
  iam.getRole(params, function (err, data) {
    if (!err) {
      console.log('IAM Role MKPBananaTweetRole exists')
      createLambdaFunction(data['Role']['Arn'])
    } else {
      console.log('Creating IAM Role MKPBananaTweetRole')
      var fs = require('fs')
      var policyJson = fs.readFileSync('./aws/MKPBananaTweetRolePolicy.json', 'utf8')
      var params = {
        AssumeRolePolicyDocument: policyJson,
        Path: '/',
        RoleName: 'MKPBananaTweetRole'
      }
      iam.createRole(params, function (err, data) {
        if (err) console.log('CreateRole MKPBananaTweetRole error: ' + err, err.stack)
        else {
          var policies = ['ComprehendReadOnly', 'DynamoDBAccess', 'CloudWatchLogAccess']
          for (var i in policies) {
            var policy = policies[i]
            var params = {
              PolicyDocument: fs.readFileSync('./aws/' + policy + '.json', 'utf8'),
              PolicyName: policy,
              RoleName: 'MKPBananaTweetRole'
            }
            iam.putRolePolicy(params, function (err, data) {
              if (err) console.log('PutRolePolicy error: ' + policy + ' => ' + err, err.stack)
            })
          }

          createLambdaFunction(data['Role']['Arn'])
        }
      })
    }
  })
}

function createLambdaFunction(roleArn) {
  // Create Lambda Function
  var lambda = new AWS.Lambda({region: process.env.AWS_REGION_DYNAMODB})
  var paramsLambda = {FunctionName: 'MKPBananaTweet'}
  lambda.getFunction(paramsLambda, function (err, data) {
    if (err) {
      console.log('Creating Lambda Function MKPBananaTweet')
      var fs = require('fs')
      var zipFile = fs.readFileSync('mkp-banana-tweet-lambda.zip')
      var paramsLambda = {
        Code: {ZipFile: zipFile},
        Description: 'MonkeyPatch Lambda Function example',
        FunctionName: 'MKPBananaTweet',
        Handler: 'index.handler',
        MemorySize: 128,
        Publish: true,
        Role: roleArn,
        Runtime: 'nodejs6.10',
        Timeout: 15,
        VpcConfig: {}
      }
      lambda.createFunction(paramsLambda, function (err, data) {
        if (err) {
          console.log('Cannot create Lambda Function: ' + err)
        }
        else {
          console.log('Lambda Function MKPBananaTweet created')
          createTrigger(data['FunctionArn'])
        }
      })
    } else {
      console.log('Lambda Function MKPBananaTweet already exists')
      createTrigger(data['Configuration']['FunctionArn'])
    }
  })
}

function createDynamoDBTable() {
  // Ensure DynamoDB MKPTweets table exists
  var dynamodb = new AWS.DynamoDB({region: process.env.AWS_REGION_DYNAMODB})
  dynamodb.listTables({}, function (err, data) {
    if (err) console.log(err, err.stack)
    else {
      // Find table MKPTweets
      var tableExists = (data['TableNames'].indexOf('MKPTweets') > -1)
      if (!tableExists) {
        console.log('Creating DynamoDB Table MKPTweets')
        var params = {
          AttributeDefinitions: [
            {AttributeName: 'id', AttributeType: 'S'}
          ],
          KeySchema: [
            {AttributeName: 'id', KeyType: 'HASH'}
          ],
          ProvisionedThroughput: {ReadCapacityUnits: 1, WriteCapacityUnits: 1},
          TableName: 'MKPTweets'
        }
        dynamodb.createTable(params, function (err, data) {
          if (err) {
            console.log('Cannot create DynamoDB Table: ' + err)
          }
          else {
            console.log('DynamoDB Table MKPTweets created')
          }
        })
      } else {
        console.log('DynamoDB Table MKPTweets already exists')
      }
    }
  })
}

function createTrigger(lambdaArn) {
  console.log('Creating Lambda Trigger')
  var cloudwatchevents = new AWS.CloudWatchEvents({region: process.env.AWS_REGION_DYNAMODB})
  var params = {
    Name: 'Every20Minutes',
    Description: 'Cron expression event every 20 minutes',
    ScheduleExpression: 'rate(20 minutes)',
    State: 'DISABLED'
  }
  cloudwatchevents.putRule(params, function(err, data) {
    if (err) console.log(err, err.stack);
    else {
      var paramsTarget = {
        Rule: 'Every20Minutes',
        Targets: [{Arn: lambdaArn, Id: '1'}]
      }

      cloudwatchevents.putTargets(paramsTarget, function(err, data) {
        if (err) console.log(err, err.stack);
        else     console.log('Lambda Trigger Created')
      });
    }
  })
}

createIAMRole()
createDynamoDBTable()
