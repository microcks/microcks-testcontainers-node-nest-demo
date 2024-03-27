import * as request from 'supertest';
import { findFreePorts } from "find-free-ports"
import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';

import { AppModule } from '../src/app.module';

import { TestContainers } from "testcontainers";
import { KafkaContainer, StartedKafkaContainer } from '@testcontainers/kafka';

describe('AppController (e2e)', () => {
  jest.setTimeout(100_000);

  let app: INestApplication;

  let kafkaContainer: StartedKafkaContainer;
  let appPort: number;

  beforeAll(async () => {
    appPort = (await findFreePorts(1, {startPort: 3000, endPort: 3100}))[0];
    await TestContainers.exposeHostPorts(appPort);

    // Start kafka container.
    kafkaContainer = await new KafkaContainer('confluentinc/cp-kafka:7.5.0')
      .withExposedPorts(9093)
      .start();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          load: [() => ({
            'brokers.url': `localhost:${kafkaContainer.getMappedPort(9093)}`,
          })],
        }), AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.listen(appPort);
  });

  afterAll(async () => {
    // Now stop the app, the containers and the network.
    await delay(750);
    console.log('Closing application...');
    await app.close();
    console.log('Stopping containers...');
    await kafkaContainer.stop();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  function delay(ms: number) {
    return new Promise( resolve => setTimeout(resolve, ms) );
  }
});
