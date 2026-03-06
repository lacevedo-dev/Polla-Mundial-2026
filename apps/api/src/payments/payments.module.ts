import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { BoldService } from './bold.service';

@Module({
    imports: [PrismaModule],
    providers: [PaymentsService, BoldService],
    controllers: [PaymentsController],
    exports: [PaymentsService],
})
export class PaymentsModule { }
