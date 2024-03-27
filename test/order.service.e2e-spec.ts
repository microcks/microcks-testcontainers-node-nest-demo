import * as path from "path";
import { findFreePorts } from "find-free-ports"
import { ConfigModule } from '@nestjs/config';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { AppModule } from '../src/app.module';
import { OrderInfoDto } from "../src/order/dto/order-info.dto";
import { OrderService } from "../src/order/order.service";

import { Network, StartedNetwork, TestContainers } from "testcontainers";
import { KafkaContainer, StartedKafkaContainer } from '@testcontainers/kafka';
import { MicrocksContainersEnsemble, StartedMicrocksContainersEnsemble, TestRequest, TestResult, TestRunnerType } from '@microcks/microcks-testcontainers';


describe('OrderService (e2e)', () => {
  jest.setTimeout(180_000);
  const resourcesDir = path.resolve(__dirname, "..", "test/resources");

  let network: StartedNetwork;
  let ensemble: StartedMicrocksContainersEnsemble;
  let kafkaContainer: StartedKafkaContainer;
  let app: INestApplication;
  let appPort: number;

  let orderService: OrderService;

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
    ensemble = await new MicrocksContainersEnsemble(network, 'quay.io/microcks/microcks-uber:1.9.0')
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

  afterAll(async () => {
    // Now stop the app, the containers and the network.
    console.log('Closing application...');
    await app.close();
    console.log('Stopping containers...');
    await ensemble.stop();
    await kafkaContainer.stop();
    await network.stop();
  });


  it ('should publish an Event when Order is created', async () => {
    // Prepare a Microcks test.
    var testRequest: TestRequest = {
      serviceId: "Order Events API:0.1.0",
      filteredOperations: ['SUBSCRIBE orders-created'],
      runnerType: TestRunnerType.ASYNC_API_SCHEMA,
      testEndpoint: "kafka://kafka:9092/orders-created",
      timeout: 3000
    };

    // Prepare an application Order.
    var orderInfo: OrderInfoDto = {
      customerId: "123-456-789",
      productQuantities: [
        { productName: "Millefeuille", quantity: 1 },
        { productName: "Paris-Brest", quantity: 1 }
      ],
      totalPrice: 8.4
    }

    // Launch the Microcks test and wait a bit to be sure it actually connects to Kafka.
    console.log("Launching the test");
    var testResultPromise: Promise<TestResult> = ensemble.getMicrocksContainer().testEndpoint(testRequest);
    await delay(1000);

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

  function delay(ms: number) {
    return new Promise( resolve => setTimeout(resolve, ms) );
  }
});