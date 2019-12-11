const express = require('express');
const bodyParser = require('body-parser');
const ioredis = require('ioredis');
const fetchConfig = require('zero-config');
const redisLock = require('redis-lock');
const { promisify } = require('util'); 
const dayjs = require('dayjs');

const config = fetchConfig(__dirname, {});

const port = config.get("port") || 5040;
const redisHost = config.get("redis.host") || "localhost";
const redisPort = config.get("redis.port") || 6379;
const messageList = config.get("redis.messageList") || "messageList";
const messageKey = config.get("redis.messageKey") || "messageKey";

const app = express();
const client = new ioredis(redisPort, redisHost);
const clientListener = new ioredis(redisPort, redisHost);
const lock = promisify(redisLock(client));

let nextMessage;

// Send an error response
const responseError = (response, message) => response.send(JSON.stringify({ status: 'error', message }));

// Get the earliest message that exists
const fetchMessage = async (isRecursive = false) => {
    try {
        // Take the first (earliest) message
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
                // Lock list to prevent other servers modifying
                const unlock = await lock(messageList);

                try {
                    // Fetch message by ID
                    const message = await client.get(messageID);

                    console.log('--------------------- New Message ---------------------');
                    console.log(`(${dayjs(messageTime * 1000).format('DD/MM/YY HH:mm:ss')}): ${message}`);
                    console.log('-------------------------------------------------------');

                    try {
                        // Delete message
                        const redisResponse = await client.
                            multi()
                            .zrem(messageList, messageID)
                            .del(messageID)
                            .exec();

                        if (!redisResponse[0][1] || !redisResponse[1][1]) {
                            throw "Redis failed excecuting zrem & del multi tasks";
                        }

                        if (isRecursive) {
                            return fetchMessage();
                        }
                    }
                    catch(e) {
                        return console.error(`Redis: Couldn't delete "${messageID}"". Error: ${e}`);
                    }
                }
                catch(e) {
                    return console.error(`Redis: error when fetching "${messageID}". Error: ${e}`);
                }
                finally {
                    unlock();
                }
            }
            else if (!nextMessage || messageTime < nextMessage){
                // Save the message as next message
                nextMessage = messageTime;
    
                // Fetch message on that time
                setTimeout(() => {
                    fetchMessage();
                }, (messageTime * 1000) - Date.now());
            }
        }
    }
    catch(e) {
        return console.error(`Redis: error when fetching first element from "${messageList}". Error: ${e}`);
    }
};

// Subscribe to ZADD event
clientListener.subscribe(`__keyspace@0__:${messageList}`).then(() => console.log(`Subscribed to "${messageList}" events`));

clientListener.on("message",  async (channel, message) => {
    if (message == "zadd") {
        fetchMessage();
    }
});

// Run from the earliest message that exists recursivly
fetchMessage(true);

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
                const redisResponse = await client
                    .multi()
                    .zadd(messageList, time, messageID)
                    .set(messageID, message)
                    .exec();

                if (!redisResponse[0][1] || !redisResponse[1][1]) {
                    throw "Redis failed excecuting zadd & set multi tasks";
                }

                res.send(JSON.stringify({ status: 'ok', messageID }));
            }
            catch(e) {
                responseError(res, `Redis: couldn't add to sorted list "${messageList}". Error: ${e}`);
            }
        }
        catch(e) {
            responseError(res, `Redis: couldn't increment ${messageKey}. Error: ${e}`);
        }
    }
});

app.listen(port, () => console.log(`Listening on port ${port}`));
