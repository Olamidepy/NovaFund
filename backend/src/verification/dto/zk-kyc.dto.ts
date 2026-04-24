import { IsString, IsEnum, IsOptional } from 'class-validator';

export class InitiateZkKycDto {
  @IsEnum(['violet', 'galxe'])
  provider: 'violet' | 'galxe';
}

export class CompleteZkKycDto {
  @IsString()
  sessionId: string;

  @IsString()
  proofData: string;

  @IsOptional()
  @IsString()
  publicInputs?: string;
}

export class ZkKycStatusDto {
  @IsString()
  userId: string;
}