import { describe, it, expect } from 'vitest';
import {
  calculateROAS,
  calculateCPA,
  calculateAOV,
  calculateCTR,
  calculateCPC,
  calculateCPM,
  calculateFrequency,
  calculateConversionRate,
} from '../../apps/backend/utils/kpis.js';

describe('kpis', () => {
  it('calculateROAS divides revenue by spend and rounds to 2 decimals', () => {
    expect(calculateROAS(450.3, 120.5)).toBe(3.74);
  });

  it('calculateROAS returns 0 when spend is 0', () => {
    expect(calculateROAS(100, 0)).toBe(0);
  });

  it('calculateCPA divides spend by conversions', () => {
    expect(calculateCPA(120.5, 8)).toBe(15.06);
  });

  it('calculateCPA returns 0 when conversions is 0', () => {
    expect(calculateCPA(120.5, 0)).toBe(0);
  });

  it('calculateAOV divides revenue by orders', () => {
    expect(calculateAOV(640, 8)).toBe(80);
  });

  it('calculateAOV returns 0 when orders is 0', () => {
    expect(calculateAOV(640, 0)).toBe(0);
  });

  it('calculateCTR returns percentage of clicks over impressions', () => {
    expect(calculateCTR(320, 15000)).toBe(2.13);
  });

  it('calculateCTR returns 0 when impressions is 0', () => {
    expect(calculateCTR(10, 0)).toBe(0);
  });

  it('calculateCPC divides spend by clicks', () => {
    expect(calculateCPC(120.5, 320)).toBe(0.38);
  });

  it('calculateCPC returns 0 when clicks is 0', () => {
    expect(calculateCPC(120.5, 0)).toBe(0);
  });

  it('calculateCPM computes cost per thousand impressions', () => {
    expect(calculateCPM(120.5, 15000)).toBe(8.03);
  });

  it('calculateCPM returns 0 when impressions is 0', () => {
    expect(calculateCPM(120.5, 0)).toBe(0);
  });

  it('calculateFrequency divides impressions by reach', () => {
    expect(calculateFrequency(15000, 9800)).toBe(1.53);
  });

  it('calculateFrequency returns 0 when reach is 0', () => {
    expect(calculateFrequency(15000, 0)).toBe(0);
  });

  it('calculateConversionRate returns percentage of orders over clicks', () => {
    expect(calculateConversionRate(6, 320)).toBe(1.88);
  });

  it('calculateConversionRate returns 0 when clicks is 0', () => {
    expect(calculateConversionRate(6, 0)).toBe(0);
  });

  it('all KPI functions return a Number, not a string', () => {
    expect(typeof calculateROAS(10, 5)).toBe('number');
    expect(typeof calculateCPA(10, 5)).toBe('number');
    expect(typeof calculateAOV(10, 5)).toBe('number');
    expect(typeof calculateCTR(10, 5)).toBe('number');
    expect(typeof calculateCPC(10, 5)).toBe('number');
    expect(typeof calculateCPM(10, 5)).toBe('number');
    expect(typeof calculateFrequency(10, 5)).toBe('number');
    expect(typeof calculateConversionRate(10, 5)).toBe('number');
  });
});
