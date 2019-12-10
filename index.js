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
                const addedToSortedList = client.ZADD(messageList, time, `message:${num}`);

                res.send(JSON.stringify({ status: 'ok', messageID, addedToSortedList }));
            }
        });
    }
});

app.listen(port, () => console.log(`Listening on port ${port}`));
