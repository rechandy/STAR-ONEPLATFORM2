import { IsOptional, IsString } from 'class-validator';

/**
 * Assign a curriculum objective (optionally a specific lesson) to EITHER a class
 * or a single student. Exactly one of `classId` / `studentId` must be set
 * (validated in the service).
 */
export class CreateAssignmentDto {
  @IsString()
  objectiveId!: string;

  @IsOptional()
  @IsString()
  lessonId?: string;

  @IsOptional()
  @IsString()
  classId?: string;

  @IsOptional()
  @IsString()
  studentId?: string;
}
