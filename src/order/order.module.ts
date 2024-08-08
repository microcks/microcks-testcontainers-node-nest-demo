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
        useFactory: async(configService: ConfigService) => ({
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
              allowAutoTopicCreation: true,
              metadataMaxAge: 100
            }  
          }
        }),
        inject: [ConfigService],
      }
    ])
    
    /*
    ClientsModule.register([
      {
        name: 'ORDER_SERVICE',
        transport: Transport.KAFKA,
        options: {
          client: {
            clientId: 'order-service',
            brokers: ['localhost:9092'],
          },
          consumer: {
            groupId: 'order-service'
          }
        }
      },
    ]),
    */
    
    ],
  controllers: [OrderController, OrderEventListener],
  providers: [OrderService, OrderEventPublisher],
})
export class OrderModule {}
