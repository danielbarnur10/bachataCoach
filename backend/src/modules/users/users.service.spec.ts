import { UsersService } from './users.service';

describe('UsersService', () => {
  let repo: any;
  let service: UsersService;

  beforeEach(() => {
    repo = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };
    service = new UsersService(repo);
  });

  it('registers a user with hashed password and session token', async () => {
    repo.findOne.mockResolvedValue(null);
    repo.create.mockImplementation((data: any) => data);
    repo.save.mockImplementation(async (entity: any) => entity);

    const result = await service.register(
      'coach@example.com',
      'secret123',
      'Coach',
    );

    expect(result.user.email).toBe('coach@example.com');
    expect(result.user.displayName).toBe('Coach');
    expect(result.user.hasAgentApiKey).toBe(false);
    expect(result.token).toBeTruthy();
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'coach@example.com' }),
    );
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ passwordHash: expect.any(String) }),
    );
  });

  it('rejects duplicate emails', async () => {
    repo.findOne.mockResolvedValue({ id: 'existing' });

    await expect(
      service.register('coach@example.com', 'secret123'),
    ).rejects.toThrow('already exists');
  });

  it('rejects short passwords', async () => {
    await expect(
      service.register('coach@example.com', 'short'),
    ).rejects.toThrow('at least 8 characters');
  });
});
