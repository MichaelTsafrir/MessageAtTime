const express = require('express');
const bodyParser = require('body-parser');
const redis = require('redis');

const port = 5040;
const redisPort = 6379;
const messageList = "messageList";
const messageKey = "messageKey";

const app = express();
const client = redis.createClient(redisPort);

// Use bodyParser Middleware to fetch body params
app.use(bodyParser.urlencoded({ extended: false }));

app.post('/addMessage', (req, res) => {
    const message = req.body.message;
    const time = req.body.time;
    
    if (!message || !time) {
        res.send(JSON.stringify({ status: 'error', message: 'missing message or time params in request' }));
    }
    else if (isNaN(time)) {
        res.send(JSON.stringify({ status: 'error', message: 'time param is not in epoch time, expected number' }));
    }
    else {
        // Get the current last key (will be created if doesn't exists)
        client.incr(messageKey, (err, num) => {
            if (err) {
                res.send(JSON.stringify({ status: 'error', message: `Redis: couldn't increment ${messageKey}. Error: ${err}` }));
            }
            else {
                const messageID = `message:${num}`;

                // Add to a sorted list by the time our message
                client.ZADD(messageList, time, `message:${num}`, (err, redisResponse) => {
                    if (err) {
                        res.send(JSON.stringify({ status: 'error', message: `Redis: couldn't add to sorted list "${messageList}". Error: ${err}` }));
                    }
                    else if (!redisResponse){
                        // Note: this error can't happen from cross servers, only by changing the redis manually
                        res.send(JSON.stringify({ status: 'error', message: `Redis: couldn't add to sorted list "${messageList}". Duplicate ${messageID}` }));
                    }
                    else {
                        res.send(JSON.stringify({ status: 'ok', messageID, addedToSortedList: true }));
                    }
                });

            }
        });
    }
});

app.listen(port, () => console.log(`Listening on port ${port}`));
