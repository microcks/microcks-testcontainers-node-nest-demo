import * as path from "path";
import { findFreePorts } from "find-free-ports"
import { ConfigModule } from '@nestjs/config';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { AppModule } from '../src/app.module';

import { TestContainers } from "testcontainers";
import { KafkaContainer, StartedKafkaContainer } from '@testcontainers/kafka';
import { MicrocksContainer, StartedMicrocksContainer, TestRequest, TestRunnerType } from '@microcks/microcks-testcontainers';

describe('OrderController (e2e)', () => {
  jest.setTimeout(180_000);
  const resourcesDir = path.resolve(__dirname, "..", "test/resources");

  let container: StartedMicrocksContainer;
  let kafkaContainer: StartedKafkaContainer;
  let app: INestApplication;
  let appPort: number;

  beforeAll(async () => {
    appPort = (await findFreePorts(1, {startPort: 3000, endPort: 3100}))[0];
    await TestContainers.exposeHostPorts(appPort);

    // Start kafka container.
    kafkaContainer = await new KafkaContainer('confluentinc/cp-kafka:7.5.0')
      .withExposedPorts(9093)
      .start();

    // Start container and load artifacts.
    container = await new MicrocksContainer('quay.io/microcks/microcks-uber:1.10.0-native')
      .withMainArtifacts([
        path.resolve(resourcesDir, 'order-service-openapi.yml'),
        path.resolve(resourcesDir, 'apipastries-openapi.yml')
      ])
      .withSecondaryArtifacts([path.resolve(resourcesDir, 'apipastries-postman-collection.json')])
      .start();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          load: [() => ({
            'pastries.baseurl': container.getRestMockEndpoint('API Pastries', '0.0.1'),
            'brokers.url': `localhost:${kafkaContainer.getMappedPort(9093)}`,
            //'order-events-reviewed.topic': 'orders-reviewed'
          })],
        }), AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.listen(appPort);
  });

  afterAll(async () => {
    // Now stop the app, the containers and the network.
    console.log('Closing application...');
    await app.close();
    console.log('Stopping containers...');
    await container.stop();
    await kafkaContainer.stop();
  });

  it('should conform to OpenAPI spec', async () => {
    var testRequest: TestRequest = {
      serviceId: "Order Service API:0.1.0",
      runnerType: TestRunnerType.OPEN_API_SCHEMA,
      testEndpoint: "http://host.testcontainers.internal:" + appPort,
      timeout: 3000
    };

    var testResult = await container.testEndpoint(testRequest);

    console.log(JSON.stringify(testResult, null, 2));

    expect(testResult.success).toBe(true);
    expect(testResult.testCaseResults.length).toBe(1);
    expect(testResult.testCaseResults[0].testStepResults.length).toBe(2);
  });
});