import { Injectable } from '@nestjs/common';

import { OrderInfoDto } from './dto/order-info.dto';

import { Order } from './entities/order.entity';
import { UnavailablePastryError } from './unavailable-pastry.error'

import { Pastry } from '../pastry/pastry.dto';
import { PastryService } from '../pastry/pastry.service';
import { OrderEventPublisher } from './order-event.publisher';
import { OrderEvent } from './dto/order-event.dto';
import { OrderNotFoundException } from './order-not-found.error';

@Injectable()
export class OrderService {

  orderEventsRepository: Map<string, OrderEvent[]> = new Map<string, OrderEvent[]>();

  constructor(private readonly pastryService: PastryService,
    private readonly orderEventPublisher: OrderEventPublisher) {}

  /**
   * 
   * @param orderInfo 
   * @returns 
   * @throws {UnavailablePastryError}
   */
  async create(orderInfo: OrderInfoDto): Promise<Order> {
    let pastryPromises: Promise<Pastry>[] = [];

    for (var i=0; i<orderInfo.productQuantities.length; i++) {
      let productQuantitiy = orderInfo.productQuantities[i];
      pastryPromises.push(this.pastryService.getPastry(productQuantitiy.productName));
    }

    let pastries: PromiseSettledResult<Pastry>[] = await Promise.allSettled(pastryPromises)
    for (var i=0; i<pastries.length; i++) {
      let pastry = pastries[i];
      if (pastry.status === 'fulfilled') {
        if (pastry.value.status != 'available') {
          throw new UnavailablePastryError("Pastry " + pastry.value.name + " is not available", pastry.value.name);
        }
      }
    }
    
    let result = new Order();
    result.customerId = orderInfo.customerId;
    result.productQuantities = orderInfo.productQuantities;
    result.totalPrice = orderInfo.totalPrice;

    // Persist and publish creation event.
    let orderEvent = new OrderEvent();
    orderEvent.timestamp = Date.now();
    orderEvent.order = result;
    orderEvent.changeReason = 'Creation';
    this.persistOrderEvent(orderEvent);
    this.orderEventPublisher.publishOrderCreated(orderEvent)

    return result;
  }

  /**
   * 
   * @param id 
   * @returns 
   * @throws {OrderNotFoundException}
   */
  getOrder(id: string): Order {
    let orderEvents = this.orderEventsRepository.get(id);
    if (orderEvents != undefined) {
      return orderEvents[orderEvents.length - 1].order;
    }
    throw new OrderNotFoundException(id);
  }

  updateReviewedOrder(event: OrderEvent): void {
    this.persistOrderEvent(event);
  }

  private persistOrderEvent(event: OrderEvent): void {
    let orderEvents = this.orderEventsRepository.get(event.order.id);
    if (orderEvents == undefined) {
      orderEvents = [];
    }
    orderEvents.push(event);
    this.orderEventsRepository.set(event.order.id, orderEvents);
  }
}
