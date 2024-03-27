import { Order } from "../entities/order.entity"

export class OrderEvent {
  timestamp: number
  order: Order
  changeReason: string
}