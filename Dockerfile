# getting base image ubuntu
FROM ubuntu

LABEL maintainer="Michael Tsafrir <michaeltsafrir@gmail.com>"

# install node js
RUN apt-get update
RUN apt-get install -y nodejs
RUN apt-get install -y npm

# add program to container
ADD . /MessageAtTime

# set working directory
WORKDIR /MessageAtTime

# install packages and dependencies
RUN npm install

# run server
CMD ["npm", "start"]
