import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateTeacherDto {
  @IsString()
  @IsNotEmpty()
  givenName!: string;

  @IsString()
  @IsNotEmpty()
  familyName!: string;

  @IsString()
  @IsNotEmpty()
  schoolOrgId!: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}

export class CreateStudentDto {
  @IsString()
  @IsNotEmpty()
  givenName!: string;

  @IsString()
  @IsNotEmpty()
  familyName!: string;

  @IsString()
  @IsNotEmpty()
  grade!: string;

  @IsString()
  @IsNotEmpty()
  schoolOrgId!: string;

  @IsOptional()
  @IsString()
  diagnosis?: string;
}

export class CreateParentDto {
  @IsString()
  @IsNotEmpty()
  givenName!: string;

  @IsString()
  @IsNotEmpty()
  familyName!: string;

  /** The student (User id) this guardian is linked to. */
  @IsString()
  @IsNotEmpty()
  studentId!: string;

  @IsOptional()
  @IsString()
  relation?: string;
}
