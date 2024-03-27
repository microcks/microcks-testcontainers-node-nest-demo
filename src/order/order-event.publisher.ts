import { Inject, Injectable } from '@nestjs/common';
import { OrderEvent } from './dto/order-event.dto';
import { ClientKafka } from '@nestjs/microservices';

@Injectable()
export class OrderEventPublisher {
  
  constructor(@Inject('ORDER_SERVICE') private readonly client: ClientKafka) {}

  publishOrderCreated(event: OrderEvent) {
    console.log("Emitting order event");
    this.client.emit<any>('orders-created', JSON.stringify(event));
  }
}