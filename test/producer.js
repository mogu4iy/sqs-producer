const Producer = require('../lib/producer');
const sinon = require('sinon');
const assert = require('assert');

const AWS = require('aws-sdk');
let sqs = new AWS.SQS();

describe('Producer', function () {
  const queueUrl = 'https://dummy-queue';
  let producer;

  beforeEach(function () {
    sinon.stub(sqs, 'sendMessageBatch').returns({
      promise: () => (Promise.resolve({
        Failed: []
      }))
    });

    producer = new Producer({
      queueUrl,
      sqs
    });
  });

  afterEach(function () {
    sqs.sendMessageBatch.restore();
  });

  it('sends string messages as a batch', async () => {
    const expectedParams = {
      Entries: [
        {
          Id: 'message1',
          MessageBody: 'message1'
        },
        {
          Id: 'message2',
          MessageBody: 'message2'
        }
      ],
      QueueUrl: queueUrl
    };

    await producer.send(['message1', 'message2']);
    sinon.assert.calledOnce(sqs.sendMessageBatch);
    sinon.assert.calledWith(sqs.sendMessageBatch, expectedParams);
  });

  it('accepts a single message instead of an array', async () => {
    const expectedParams = {
      Entries: [
        {
          Id: 'message1',
          MessageBody: 'message1'
        }
      ],
      QueueUrl: queueUrl
    };

    await producer.send('message1');
    sinon.assert.calledOnce(sqs.sendMessageBatch);
    sinon.assert.calledWith(sqs.sendMessageBatch, expectedParams);
  });

  it('sends object messages as a batch', async () => {
    const expectedParams = {
      Entries: [
        {
          Id: 'id1',
          MessageBody: 'body1'
        },
        {
          Id: 'id2',
          MessageBody: 'body2'
        }
      ],
      QueueUrl: queueUrl
    };

    const message1 = {
      id: 'id1',
      body: 'body1'
    };
    const message2 = {
      id: 'id2',
      body: 'body2'
    };

    await producer.send([message1, message2]);
    sinon.assert.calledOnce(sqs.sendMessageBatch);
    sinon.assert.calledWith(sqs.sendMessageBatch, expectedParams);
  });

  it('sends object messages with attributes as a batch', async () => {
    const expectedParams = {
      Entries: [
        {
          Id: 'id1',
          MessageBody: 'body1',
          MessageAttributes: {
            attr1: {
              DataType: 'String',
              StringValue: 'value1'
            }
          }
        },
        {
          Id: 'id2',
          MessageBody: 'body2'
        }
      ],
      QueueUrl: queueUrl
    };

    const message1 = {
      id: 'id1',
      body: 'body1',
      messageAttributes: {
        attr1: {
          DataType: 'String',
          StringValue: 'value1'
        }
      }
    };
    const message2 = {
      id: 'id2',
      body: 'body2'
    };

    await producer.send([message1, message2]);
    sinon.assert.calledOnce(sqs.sendMessageBatch);
    sinon.assert.calledWith(sqs.sendMessageBatch, expectedParams);
  });

  it('sends object messages with FIFO params as a batch', async () => {
    const expectedParams = {
      Entries: [
        {
          Id: 'id1',
          MessageBody: 'body1',
          DelaySeconds: 2,
          MessageGroupId: 'group1'
        },
        {
          Id: 'id2',
          MessageBody: 'body2',
          DelaySeconds: 3,
          MessageGroupId: 'group2'
        }
      ],
      QueueUrl: queueUrl
    };

    const message1 = {
      id: 'id1',
      body: 'body1',
      delaySeconds: 2,
      groupId: 'group1'
    };
    const message2 = {
      id: 'id2',
      body: 'body2',
      delaySeconds: 3,
      groupId: 'group2'
    };

    await producer.send([message1, message2]);
    sinon.assert.calledOnce(sqs.sendMessageBatch);
    sinon.assert.calledWith(sqs.sendMessageBatch, expectedParams);
  });

  it('sends both string and object messages as a batch', async () => {
    const expectedParams = {
      Entries: [
        {
          Id: 'message1',
          MessageBody: 'message1'
        },
        {
          Id: 'id2',
          MessageBody: 'body2'
        }
      ],
      QueueUrl: queueUrl
    };

    const message2 = {
      id: 'id2',
      body: 'body2'
    };

    await producer.send(['message1', message2]);
    sinon.assert.calledOnce(sqs.sendMessageBatch);
    sinon.assert.calledWith(sqs.sendMessageBatch, expectedParams);
  });

  it('makes multiple batch requests when the number of messages is larger than 10', async () => {
    await producer.send(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11']);
    sinon.assert.calledTwice(sqs.sendMessageBatch);
  });

  it('returns an error when SQS fails', async () => {
    const sqsError = new Error('sqs failed');

    sqs.sendMessageBatch.restore();
    sinon.stub(sqs, 'sendMessageBatch').returns({
      promise: () => (Promise.reject(sqsError))
    });

    try {
      await producer.send(['foo']);
      assert.fail("should have thrown");
    } catch (err) {
      assert.equal(err, sqsError);
    }
  });

  it('returns an error when messages are neither strings nor objects', async () => {
    const errMessage = 'A message can either be an object or a string';

    const message1 = {
      id: 'id1',
      body: 'body1'
    };
    const message2 = function () {};

    try {
      await producer.send(['foo', message1, message2]);
      assert.fail("should have thrown");
    } catch (err) {
      assert.equal(err.message, errMessage);
    }
  });

  it('returns an error when object messages have invalid delaySeconds params 1', async () => {
    const errMessage = 'Message.delaySeconds value must be a number contained within [0 - 900]';

    const message1 = {
      id: 'id1',
      body: 'body1',
      delaySeconds: 'typo'
    };
    const message2 = {
      id: 'id2',
      body: 'body2'
    };

    try {
      await producer.send(['foo', message1, message2]);
      assert.fail("should have thrown");
    } catch (err) {
      assert.equal(err.message, errMessage);
    }
  });

  it('returns an error when object messages have invalid delaySeconds params 2', async () => {
    const errMessage = 'Message.delaySeconds value must be a number contained within [0 - 900]';

    const message1 = {
      id: 'id1',
      body: 'body1',
      delaySeconds: 12345678
    };
    const message2 = {
      id: 'id2',
      body: 'body2'
    };

    try {
      await producer.send(['foo', message1, message2]);
      assert.fail("should have thrown");
    } catch (err) {
      assert.equal(err.message, errMessage);
    }
  });

  it('returns an error when object messages attributes don\'t have a DataType param', async () => {
    const errMessage = 'A MessageAttribute must have a DataType key';

    const message1 = {
      id: 'id1',
      body: 'body1',
      messageAttributes: {
        attr1: {
          StringValue: 'value1'
        }
      }
    };
    const message2 = {
      id: 'id2',
      body: 'body2'
    };

    try {
      await producer.send(['foo', message1, message2]);
      assert.fail("should have thrown");
    } catch (err) {
      assert.equal(err.message, errMessage);
    }
  });

  it('returns an error when object messages attributes have an invalid DataType param', async () => {
    const errMessage = 'The DataType key of a MessageAttribute must be a String';

    const message1 = {
      id: 'id1',
      body: 'body1',
      messageAttributes: {
        attr1: {
          DataType: ['wrong'],
          StringValue: 'value1'
        }
      }
    };
    const message2 = {
      id: 'id2',
      body: 'body2'
    };

    try {
      await producer.send(['foo', message1, message2]);
      assert.fail("should have thrown");
    } catch (err) {
      assert.equal(err.message, errMessage);
    }
  });

  it('returns an error when object messages have invalid id param', async () => {
    const errMessage = 'Message.id value must be a string';

    const message1 = {
      id: 1234,
      body: 'body1'
    };

    try {
      await producer.send(message1);
      assert.fail("should have thrown");
    } catch (err) {
      assert.equal(err.message, errMessage);
    }
  });

  it('returns an error when object messages have invalid groupId param', async () => {
    const errMessage = 'Message.groupId value must be a string';

    const message1 = {
      id: 'id1',
      body: 'body1',
      groupId: 1234
    };

    try {
      await producer.send(message1);
      assert.fail("should have thrown");
    } catch (err) {
      assert.equal(err.message, errMessage);
    }
  });

  it('returns an error when object messages have invalid deduplicationId param', async () => {
    const errMessage = 'Message.deduplicationId value must be a string';

    const message1 = {
      id: 'id1',
      body: 'body1',
      groupId: '1234',
      deduplicationId: 1234
    };

    try {
      await producer.send(message1);
      assert.fail("should have thrown");
    } catch (err) {
      assert.equal(err.message, errMessage);
    }
  });

  it('returns an error when fifo messages have no groupId param', async () => {
    const errMessage = 'FIFO Queue messages must have \'groupId\' prop';

    const message1 = {
      id: 'id1',
      body: 'body1',
      deduplicationId: '1234'
    };

    try {
      await producer.send(message1);
      assert.fail("should have thrown");
    } catch (err) {
      assert.equal(err.message, errMessage);
    }
  });

  it('returns an error when object messages are not of shape {id, body}', async () => {
    const errMessage = 'Object messages must have \'id\' prop';

    const message1 = {
      noId: 'noId1',
      body: 'body1'
    };
    const message2 = {
      id: 'id2',
      body: 'body2'
    };

    try {
      await producer.send(['foo', message1, message2]);
      assert.fail("should have thrown");
    } catch (err) {
      assert.equal(err.message, errMessage);
    }
  });

  it('returns an error when object messages are not of shape {id, body} 2', async () => {
    const errMessage = 'Object messages must have \'body\' prop';

    const message1 = {
      id: 'id1',
      noBody: 'noBody1'
    };
    const message2 = {
      id: 'id2',
      body: 'body2'
    };

    try {
      await producer.send(['foo', message1, message2]);
      assert.fail("should have thrown");
    } catch (err) {
      assert.equal(err.message, errMessage);
    }
  });

  it('returns an error identifting the messages that failed', async () => {
    const errMessage = 'Failed to send messages: message1, message2, message3';
    sqs.sendMessageBatch.restore();

    const failedMessages = [{
      Id: 'message1'
    }, {
      Id: 'message2'
    }, {
      Id: 'message3'
    }];
    sinon.stub(sqs, 'sendMessageBatch').returns({
      promise: () => (Promise.resolve({
        Failed: failedMessages
      }))
    });

    try {
      await producer.send(['message1', 'message2', 'message3']);
      assert.fail("should have thrown");
    } catch (err) {
      assert.equal(err.message, errMessage);
    }
  });

  it('returns the approximate size of the queue', async () => {
    const expected = '10';
    sinon.stub(sqs, 'getQueueAttributes').withArgs({
      QueueUrl: queueUrl,
      AttributeNames: ['ApproximateNumberOfMessages']
    }).returns({
      promise: () => (Promise.resolve({
        Attributes: {
          ApproximateNumberOfMessages: expected
        }
      }))
    });

    const size = await producer.queueSize(['message1', 'message2', 'message3']);
    sqs.getQueueAttributes.restore();
    assert.strictEqual(size, Number(expected));
  });

  describe('.create', function () {
    it('creates a new instance of a Producer', function () {
      const producer = Producer.create({
        queueUrl,
        sqs
      });
      assert(producer instanceof Producer);
    });
  });
});