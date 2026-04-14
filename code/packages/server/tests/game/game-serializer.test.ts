import { describe, it, expect } from 'vitest';
import {
  serializeSet,
  deserializeSet,
  serializeMap,
  deserializeMap,
  type GameSnapshot,
  type RoomSnapshot,
  type BotSnapshot,
  type SerializedContext,
  type TimerSnapshot,
} from '../../src/game/game-serializer.js';

describe('game-serializer', () => {
  describe('Set↔Array conversion', () => {
    it('round-trips a Set of strings', () => {
      const original = new Set(['north', 'south']);
      const serialized = serializeSet(original);
      expect(serialized).toEqual(['north', 'south']);
      const restored = deserializeSet<string>(serialized);
      expect(restored).toEqual(original);
    });

    it('handles empty Set', () => {
      const original = new Set<string>();
      expect(serializeSet(original)).toEqual([]);
      expect(deserializeSet<string>([])).toEqual(original);
    });
  });

  describe('Map↔Object conversion', () => {
    it('round-trips a Map with string keys', () => {
      const original = new Map<string, number>([['north', 3], ['south', 1]]);
      const serialized = serializeMap(original);
      expect(serialized).toEqual({ north: 3, south: 1 });
      const restored = deserializeMap<string, number>(serialized);
      expect(restored).toEqual(original);
    });

    it('round-trips a Map with number keys', () => {
      const original = new Map<number, string[]>([[1, ['a']], [2, ['b', 'c']]]);
      const serialized = serializeMap(original);
      const restored = deserializeMap<string, string[]>(serialized);
      // Keys come back as strings from JSON, caller converts if needed
      expect(restored.get('1')).toEqual(['a']);
      expect(restored.get('2')).toEqual(['b', 'c']);
    });

    it('handles empty Map', () => {
      const original = new Map<string, number>();
      expect(serializeMap(original)).toEqual({});
      expect(deserializeMap<string, number>({})).toEqual(original);
    });
  });
});
