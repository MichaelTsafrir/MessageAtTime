# Message At Time
a node server that sends messages at an accurate time using Redis

- Supports multiple servers
- saves data persistenly to prevent data loss
- times messages for the future

### Redis Configuration
In order to prevent dataloss, redis needs to be set with persistence. This will make Redis save the data on the disk, making it slower, but preventing data loss on crash

`127.0.0.1:6379> config set appendonly yes`

The server is listening to the event of ZADD, knowing when a new message is added. In order to do so, you need to enable in the configuration the notify-keyspace-event to the string "Kz" (K - listen to event. z - listen to sorted set commands)

`127.0.0.1:6379> config set notify-keyspace-events Kz`

### How to run
Go to the server's directory and run

`node index.js`

### API

on default, the program runs on port 3000.
#### addMessage
send a **post** request to */addMessage*
expected params:

| Name  | Type | Info |
| ------------- | ------------- | ------------- |
| message  | string | The message to send |
| time  | number | The time to send the message in epoch time (seconds) |

post example: 
url: localhost:3000/addMessage
message: "Hello World"
time: 1576025098

### Configuration
the server runs it's configuration from the config/common.json config file.
edit the file in order to change configuration.
__Note__: redis default host is set for docker as "redis", change it to your host if you are not running through docker

##### Default Configuration
Param  | Value | Info
------------- | ------------- | ---------------
port  | 3000 | The port to run the server on
redis.host  | redis | The host that runs redis server
redis.port  | 6379 | The port redis is run on
redis.messageList  | messageList | The name of the sorted list redis wil use
redis.messageKey  | messageKey | The name for the Unique ID variable counter

You can change any of the given params also from the command line when running the server.

`node index.js --port='3000' --redis.port='5000'` 

### Docker
Notice the config is set with host as "redis". The containers are mapped by this name.
The docker compose is set to build 3 servers, on ports 4000, 4001, 4002. If you desire to build only one, simply use the code in the comment in docker-compose.yaml
run
`docker-compose up -d`
In order to watch logs, use
`docker-compose logs -f app_1 app_2 app_3`
