/// <reference types="jest" />

import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should send the landing page file', () => {
      const response = {
        sendFile: jest.fn(),
      } as any;

      appController.getHello(response);

      expect(response.sendFile).toHaveBeenCalledWith('index.html', {
        root: 'src/public',
      });
    });
  });
});
