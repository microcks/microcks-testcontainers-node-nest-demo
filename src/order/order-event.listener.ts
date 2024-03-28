import { Controller, Inject, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientKafka, Ctx, EventPattern, KafkaContext, Payload, Transport } from "@nestjs/microservices";

import { OrderService } from './order.service';
import { OrderEvent } from "./dto/order-event.dto";

@Controller('orders-listener')
export class OrderEventListener implements OnApplicationShutdown {
  consumer: any;

  //constructor(private readonly orderService: OrderService) {}

  constructor(configService: ConfigService,
      private readonly orderService: OrderService,
      @Inject('ORDER_SERVICE') private readonly client: ClientKafka) {

    
    // Add to go through this low-level stuff to get ConfigService topic name.
    let kafka = client.createClient();
    this.consumer = kafka.consumer({ groupId: 'order-service-consumer' });

    /*
    this.consumer.subscribe({ topics: [configService.get<string>('order-events-reviewed.topic')], fromBeginning: false })
      .then(result => {
        this.consumer.run({
          eachMessage: async ({ topic, partition, message }) => {
            console.log(`Received OrderEvent: ${message.value.toString()}`);  
            this.orderService.updateReviewedOrder(JSON.parse(message.value.toString()) as OrderEvent);
          },
        })
      });
    */

    const run = async () => {
      await this.consumer.connect();
      await this.consumer.subscribe({ topics: [configService.get<string>('order-events-reviewed.topic')], fromBeginning: false });
      await this.consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
          console.log(`Received OrderEvent: ${message.value.toString()}`);  
          this.orderService.updateReviewedOrder(JSON.parse(message.value.toString()) as OrderEvent);
        },
      })
    }

    run().catch(e => console.error(`[OrderEventListener] ${e.message}`, e))
  }

  async onApplicationShutdown(signal: string) {
    console.log('Disconnecting Kafka consumer');
    this.consumer.disconnect();
    await this.client.close();
  }

  // Using @EventPattern is more elegant but cannot find how to use the ConfigService to dynamically
  // get the name of the topic to listen to.
  /*
  @EventPattern('OrderEventsAPI-0.1.0-orders-reviewed', Transport.KAFKA)
  handleReviewedOrder(@Payload() message: OrderEvent, @Ctx() context: KafkaContext) {
    console.log(`Topic: ${context.getTopic()}`);
  }
  */
}