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

## Review modules configuration

NestJS offers different ways of handling application configuration thnaks to its [ConfigModule](https://docs.nestjs.com/techniques/configuration). In this demo application, we used some of these techniques to bind our application to the services provided by Microcks or loaded via the `microcks-docker-compose.yml` file.

You may want to check the [`pastry.module.ts`](src/pastry/pastry.module.ts) file to see how the `Pastry API` dependency is actually injected into our client configuration:

```ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { PastryService } from './pastry.service';

@Module({
  imports: [ConfigModule.forRoot({
    load: [() => ({
      'pastries.baseurl': 'http://localhost:9090/rest/API+Pastries/0.0.1'
    })],
  })],
  providers: [PastryService],
  exports: [PastryService]
})
export class PastryModule {}
```

And you may want to check the [`order.module.ts`](src/order/order.module.ts) file to see how the Kafka broker url and specific topic managed by Microcks are injected into the application configuration:

```ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';

import { OrderService } from './order.service';
import { OrderController } from './order.controller';
import { PastryModule } from '../pastry/pastry.module';
import { OrderEventListener } from './order-event.listener';
import { OrderEventPublisher } from './order-event.publisher';


@Module({
  imports: [PastryModule,
    ConfigModule.forRoot({
      load: [() => ({
        'brokers.url': 'localhost:9092',
        'order-events-reviewed.topic': 'OrderEventsAPI-0.1.0-orders-reviewed'
      })],
    }),
    ClientsModule.registerAsync([
      {
        name: 'ORDER_SERVICE',
        imports: [ConfigModule],
        useFactory:async(configService: ConfigService) => ({
          transport: Transport.KAFKA,
          options: {
            client: {
              clientId: 'order-service',
              brokers: [configService.get<string>('brokers.url')],
            },
            consumer: {
              groupId: 'order-service'
            },
            producer: {
              allowAutoTopicCreation: true
            }  
          }
        }),
        inject: [ConfigService],
      }
    ]) d
    ],
  controllers: [OrderController, OrderEventListener],
  providers: [OrderService, OrderEventPublisher],
})
export class OrderModule {}
```

## Play with the API

```shell
curl -XPOST localhost:8080/api/orders -H 'Content-type: application/json' \
    -d '{"customerId": "lbroudoux", "productQuantities": [{"productName": "Millefeuille", "quantity": 1}], "totalPrice": 5.1}' -v
```

You should get a response similar to the following:

```shell
< HTTP/1.1 201 
< Content-Type: application/json
< Transfer-Encoding: chunked
< Date: Mon, 29 Jan 2024 17:15:42 GMT
< 
* Connection #0 to host localhost left intact
{"id":"2da3a517-9b3b-4788-81b5-b1a1aac71746","status":"CREATED","customerId":"lbroudoux","productQuantities":[{"productName":"Millefeuille","quantity":1}],"totalPrice":5.1}%
```

Now test with something else, requesting for another Pastry:

```shell
curl -XPOST localhost:8080/api/orders -H 'Content-type: application/json' \
    -d '{"customerId": "lbroudoux", "productQuantities": [{"productName": "Eclair Chocolat", "quantity": 1}], "totalPrice": 4.1}' -v
```

This time you get another "exception" response:

```shell
< HTTP/1.1 422 
< Content-Type: application/json
< Transfer-Encoding: chunked
< Date: Mon, 29 Jan 2024 17:19:08 GMT
< 
* Connection #0 to host localhost left intact
{"productName":"Eclair Chocolat","details":"Pastry Eclair Chocolat is not available"}%
```

and this is because Microcks has created different simulations for the Pastry API 3rd party API based on API artifacts we loaded.
Check the `src/test/resources/third-parties/apipastries-openapi.yml` and `src/test/resources/third-parties/apipastries-postman-collection.json` files to get details.

### 
[Next](step-4-write-rest-tests.md)