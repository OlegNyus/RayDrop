import { describe, it, expect } from 'vitest';
import {
  REVIEW_COLORS,
  SIDEBAR_BADGE_COLORS,
  PRIORITY_COLORS,
  PRIORITY_ORDER,
} from '../../client/src/constants/colors';

describe('colors constants', () => {
  describe('REVIEW_COLORS', () => {
    it('has underReview color defined', () => {
      expect(REVIEW_COLORS.underReview).toBe('#3B82F6');
    });

    it('has xrayDraft color defined', () => {
      expect(REVIEW_COLORS.xrayDraft).toBe('#F97316');
    });

    it('has localDraft color defined', () => {
      expect(REVIEW_COLORS.localDraft).toBe('#F59E0B');
    });

    it('all colors are valid hex values', () => {
      const hexPattern = /^#[0-9A-Fa-f]{6}$/;
      Object.values(REVIEW_COLORS).forEach(color => {
        expect(color).toMatch(hexPattern);
      });
    });
  });

  describe('SIDEBAR_BADGE_COLORS', () => {
    it('has underReview badge colors', () => {
      expect(SIDEBAR_BADGE_COLORS.underReview.bg).toBe('bg-blue-100');
      expect(SIDEBAR_BADGE_COLORS.underReview.text).toBe('text-blue-700');
    });

    it('has xrayDraft badge colors', () => {
      expect(SIDEBAR_BADGE_COLORS.xrayDraft.bg).toBe('bg-red-100');
      expect(SIDEBAR_BADGE_COLORS.xrayDraft.text).toBe('text-red-700');
    });

    it('all badge colors are valid Tailwind classes', () => {
      const tailwindBgPattern = /^bg-\w+-\d+$/;
      const tailwindTextPattern = /^text-\w+-\d+$/;

      Object.values(SIDEBAR_BADGE_COLORS).forEach(badge => {
        expect(badge.bg).toMatch(tailwindBgPattern);
        expect(badge.text).toMatch(tailwindTextPattern);
      });
    });
  });

  describe('PRIORITY_COLORS', () => {
    it('has all priority levels defined', () => {
      expect(PRIORITY_COLORS).toHaveProperty('Highest');
      expect(PRIORITY_COLORS).toHaveProperty('High');
      expect(PRIORITY_COLORS).toHaveProperty('Medium');
      expect(PRIORITY_COLORS).toHaveProperty('Low');
      expect(PRIORITY_COLORS).toHaveProperty('Lowest');
    });

    it('has correct color for Highest priority', () => {
      expect(PRIORITY_COLORS.Highest).toBe('#DC2626');
    });

    it('has correct color for High priority', () => {
      expect(PRIORITY_COLORS.High).toBe('#EA580C');
    });

    it('has correct color for Medium priority', () => {
      expect(PRIORITY_COLORS.Medium).toBe('#F59E0B');
    });

    it('has correct color for Low priority', () => {
      expect(PRIORITY_COLORS.Low).toBe('#22C55E');
    });

    it('has correct color for Lowest priority', () => {
      expect(PRIORITY_COLORS.Lowest).toBe('#6B7280');
    });

    it('all colors are valid hex values', () => {
      const hexPattern = /^#[0-9A-Fa-f]{6}$/;
      Object.values(PRIORITY_COLORS).forEach(color => {
        expect(color).toMatch(hexPattern);
      });
    });
  });

  describe('PRIORITY_ORDER', () => {
    it('has all priority levels defined', () => {
      expect(PRIORITY_ORDER).toHaveProperty('Highest');
      expect(PRIORITY_ORDER).toHaveProperty('High');
      expect(PRIORITY_ORDER).toHaveProperty('Medium');
      expect(PRIORITY_ORDER).toHaveProperty('Low');
      expect(PRIORITY_ORDER).toHaveProperty('Lowest');
    });

    it('Highest has lowest order number (highest priority)', () => {
      expect(PRIORITY_ORDER.Highest).toBe(0);
    });

    it('Lowest has highest order number (lowest priority)', () => {
      expect(PRIORITY_ORDER.Lowest).toBe(4);
    });

    it('priorities are in correct order', () => {
      expect(PRIORITY_ORDER.Highest).toBeLessThan(PRIORITY_ORDER.High);
      expect(PRIORITY_ORDER.High).toBeLessThan(PRIORITY_ORDER.Medium);
      expect(PRIORITY_ORDER.Medium).toBeLessThan(PRIORITY_ORDER.Low);
      expect(PRIORITY_ORDER.Low).toBeLessThan(PRIORITY_ORDER.Lowest);
    });

    it('all order values are non-negative integers', () => {
      Object.values(PRIORITY_ORDER).forEach(order => {
        expect(Number.isInteger(order)).toBe(true);
        expect(order).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('consistency checks', () => {
    it('PRIORITY_COLORS and PRIORITY_ORDER have same keys', () => {
      const colorKeys = Object.keys(PRIORITY_COLORS).sort();
      const orderKeys = Object.keys(PRIORITY_ORDER).sort();
      expect(colorKeys).toEqual(orderKeys);
    });
  });
});
