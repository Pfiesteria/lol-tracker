import { Test, TestingModule } from '@nestjs/testing';
import { MatchSyncService } from './match-sync.service';

describe('MatchSyncService', () => {
  let service: MatchSyncService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MatchSyncService],
    }).compile();

    service = module.get<MatchSyncService>(MatchSyncService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
