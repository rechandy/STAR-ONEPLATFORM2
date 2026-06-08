import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { Action } from '@oneplatform/authz';
import { AuthzService } from './authz.service';

export const STUDENT_ACTION_KEY = 'student_action';

/** Declares which Cedar action a guarded handler enforces (defaults to view). */
export const StudentAction = (action: Action) => SetMetadata(STUDENT_ACTION_KEY, action);

/**
 * Enforces Cedar student-access policies on routes carrying a `:studentId`
 * param. Denies (403) unless the acting staff member is authorized for that
 * student under the requested action.
 */
@Injectable()
export class StudentAccessGuard implements CanActivate {
  constructor(
    private readonly authz: AuthzService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request>();
    const tenantId = req.tenantId;
    const staffId = req.header('x-user-id');
    const rawStudentId = req.params.studentId;
    const studentId = Array.isArray(rawStudentId) ? rawStudentId[0] : rawStudentId;

    if (!tenantId) throw new ForbiddenException('Missing tenant context (x-tenant-id).');
    if (!staffId) throw new UnauthorizedException('Missing staff identity (x-user-id).');
    if (!studentId) throw new ForbiddenException('Missing student id.');

    const action = this.reflector.get<Action>(STUDENT_ACTION_KEY, ctx.getHandler()) ?? 'viewStudent';
    const allowed = await this.authz.canAccessStudent(tenantId, staffId, action, studentId);
    if (!allowed) {
      throw new ForbiddenException(`Not authorized to ${action} for student ${studentId}.`);
    }
    return true;
  }
}
