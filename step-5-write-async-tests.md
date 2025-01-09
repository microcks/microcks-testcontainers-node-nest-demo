# Step 5: Let's write tests for the Async Events

Now that we address the REST/Synchronous part, let's have a look on the part related to Asynchronous Kafka events.
Testing of asynchronous or event-driven system is usually a pain for developers 🥲

## First Test - Verify our OrderService is publishing events

In this section, we'll focus on testing the `Order Service` + `Event Publisher` components of our application:

![Event Publisher Test](./assets/test-order-event-publisher.png)

Even if it may be easy to check that the creation of an event object has been triggered with frameworks like [Mockito](https://site.mockito.org/)
or others, it's far more complicated to check that this event is correctly serialized, sent to a broker and valid
regarding an Event definition...

Fortunately, Microcks and TestContainers make this thing easy!

Let's review the test spec `order.service.e2e-spec.ts` under `test`.

The first important thing to notice is the setup phase of the test that happens in the `beforeAll()` function:

```ts
  beforeAll(async () => {
    appPort = (await findFreePorts(1, {startPort: 3200, endPort: 3300}))[0];
    await TestContainers.exposeHostPorts(appPort);

    network = await new Network().start();

    // Start kafka container.
    kafkaContainer = await new KafkaContainer('confluentinc/cp-kafka:7.5.0')
      .withNetwork(network)
      .withNetworkAliases("kafka")
      .withExposedPorts(9093)
      .start();

    // Start ensemble and load artifacts.
    ensemble = await new MicrocksContainersEnsemble(network, 'quay.io/microcks/microcks-uber:1.10.0')
      .withMainArtifacts([
        path.resolve(resourcesDir, 'order-events-asyncapi.yml'),
        path.resolve(resourcesDir, 'order-service-openapi.yml'),
        path.resolve(resourcesDir, 'apipastries-openapi.yml')
      ])
      .withSecondaryArtifacts([
        path.resolve(resourcesDir, 'order-service-postman-collection.json'),
        path.resolve(resourcesDir, 'apipastries-postman-collection.json')
      ])
      .withAsyncFeature()
      .start();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          load: [() => ({
            'pastries.baseurl': ensemble.getMicrocksContainer().getRestMockEndpoint('API Pastries', '0.0.1'),
            'brokers.url': `localhost:${kafkaContainer.getMappedPort(9093)}`,
          })],
        }), AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.listen(appPort);

    orderService = moduleFixture.get(OrderService);
  });
```

This is where we're launching the Microcks Testcontainers module and configure it with the resources we need. Here we're loading 
the `Pastry API` resources, the `Order Service API` resources as well as the `Order ` .

We're also configuring the application to use a REST mock endpoint provided by the Microcks container for this API.

Then, we can simply proceed and execute some tests:

```ts
  it ('should publish an Event when Order is created', async () => {
    // Prepare a Microcks test.
    var testRequest: TestRequest = {
      serviceId: "Order Events API:0.1.0",
      filteredOperations: ['SUBSCRIBE orders-created'],
      runnerType: TestRunnerType.ASYNC_API_SCHEMA,
      testEndpoint: "kafka://kafka:9092/orders-created",
      timeout: 2000
    };

    // Prepare an application Order.
    var orderInfo: OrderInfoDto = {
      customerId: "123-456-789",
      productQuantities: [
        { productName: "Millefeuille", quantity: 1 },
        { productName: "Eclair Cafe", quantity: 1 }
      ],
      totalPrice: 8.4
    }

    // Launch the Microcks test and wait a bit to be sure it actually connects to Kafka.
    console.log("Launching the test");
    var testResultPromise: Promise<TestResult> = ensemble.getMicrocksContainer().testEndpoint(testRequest);
    await delay(2000);

    // Invoke the application to create an order.
    var createdOrder = orderService.create(orderInfo);

    // You may check additional stuff on createdOrder...

    // Get the Microcks test result.
    var testResult = await testResultPromise;

    console.log(JSON.stringify(testResult, null, 2));

    expect(testResult.success).toBe(true);
    expect(testResult.testCaseResults.length).toBeGreaterThan(0);
    expect(testResult.testCaseResults[0].testStepResults.length).toBe(1);
  });
```

Things are a bit more complex here, but we'll walk through step-by-step:
* Similarly to previous section, we prepared a Microcks-provided `TestRequest` object
  * We ask for a `AsyncAPI Schema` conformance test that will use the definition found into the `order-events-asyncapi.yml` contract,
  * We ask Microcks to listen to the `kafka://kafka:19092/orders-created` endpoint that represents the `orders-created` topic on our Kafka broker managed by Testcontainers,
  * We ask to focus on a specific operation definition to mimic consumers that subscribe to the  `orders-created` channel,
  * We specified a timeout value that means that Microcks will only listen during 2 seconds for incoming messages. 
* We also prepared an `OrderInfo` object that will be used as the input of the `placeOrder()` method invocation on `OrderService`.
* Then, we launched the test on the Microcks side. This time, the launch is asynchronous, so we received a `Future` that will give us a `TestResult` later on
  * We wait a bit here to ensure, Microcks got some time to start the test and connect to Kafka broker.
* We can invoke our business service by creating an order with `placeOrder()` method. We could assert whatever we want on created order as well.
* Finally, we wait for the future completion to retrieve the `TestResult` and assert on the success and check we received 1 message as a result.

The sequence diagram below details the test sequence. You'll see 2 parallel blocks being executed:
* One that corresponds to Microcks test - where it connects and listen for Kafka messages,
* One that corresponds to the `OrderService` invokation that is expected to trigger a message on Kafka.

```mermaid
sequenceDiagram
    par Launch Microcks test
      OrderServiceTests->>Microcks: testEndpointAsync()
      participant Microcks
      Note right of Microcks: Initialized at test startup
      Microcks->>Kafka: poll()
      Kafka-->>Microcks: messages
      Microcks-->Microcks: validate messages
    and Invoke OrderService
      OrderServiceTests->>+OrderService: placeOrder(OrderInfo)
      OrderService->>+OrderEventPublisher: publishEvent(OrderEvent)
      OrderEventPublisher->>Kafka: send("orders-created")
      OrderEventPublisher-->-OrderService: done
      OrderService-->-OrderServiceTests: Order
    end
    OrderServiceTests->>+Microcks: get()
    Note over OrderServiceTests,Microcks: After at most 2 seconds
    Microcks-->OrderServiceTests: TestResult
```

Because the test is a success, it means that Microcks has received an `OrderEvent` on the specified topic and has validated the message
conformance with the AsyncAPI contract or this event-driven architecture. So you're sure that all your NestJS configuration, Kafka JSON serializer
configuration and network communication are actually correct!

### 🎁 Bonus step - Verify the event content

So you're now sure that an event has been sent to Kafka and that it's valid regarding the AsyncAPI contract. But what about the content 
of this event? If you want to go further and check the content of the event, you can do it by asking Microcks the events read during the 
test execution and actually check their content. This can be done adding a few lines of code:

```ts
it ('should publish an Event when Order is created', async () => {
  // [...] Unchanged comparing previous step.

  // Get the Microcks test result.
  var testResult = await testResultPromise;

  // [...] Unchanged comparing previous step.

  // Check the content of the emitted event, read from Kafka topic.
  let events: UnidirectionalEvent[] = await ensemble.getMicrocksContainer().getEventMessagesForTestCase(testResult, "SUBSCRIBE orders-created");
  
  expect(events.length).toBe(1);

  let message: EventMessage = events[0].eventMessage;
  let orderEvent = JSON.parse(message.content);

  expect(orderEvent.changeReason).toBe('Creation');
  let order = orderEvent.order;
  expect(order.customerId).toBe("123-456-789");
  expect(order.totalPrice).toBe(8.4);
  expect(order.productQuantities.length).toBe(2);
});
```

Here, we're using the `getEventMessagesForTestCase()` method on the Microcks container to retrieve the messages read during the test execution. 
Using the wrapped `EventMessage` class, we can then check the content of the message and assert that it matches the order we've created.

## Second Test - Verify our OrderEventListener is processing events

In this section, we'll focus on testing the `Event Consumer` + `Order Service` components of our application:

![Event Publisher Test](./assets/test-order-event-consumer.png)

The final thing we want to test here is that our `OrderEventListener` component is actually correctly configured for connecting to Kafka,
for consuming messages, for de-serializing them into correct Java objects and for triggering the processing on the `OrderService`.
That's a lot to do and can be quite complex! But things remain very simple with Microcks 😉

Let's review the test spec `order-event.listener.e2e-spec.ts` under `test`.

```ts
it ('should consume an Event and process Service', async () => {
  let retry = 0;

  while (retry < 10) {
    try {
      let order = orderService.getOrder('123-456-789');
      if (orderIsValid(order)) {
        break;
      }
    } catch (e) {
      if (e instanceof OrderNotFoundException) {
        // Continue until we get the end of the poll loop.
      } else {
        // Exit here.
        throw e;
      }
    }
    await delay(500);
    retry++
  }
});

function orderIsValid(order: Order) : boolean {
  if (order) {
    expect(order.customerId).toBe('lbroudoux');
    expect(order.status).toBe(OrderStatus.VALIDATED);
    expect(order.productQuantities.length).toBe(2);
    return true;
  }
  return false;
}
```

To fully understand this test, remember that as soon as you're launching the test, we start Kafka and Microcks containers and that Microcks
is immediately starting publishing mock messages on this broker. So this test actually starts with a waiting loop, just checking that the
messages produced by Microcks are correctly received and processed on the application side.

The important things to get in this test are:
* We're waiting at most 4 seconds here because the default publication frequency of Microcks mocks is 3 seconds (this can be configured as you want of course),
* Within each polling iteration, we're checking for the order with id `123-456-789` because these are the values defined within the `order-events-asyncapi.yaml` AsyncAPI contract examples
* If we retrieve this order and get the correct information from the service, it means that is has been received and correctly processed!
* If no message is found before the end of 4 seconds, the loop exits with a `ConditionTimeoutException` and we mark our test as failed.

The sequence diagram below details the test sequence. You'll see 3 parallel blocks being executed:
* The first corresponds to Microcks mocks - where it connects to Kafka, creates a topic and publishes sample messages each 3 seconds,
* The second one corresponds to the `OrderEventListener` invocation that should be triggered when a message is found in the topic,
* The third one corresponds to the actual test - where we check that the specified order has been found and processed by the `OrderService`. 

```mermaid
sequenceDiagram
  par On test startup
    loop Each 3 seconds
      participant Microcks
      Note right of Microcks: Initialized at test startup
      Microcks->>Kafka: send(microcks-orders-reviewed")
    end
  and Listener execution
    OrderEventListener->>Kafka: poll()
    Kafka-->>OrderEventListener: messages
    OrderEventListener->>+OrderService: updateOrder()
    OrderService-->OrderService: update order status
    OrderService->>-OrderEventListener: done
  and Test execution
    Note over OrderService,OrderEventListenerTests: At most 4 seconds
    loop Each 400ms
      OrderEventListenerTests->>+OrderService: getOrder("123-456-789")
      OrderService-->-OrderEventListenerTests: order or throw OrderNotFoundException
      alt Order "123-456-789" found
        OrderEventListenerTests-->OrderEventListenerTests: assert and break;
      else Order "123-456-789" not found
        OrderEventListenerTests-->OrderEventListenerTests: continue;
      end
    end
    Note over OrderService,OrderEventListenerTests: If here, it means that we never received expected message
    OrderEventListenerTests-->OrderEventListenerTests: fail();
  end
```

You did it and succeed in writing integration tests for all your application component with minimum boilerplate code! 🤩 

## Wrap-up

Thanks a lot for being through this quite long demonstration. We hope you learned new techniques for integration tests with both REST and Async/Event-driven APIs. Cheers! 🍻