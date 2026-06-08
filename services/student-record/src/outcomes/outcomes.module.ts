import { Module } from '@nestjs/common';
import { AuthzModule } from '../authz/authz.module';
import { OutcomesController } from './outcomes.controller';
import { OutcomesService } from './outcomes.service';

@Module({
  imports: [AuthzModule],
  controllers: [OutcomesController],
  providers: [OutcomesService],
})
export class OutcomesModule {}
