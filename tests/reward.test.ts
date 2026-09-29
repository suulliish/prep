import { describe, it, expect, vi } from 'vitest';
vi.mock('../src/lib/audio', () => ({ audio: { play: () => {} } }));
import { showReward, acceptReward, rewardUI } from '../src/lib/reward.svelte';

describe('плашка награды', () => {
  it('нулевую награду не показываем, промис сразу готов', async () => {
    await showReward({ minutes: 0, title: 'x' });
    expect(rewardUI.cur).toBeNull();
  });
  it('награды идут по очереди, каждая ждёт «Қабылдау»', async () => {
    const order: number[] = [];
    const a = showReward({ minutes: 10, title: 'a' }).then(() => order.push(10));
    const b = showReward({ minutes: 15, title: 'b' }).then(() => order.push(15));
    expect(rewardUI.cur?.minutes).toBe(10);
    acceptReward(); await a;
    expect(rewardUI.cur?.minutes).toBe(15);
    expect(order).toEqual([10]);
    acceptReward(); await b;
    expect(rewardUI.cur).toBeNull();
    expect(order).toEqual([10, 15]);
  });
});
