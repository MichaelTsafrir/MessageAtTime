const express = require('express');
const bodyParser = require('body-parser');
const redis = require('redis');

const port = 5040;
const redisPort = 6379;
const redisMessageList = "messageList";

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
        const redisStatus = client.set(time, message);
        res.send(JSON.stringify({ status: 'ok', redisStatus }));
    }
});

app.listen(port, () => console.log(`Listening on port ${port}`));
