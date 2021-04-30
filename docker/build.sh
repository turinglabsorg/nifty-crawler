#!/bin/bash

cd docker
if [[ "$@" =~ "-rebuild" ]]
then
    echo "Rebuilding Docker Image"
    docker build --no-cache -t erc721:mongo .
    docker run --restart=unless-stopped -d --name=erc721_mongo -dit -p 27017:27017 erc721:mongo
else
    docker ps | grep 'erc721_mongo' &> /dev/null
    if [ $? == 0 ]; then
        echo "Database docker exists yet, running istance."
        docker start erc721_mongo
    else
        echo "Running MongoDB Docker container."
        systemctl enable docker
        echo 'DOCKER_OPTS="--iptables=false"' >> /etc/default/docker
        systemctl restart docker
        docker build -t erc721:mongo .
        docker run --restart=unless-stopped -d --name=erc721_mongo -dit -p 27017:27017 erc721:mongo
    fi
fi
