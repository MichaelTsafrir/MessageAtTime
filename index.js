const express = require('express');
const bodyParser = require('body-parser');
const redis = require('redis');
const fetchConfig = require('zero-config');

const config = fetchConfig(__dirname, {});

const port = config.get("port") || 5040;
const redisHost = config.get("redis.host") || "localhost";
const redisPort = config.get("redis.port") || 6379;
const messageList = config.get("redis.messageList") || "messageList";
const messageKey = config.get("redis.messageKey") || "messageKey";

const app = express();
const client = redis.createClient(redisPort);

// Send an error response
const responseError = (response, message) => response.send(JSON.stringify({ status: 'error', message }));

// Get the earliest message that exists
const fetchMessage = () => client.zrange(messageList, 0, 0, 'withscores', (err, messageSet) => {
    if (err) {
        return console.error(`Redis: error when fetching first element from "${messageList}". Error: ${err}`);
    }
    else if (!messageSet.length) {
        // No message fetched
        return;
    }
    else {
        // Fetched message
        const messageID = messageSet[0];
        const messageTime = parseInt(messageSet[1]);
        const now = Date.now() / 1000; // Get epoch time in seconds

        if (messageTime <= now) {
            client.get(messageID, (err, message) => {
                if (err) {
                    return console.error(`Redis: error when fetching "${messageID}". Error: ${err}`);
                }
                else {
                    console.log(message);

                    // Delete message
                    client.zrem(messageList, messageID, (err, wasRemoved) => {
                        if (err || !wasRemoved) {
                            console.error(`Redis: Couldn't delete "${messageID}" from "${messageList}". Error: ${err}`);
                        }
                        else {
                            client.del(messageID, (err, wasRemoved) => {
                                if (err || !wasRemoved) {
                                    console.error(`Redis: Couldn't delete "${messageID}". Error: ${err}`);
                                }
                            });
                        }
                    });

                    // Check next message
                    return fetchMessage();
                }
            });
        }
    }
});

// Run from the earliest message that exists
fetchMessage();

// Use bodyParser Middleware to fetch body params
app.use(bodyParser.urlencoded({ extended: false }));

app.post('/addMessage', (req, res) => {
    const message = req.body.message;
    const time = req.body.time;

    if (!message || !time) {
        responseError(res, 'missing message or time params in request');
    }
    else if (isNaN(time)) {
        responseError(res, 'time param is not in epoch time, expected number');
    }
    else {
        // Get the current last key (will be created if doesn't exists)
        client.incr(messageKey, (err, num) => {
            if (err) {
                responseError(res, `Redis: couldn't increment ${messageKey}. Error: ${err}`);
            }
            else {
                const messageID = `message:${num}`;

                // Add to a sorted list by the time our message
                client.ZADD(messageList, time, messageID, (err, redisResponse) => {
                    if (err) {
                        responseError(res, `Redis: couldn't add to sorted list "${messageList}". Error: ${err}`);
                    }
                    else if (!redisResponse){
                        // Note: this error can't happen from cross servers, only by changing the redis manually
                        responseError(res, `Redis: couldn't add to sorted list "${messageList}". Duplicate ${messageID}`);
                    }
                    else {
                        // Message was added to sorted list, save message
                        client.set(messageID, message);

                        res.send(JSON.stringify({ status: 'ok', messageID }));
                    }
                });

            }
        });
    }
});

app.listen(port, () => console.log(`Listening on port ${port}`));
