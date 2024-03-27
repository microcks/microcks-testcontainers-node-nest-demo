# Step 3: Local development experience with Microcks

Our application uses Kafka and external dependencies.

Currently, if you run the application from your terminal, you will see the following error:

```shell
$ npm run start
==== OUTPUT ====
> nest-order-service@0.0.1 start
> nest start

[Nest] 69826  - 03/27/2024, 3:08:00 PM     LOG [NestFactory] Starting Nest application...
[Nest] 69826  - 03/27/2024, 3:08:00 PM     LOG [InstanceLoader] ConfigHostModule dependencies initialized +7ms
[Nest] 69826  - 03/27/2024, 3:08:00 PM     LOG [InstanceLoader] AppModule dependencies initialized +0ms
[Nest] 69826  - 03/27/2024, 3:08:00 PM     LOG [InstanceLoader] ConfigModule dependencies initialized +1ms
[Nest] 69826  - 03/27/2024, 3:08:00 PM     LOG [InstanceLoader] ConfigModule dependencies initialized +0ms
[Nest] 69826  - 03/27/2024, 3:08:00 PM     LOG [InstanceLoader] ConfigModule dependencies initialized +0ms
[Nest] 69826  - 03/27/2024, 3:08:00 PM     LOG [InstanceLoader] PastryModule dependencies initialized +37ms
[Nest] 69826  - 03/27/2024, 3:08:00 PM     LOG [InstanceLoader] ClientsModule dependencies initialized +0ms
[Nest] 69826  - 03/27/2024, 3:08:00 PM     LOG [ClientKafka] INFO [Consumer] Starting {"timestamp":"2024-03-27T14:08:00.053Z","logger":"kafkajs","groupId":"order-service-consumer"}
[Nest] 69826  - 03/27/2024, 3:08:00 PM     LOG [InstanceLoader] OrderModule dependencies initialized +4ms
[Nest] 69826  - 03/27/2024, 3:08:00 PM     LOG [RoutesResolver] AppController {/}: +2ms
[Nest] 69826  - 03/27/2024, 3:08:00 PM     LOG [RouterExplorer] Mapped {/, GET} route +1ms
[Nest] 69826  - 03/27/2024, 3:08:00 PM     LOG [RoutesResolver] OrderController {/orders}: +0ms
[Nest] 69826  - 03/27/2024, 3:08:00 PM     LOG [RouterExplorer] Mapped {/orders, POST} route +0ms
[Nest] 69826  - 03/27/2024, 3:08:00 PM     LOG [RoutesResolver] OrderEventListener {/orders-listener}: +0ms
[Nest] 69826  - 03/27/2024, 3:08:00 PM     LOG [NestApplication] Nest application successfully started +1ms
[Nest] 69826  - 03/27/2024, 3:08:00 PM   ERROR [ClientKafka] ERROR [Connection] Connection error: connect ECONNREFUSED ::1:9092 {"timestamp":"2024-03-27T14:08:00.064Z","logger":"kafkajs","broker":"localhost:9092","clientId":"order-service-client","stack":"Error: connect ECONNREFUSED ::1:9092\n    at TCPConnectWrap.afterConnect [as oncomplete] (node:net:1494:16)"}
[Nest] 69826  - 03/27/2024, 3:08:00 PM   ERROR [ClientKafka] ERROR [BrokerPool] Failed to connect to seed broker, trying another broker from the list: Connection error: connect ECONNREFUSED ::1:9092 {"timestamp":"2024-03-27T14:08:00.065Z","logger":"kafkajs","retryCount":0,"retryTime":311}
[Nest] 69826  - 03/27/2024, 3:08:00 PM   ERROR [ClientKafka] ERROR [Connection] Connection error: connect ECONNREFUSED ::1:9092 {"timestamp":"2024-03-27T14:08:00.066Z","logger":"kafkajs","broker":"localhost:9092","clientId":"order-service-client","stack":"Error: connect ECONNREFUSED ::1:9092\n    at TCPConnectWrap.afterConnect [as oncomplete] (node:net:1494:16)"}
[Nest] 69826  - 03/27/2024, 3:08:00 PM   ERROR [ClientKafka] ERROR [BrokerPool] Failed to connect to seed broker, trying another broker from the list: Connection error: connect ECONNREFUSED ::1:9092 {"timestamp":"2024-03-27T14:08:00.066Z","logger":"kafkajs","retryCount":0,"retryTime":338}
[Nest] 69826  - 03/27/2024, 3:08:00 PM   ERROR [ClientKafka] ERROR [Connection] Connection error: connect ECONNREFUSED ::1:9092 {"timestamp":"2024-03-27T14:08:00.380Z","logger":"kafkajs","broker":"localhost:9092","clientId":"order-service-client","stack":"Error: connect ECONNREFUSED ::1:9092\n    at TCPConnectWrap.afterConnect [as oncomplete] (node:net:1494:16)"}
[Nest] 69826  - 03/27/2024, 3:08:00 PM   ERROR [ClientKafka] ERROR [BrokerPool] Failed to connect to seed broker, trying another broker from the list: Connection error: connect ECONNREFUSED ::1:9092 {"timestamp":"2024-03-27T14:08:00.382Z","logger":"kafkajs","retryCount":1,"retryTime":602}
[...]
```

To run the application locally, we need to have a Kafka broker up and running + the other dependencies corresponding to our Pastry API provider and reviewing system.

Instead of installing these services on our local machine, or using Docker to run these services manually,
we will use a utility tool with this simple command `microcks.sh`. Microcks docker-compose file (`microcks-docker-compose.yml`)
has been configured to automatically import the `Order API` contract but also the `Pastry API` contracts. Both APIs are discovered on startup
and Microcks UI should be available on `http://localhost:9090` in your browser:

```shell
$ ./microcks.sh
==== OUTPUT ====
[+] Running 4/4
 ✔ Container microcks-testcontainers-node-nest-demo-microcks-1  Started                                                                                                                         0.2s 
 ✔ Container microcks-kafka                                     Started                                                                                                                         0.2s 
 ✔ Container microcks-async-minion                              Started                                                                                                                         0.4s 
 ✔ Container microcks-testcontainers-node-nest-demo-importer-1  Started                                                                                                                         0.4s
```

Because our `Order Service` application has been configured to talk to Microcks mocks (see the default settings in `src/pastry/pastry.module.ts`),
you should be able to directly call the Order API and invoke the whole chain made of the 3 components:

```shell
$ curl -XPOST localhost:3000/orders -H 'Content-type: application/json' \
    -d '{"customerId": "lbroudoux", "productQuantities": [{"productName": "Millefeuille", "quantity": 1}], "totalPrice": 10.1}'
==== OUTPUT ====
{"id":"dade7d85694","status":"CREATED","customerId":"lbroudoux","productQuantities":[{"productName":"Millefeuille","quantity":1}],"totalPrice":10.1}
```
