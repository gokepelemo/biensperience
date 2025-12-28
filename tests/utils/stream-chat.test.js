const { syncChannelMembers } = require('../../utilities/stream-chat');

describe('Stream Chat utilities', () => {
  describe('syncChannelMembers', () => {
    it('adds new members with hide_history=false so they can see prior messages', async () => {
      const channel = {
        query: jest.fn().mockResolvedValue({
          members: [{ user_id: 'user_a' }]
        }),
        addMembers: jest.fn().mockResolvedValue({}),
        removeMembers: jest.fn().mockResolvedValue({})
      };

      await syncChannelMembers({
        channel,
        desiredMembers: ['user_a', 'user_b']
      });

      expect(channel.addMembers).toHaveBeenCalledTimes(1);
      expect(channel.addMembers).toHaveBeenCalledWith(['user_b'], {}, { hide_history: false });
      expect(channel.removeMembers).not.toHaveBeenCalled();
    });
  });
});
