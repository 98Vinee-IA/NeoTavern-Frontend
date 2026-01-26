import { expect, test } from 'vitest';
import { mergeWithUndefined, mergeWithUndefinedMulti, StringHash } from '../src/utils/commons';

test('StringHash.legacy() is backward compatible', () => {
  expect(StringHash.legacy(Symbol.for('not a string') as unknown as string)).toBe(0);
  expect(StringHash.legacy('')).toBe(3338908027751811);
  expect(StringHash.legacy('Hello, World')).toBe(1971292682390211);
  expect(StringHash.legacy('🇵🇱')).toBe(8243241217663890);
});

test('StringHash.get() produces consistent 64-bit hash strings', () => {
  expect(StringHash.get(Symbol.for('not a string') as unknown as string)).toBe('00000000000000');
  expect(StringHash.get('')).toBe('0k4n83c07h0j2b');
  expect(StringHash.get('Hello, World')).toBe('0xuwau90ofttqb');
  expect(StringHash.get('🇵🇱')).toBe('0ft91kf0b9b53m');
});

test('mergeWithUndefined replaces arrays', () => {
  const target = { items: [1, 2, 3], name: 'test' };
  const source = { items: [] };
  const result = mergeWithUndefined(target, source);
  expect(result.items).toEqual([]);
  expect(result.name).toBe('test');
});

test('mergeWithUndefined handles undefined values', () => {
  const target = { a: 1, b: 2 };
  const source = { b: undefined };
  const result = mergeWithUndefined(target, source);
  expect(result.a).toBe(1);
  expect(result.b).toBeUndefined();
  expect('b' in result).toBe(true);
  expect(result.b).toBeUndefined();
});

test('mergeWithUndefined handles null values', () => {
  const target = { a: 1, b: 2 };
  const source = { b: null };
  const result = mergeWithUndefined(target, source);
  expect(result.b).toBeNull();
});

test('mergeWithUndefined deeply merges plain objects', () => {
  const target = { nested: { a: 1, b: 2 }, value: 'old' };
  const source = { nested: { b: 3, c: 4 }, value: 'new' };
  const result = mergeWithUndefined(target, source);
  expect(result.nested).toEqual({ a: 1, b: 3, c: 4 });
  expect(result.value).toBe('new');
});

test('mergeWithUndefined replaces nested arrays', () => {
  const target = { data: { items: [1, 2, 3] } };
  const source = { data: { items: [4, 5] } };
  const result = mergeWithUndefined(target, source);
  expect(result.data.items).toEqual([4, 5]);
});

test('mergeWithUndefinedMulti merges multiple sources', () => {
  const target = { a: 1 };
  const source1 = { b: 2 };
  const source2 = { c: 3 };
  const result = mergeWithUndefinedMulti(target, source1, source2);
  expect(result).toEqual({ a: 1, b: 2, c: 3 });
});

test('mergeWithUndefinedMulti prioritizes later sources', () => {
  const target = { value: 'original' };
  const source1 = { value: 'first' };
  const source2 = { value: 'second' };
  const result = mergeWithUndefinedMulti(target, source1, source2);
  expect(result.value).toBe('second');
});

test('mergeWithUndefinedMulti handles array replacement in multi-source merge', () => {
  const target = { items: [1, 2, 3] };
  const source1 = { items: [4, 5] };
  const source2 = { items: [] };
  const result = mergeWithUndefinedMulti(target, source1, source2);
  expect(result.items).toEqual([]);
});

test('mergeWithUndefinedMulti preserves non-overlapping properties', () => {
  const target = { a: 1, nested: { x: 10 } };
  const source1 = { b: 2, nested: { y: 20 } };
  const source2 = { c: 3, nested: { z: 30 } };
  const result = mergeWithUndefinedMulti(target, source1, source2);
  expect(result).toEqual({
    a: 1,
    b: 2,
    c: 3,
    nested: { x: 10, y: 20, z: 30 },
  });
});

test('mergeWithUndefined handles Date objects by replacing', () => {
  const date1 = new Date('2024-01-01');
  const date2 = new Date('2024-12-31');
  const target = { timestamp: date1 };
  const source = { timestamp: date2 };
  const result = mergeWithUndefined(target, source);
  expect(result.timestamp).toBe(date2);
});
