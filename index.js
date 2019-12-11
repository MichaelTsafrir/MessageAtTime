const express = require('express');
const bodyParser = require('body-parser');
const ioredis = require('ioredis');
const fetchConfig = require('zero-config');

const config = fetchConfig(__dirname, {});

const port = config.get("port") || 5040;
const redisHost = config.get("redis.host") || "localhost";
const redisPort = config.get("redis.port") || 6379;
const messageList = config.get("redis.messageList") || "messageList";
const messageKey = config.get("redis.messageKey") || "messageKey";

const app = express();
const client = new ioredis(redisPort, redisHost);

// Send an error response
const responseError = (response, message) => response.send(JSON.stringify({ status: 'error', message }));

// Get the earliest message that exists
const fetchMessage = async () => {
    try {
        const messageSet = await client.zrange(messageList, 0, 0, 'withscores');

        if (!messageSet.length) {
            // No message fetched
            return;
        }
        else {
            // Fetched message
            const messageID = messageSet[0];
            const messageTime = parseInt(messageSet[1]);
            const now = Date.now() / 1000; // Get epoch time in seconds

            if (messageTime <= now) {
                try {
                    const message = await client.get(messageID);

                    console.log(message);

                    try {
                        // Delete message
                        const wasRemoved = await client.zrem(messageList, messageID);

                        if (!wasRemoved) {
                            throw "Redis failed zrem operaion";
                        }

                        try {
                            const wasRemoved = await client.del(messageID);

                            if (!wasRemoved) {
                                throw "Redis failed del operaion";
                            }
                        }
                        catch(e) {
                            console.error(`Redis: Couldn't delete "${messageID}". Error: ${err}`);
                        }

                        // Check next message
                        return fetchMessage();
                    }
                    catch(e) {
                        return console.error(`Redis: Couldn't delete "${messageID}" from "${messageList}". Error: ${e}`);
                    }
                }
                catch(e) {
                    return console.error(`Redis: error when fetching "${messageID}". Error: ${err}`);
                }
            }
        }
    }
    catch(e) {
        return console.error(`Redis: error when fetching first element from "${messageList}". Error: ${e}`);
    }
};

// Run from the earliest message that exists
fetchMessage();

// Use bodyParser Middleware to fetch body params
app.use(bodyParser.urlencoded({ extended: false }));

app.post('/addMessage', async (req, res) => {
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
        try {
            const num = await client.incr(messageKey);
            const messageID = `message:${num}`;

            try {
                // Add to a sorted list by the time our message
                const redisResponse = await client.zadd(messageList, time, messageID);

                if (!redisResponse) {
                    throw "Redis failed excecuting zadd";
                }

                try {
                    // Message was added to sorted list, save message
                    await client.set(messageID, message);
                    res.send(JSON.stringify({ status: 'ok', messageID }));
                }
                catch(e) {
                    responseError(res, `Redis: couldn't add set "${messageList}". Error: ${e}`);
                }
            }
            catch(e) {
                responseError(res, `Redis: couldn't add to sorted list "${messageList}". Error: ${e}`);
            }
        }
        catch(e) {
            responseError(res, `Redis: couldn't increment ${messageKey}. Error: ${err}`);
        }
    }
});

app.listen(port, () => console.log(`Listening on port ${port}`));
