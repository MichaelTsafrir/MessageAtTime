const express = require('express');
const bodyParser = require('body-parser');

const app = express();
const port = 5040;

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
        res.send(JSON.stringify({ status: 'ok' }));
    }
});

app.listen(port, () => console.log(`Listening on port ${port}`));
