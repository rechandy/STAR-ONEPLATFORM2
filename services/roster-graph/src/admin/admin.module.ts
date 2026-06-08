import { Module } from '@nestjs/common';
import { AuthzModule } from '../authz/authz.module';
import { AdminController } from './admin.controller';
import { ProvisioningService } from './provisioning.service';

@Module({
  imports: [AuthzModule],
  controllers: [AdminController],
  providers: [ProvisioningService],
})
export class AdminModule {}
