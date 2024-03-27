import * as path from "path";
import { findFreePorts } from "find-free-ports"
import { ConfigModule } from '@nestjs/config';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { AppModule } from '../src/app.module';
import { Order } from "../src/order/entities/order.entity";
import { OrderStatus } from "../src/order/entities/order-status";
import { OrderService } from "../src/order/order.service";
import { OrderNotFoundException } from "../src/order/order-not-found.error";

import { Network, StartedNetwork, TestContainers } from "testcontainers";
import { KafkaContainer, StartedKafkaContainer } from '@testcontainers/kafka';
import { MicrocksContainersEnsemble, StartedMicrocksContainersEnsemble, TestRequest, TestResult, TestRunnerType } from '@microcks/microcks-testcontainers';




describe('OrderEventListener (e2e)', () => {
  jest.setTimeout(180_000);
  const resourcesDir = path.resolve(__dirname, "..", "test/resources");

  let network: StartedNetwork;
  let ensemble: StartedMicrocksContainersEnsemble;
  let kafkaContainer: StartedKafkaContainer;
  let app: INestApplication;
  let appPort: number;

  let orderService: OrderService;

  beforeAll(async () => {
    appPort = (await findFreePorts(1, {startPort: 3100, endPort: 3200}))[0];
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
        .withKafkaConnection({bootstrapServers: 'kafka:9092'})
        .start();

      const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({
            load: [() => ({
              'pastries.baseurl': ensemble.getMicrocksContainer().getRestMockEndpoint('API Pastries', '0.0.1'),
              'brokers.url': `localhost:${kafkaContainer.getMappedPort(9093)}`,
              'order-events-reviewed.topic': ensemble.getAsyncMinionContainer().getKafkaMockTopic('Order Events API', '0.1.0', 'PUBLISH orders-reviewed')
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
      console.log("Got an order to validate: " + JSON.stringify(order));
      expect(order.customerId).toBe('lbroudoux');
      expect(order.status).toBe(OrderStatus.VALIDATED);
      expect(order.productQuantities.length).toBe(2);
      return true;
    }
    return false;
  }

  function delay(ms: number) {
    return new Promise( resolve => setTimeout(resolve, ms) );
  }
});