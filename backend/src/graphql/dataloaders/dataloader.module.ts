import { Global, Module } from '@nestjs/common';
import { DataLoaderFactory } from './dataloader.factory';

@Global()
@Module({
  providers: [DataLoaderFactory],
  exports: [DataLoaderFactory],
})
export class DataLoaderModule {}
