/**
 * Planning Time Utilities - Unit Tests
 */

import {
  formatPlanningTime,
  formatPlanningTimeWithLabel,
  getPlanningTimeTooltip,
  getPlanningTimeLabel,
  convertToDays,
  parsePlanningTime
} from './planning-time-utils';

describe('formatPlanningTime', () => {
  describe('invalid inputs', () => {
    test('returns null for null input', () => {
      expect(formatPlanningTime(null)).toBeNull();
    });

    test('returns null for undefined input', () => {
      expect(formatPlanningTime(undefined)).toBeNull();
    });

    test('returns null for empty string', () => {
      expect(formatPlanningTime('')).toBeNull();
    });

    test('returns null for zero', () => {
      expect(formatPlanningTime(0)).toBeNull();
    });

    test('returns null for negative numbers', () => {
      expect(formatPlanningTime(-1)).toBeNull();
      expect(formatPlanningTime(-100)).toBeNull();
    });

    test('returns null for NaN', () => {
      expect(formatPlanningTime(NaN)).toBeNull();
    });

    test('returns null for non-numeric strings', () => {
      expect(formatPlanningTime('abc')).toBeNull();
    });

    test('handles numeric strings', () => {
      expect(formatPlanningTime('7')).toBe('1 week');
      expect(formatPlanningTime('1')).toBe('1 day');
    });
  });

  describe('fractional days (< 1 day)', () => {
    test('formats 0.25 days as "a few hours"', () => {
      expect(formatPlanningTime(0.25)).toBe('a few hours');
    });

    test('formats 0.1 days as "a few hours"', () => {
      expect(formatPlanningTime(0.1)).toBe('a few hours');
    });

    test('formats 0.5 days as "about half a day"', () => {
      expect(formatPlanningTime(0.5)).toBe('about half a day');
    });

    test('formats 0.4 days as "about half a day"', () => {
      expect(formatPlanningTime(0.4)).toBe('about half a day');
    });

    test('formats 0.75 days as "most of a day"', () => {
      expect(formatPlanningTime(0.75)).toBe('most of a day');
    });

    test('formats 0.9 days as "most of a day"', () => {
      expect(formatPlanningTime(0.9)).toBe('most of a day');
    });
  });

  describe('days (1-6)', () => {
    test('formats 1 day correctly', () => {
      expect(formatPlanningTime(1)).toBe('1 day');
    });

    test('formats 1.5 days as "1-2 days"', () => {
      expect(formatPlanningTime(1.5)).toBe('1-2 days');
    });

    test('formats 2 days correctly', () => {
      expect(formatPlanningTime(2)).toBe('2 days');
    });

    test('formats 3 days correctly', () => {
      expect(formatPlanningTime(3)).toBe('3 days');
    });

    test('formats 5 days correctly', () => {
      expect(formatPlanningTime(5)).toBe('5 days');
    });

    test('formats 6 days correctly', () => {
      expect(formatPlanningTime(6)).toBe('6 days');
    });

    test('rounds fractional days (2.7 -> 3)', () => {
      expect(formatPlanningTime(2.7)).toBe('3 days');
    });
  });

  describe('weeks (7-27 days)', () => {
    test('formats 7 days as "1 week"', () => {
      expect(formatPlanningTime(7)).toBe('1 week');
    });

    test('formats 8 days as "1 week"', () => {
      expect(formatPlanningTime(8)).toBe('1 week');
    });

    test('formats 10 days as "about 1-2 weeks"', () => {
      expect(formatPlanningTime(10)).toBe('about 1-2 weeks');
    });

    test('formats 14 days as "2 weeks"', () => {
      expect(formatPlanningTime(14)).toBe('2 weeks');
    });

    test('formats 17 days as "about 2-3 weeks"', () => {
      expect(formatPlanningTime(17)).toBe('about 2-3 weeks');
    });

    test('formats 21 days as "3 weeks"', () => {
      expect(formatPlanningTime(21)).toBe('3 weeks');
    });

    test('formats 25 days as "about 3-4 weeks"', () => {
      expect(formatPlanningTime(25)).toBe('about 3-4 weeks');
    });
  });

  describe('months (28-334 days)', () => {
    test('formats 30 days as "1 month"', () => {
      expect(formatPlanningTime(30)).toBe('1 month');
    });

    test('formats 35 days as "1 month"', () => {
      expect(formatPlanningTime(35)).toBe('1 month');
    });

    test('formats 45 days as "1-2 months"', () => {
      expect(formatPlanningTime(45)).toBe('1-2 months');
    });

    test('formats 60 days as "2 months"', () => {
      expect(formatPlanningTime(60)).toBe('2 months');
    });

    test('formats 90 days as "3 months"', () => {
      expect(formatPlanningTime(90)).toBe('3 months');
    });

    test('formats 120 days as "4 months"', () => {
      expect(formatPlanningTime(120)).toBe('4 months');
    });

    test('formats 150 days as "5 months"', () => {
      expect(formatPlanningTime(150)).toBe('5 months');
    });

    test('formats 180 days as "6 months"', () => {
      expect(formatPlanningTime(180)).toBe('6 months');
    });

    test('formats 270 days as "9 months"', () => {
      expect(formatPlanningTime(270)).toBe('9 months');
    });

    test('formats 330 days as "11 months"', () => {
      expect(formatPlanningTime(330)).toBe('11 months');
    });
  });

  describe('years (335+ days)', () => {
    test('formats 365 days as "1 year"', () => {
      expect(formatPlanningTime(365)).toBe('1 year');
    });

    test('formats 400 days as "1 year"', () => {
      expect(formatPlanningTime(400)).toBe('1 year');
    });

    test('formats 500 days as "1-2 years"', () => {
      expect(formatPlanningTime(500)).toBe('1-2 years');
    });

    test('formats 730 days as "2 years"', () => {
      expect(formatPlanningTime(730)).toBe('2 years');
    });

    test('formats 800 days as "2-3 years"', () => {
      expect(formatPlanningTime(800)).toBe('2-3 years');
    });

    test('formats 1095 days as "3 years"', () => {
      expect(formatPlanningTime(1095)).toBe('3 years');
    });

    test('formats 1500 days as "4 years"', () => {
      expect(formatPlanningTime(1500)).toBe('4 years');
    });

    test('formats 3650 days as "10 years"', () => {
      expect(formatPlanningTime(3650)).toBe('10 years');
    });
  });
});

describe('formatPlanningTimeWithLabel', () => {
  test('returns formatted time without label by default', () => {
    expect(formatPlanningTimeWithLabel(7)).toBe('1 week');
  });

  test('returns formatted time with label when includeLabel is true', () => {
    expect(formatPlanningTimeWithLabel(7, { includeLabel: true })).toBe('Planning Time: 1 week');
  });

  test('returns null for invalid input', () => {
    expect(formatPlanningTimeWithLabel(null)).toBeNull();
    expect(formatPlanningTimeWithLabel(null, { includeLabel: true })).toBeNull();
  });
});

describe('getPlanningTimeTooltip', () => {
  test('returns tooltip text', () => {
    const tooltip = getPlanningTimeTooltip();
    expect(tooltip).toContain('plan and prepare');
    expect(tooltip).toContain('Does not include travel time');
  });
});

describe('getPlanningTimeLabel', () => {
  test('returns label text', () => {
    expect(getPlanningTimeLabel()).toBe('Planning Time');
  });
});

describe('convertToDays', () => {
  test('converts hours to days', () => {
    expect(convertToDays(12, 'hours')).toBe(0.5);
    expect(convertToDays(24, 'hours')).toBe(1);
    expect(convertToDays(6, 'hours')).toBe(0.25);
  });

  test('keeps days as days', () => {
    expect(convertToDays(5, 'days')).toBe(5);
    expect(convertToDays(1, 'days')).toBe(1);
  });

  test('converts weeks to days', () => {
    expect(convertToDays(1, 'weeks')).toBe(7);
    expect(convertToDays(2, 'weeks')).toBe(14);
  });

  test('converts months to days', () => {
    expect(convertToDays(1, 'months')).toBe(30);
    expect(convertToDays(6, 'months')).toBe(180);
  });

  test('converts years to days', () => {
    expect(convertToDays(1, 'years')).toBe(365);
    expect(convertToDays(2, 'years')).toBe(730);
  });

  test('returns 0 for invalid input', () => {
    expect(convertToDays(NaN, 'days')).toBe(0);
    expect(convertToDays('abc', 'days')).toBe(0);
  });

  test('assumes days for unknown unit', () => {
    expect(convertToDays(5, 'unknown')).toBe(5);
  });
});

describe('parsePlanningTime', () => {
  test('parses special cases', () => {
    expect(parsePlanningTime('a few hours')).toBe(0.25);
    expect(parsePlanningTime('about half a day')).toBe(0.5);
    expect(parsePlanningTime('most of a day')).toBe(0.75);
  });

  test('parses single day values', () => {
    expect(parsePlanningTime('1 day')).toBe(1);
    expect(parsePlanningTime('5 days')).toBe(5);
  });

  test('parses week values', () => {
    expect(parsePlanningTime('1 week')).toBe(7);
    expect(parsePlanningTime('2 weeks')).toBe(14);
  });

  test('parses month values', () => {
    expect(parsePlanningTime('1 month')).toBe(30);
    expect(parsePlanningTime('6 months')).toBe(180);
  });

  test('parses year values', () => {
    expect(parsePlanningTime('1 year')).toBe(365);
    expect(parsePlanningTime('2 years')).toBe(730);
  });

  test('parses range values (returns midpoint)', () => {
    expect(parsePlanningTime('1-2 days')).toBe(1.5);
    expect(parsePlanningTime('1-2 weeks')).toBe(10.5);
    expect(parsePlanningTime('1-2 months')).toBe(45);
  });

  test('parses "about X-Y" format', () => {
    expect(parsePlanningTime('about 1-2 weeks')).toBe(10.5);
    expect(parsePlanningTime('about 2-3 weeks')).toBe(17.5);
  });

  test('returns null for invalid input', () => {
    expect(parsePlanningTime(null)).toBeNull();
    expect(parsePlanningTime('')).toBeNull();
    expect(parsePlanningTime('invalid')).toBeNull();
  });

  test('is case-insensitive', () => {
    expect(parsePlanningTime('A Few Hours')).toBe(0.25);
    expect(parsePlanningTime('1 WEEK')).toBe(7);
  });
});
