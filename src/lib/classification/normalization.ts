import { AccountType, PaymentStatus } from '@/types';

/**
 * Normalization utilities for credit report ingestion and classification.
 * Strictly adheres to non-hallucination principles: missing or completely invalid
 * values are never fabricated or guessed.
 */

const VALID_ACCOUNT_TYPES: Record<string, AccountType> = {
  MORTGAGE: 'MORTGAGE',
  AUTO_LOAN: 'AUTO_LOAN',
  AUTO: 'AUTO_LOAN',
  AUTOLOAN: 'AUTO_LOAN',
  CREDIT_CARD: 'CREDIT_CARD',
  CARD: 'CREDIT_CARD',
  CREDITCARD: 'CREDIT_CARD',
  PERSONAL_LOAN: 'PERSONAL_LOAN',
  PERSONAL: 'PERSONAL_LOAN',
  PERSONALLOAN: 'PERSONAL_LOAN',
  STUDENT_LOAN: 'STUDENT_LOAN',
  STUDENT: 'STUDENT_LOAN',
  STUDENTLOAN: 'STUDENT_LOAN',
  REVOLVING: 'REVOLVING',
  COLLECTIONS: 'COLLECTIONS',
  COLLECTION: 'COLLECTIONS',
};

const VALID_PAYMENT_STATUSES: Record<string, PaymentStatus> = {
  CURRENT: 'CURRENT',
  OK: 'CURRENT',
  PAID_AS_AGREED: 'CURRENT',
  LATE_30: 'LATE_30',
  '30_DAYS_LATE': 'LATE_30',
  '30_DAYS_PAST_DUE': 'LATE_30',
  LATE30: 'LATE_30',
  LATE_60: 'LATE_60',
  '60_DAYS_LATE': 'LATE_60',
  '60_DAYS_PAST_DUE': 'LATE_60',
  LATE60: 'LATE_60',
  LATE_90: 'LATE_90',
  '90_DAYS_LATE': 'LATE_90',
  '90_DAYS_PAST_DUE': 'LATE_90',
  LATE90: 'LATE_90',
  CHARGE_OFF: 'CHARGE_OFF',
  CHARGEOFF: 'CHARGE_OFF',
  CHARGED_OFF: 'CHARGE_OFF',
  COLLECTIONS: 'COLLECTIONS',
  COLLECTION: 'COLLECTIONS',
};

/**
 * Normalizes account type string to authoritative AccountType union.
 * Returns null if unrecognized.
 */
export function normalizeAccountType(raw: unknown): AccountType | null {
  if (typeof raw !== 'string') return null;
  const cleaned = raw.trim().toUpperCase().replace(/[\s-]+/g, '_');
  return VALID_ACCOUNT_TYPES[cleaned] || null;
}

/**
 * Normalizes payment status string to authoritative PaymentStatus union.
 * Returns null if unrecognized.
 */
export function normalizePaymentStatus(raw: unknown): PaymentStatus | null {
  if (typeof raw !== 'string') return null;
  const cleaned = raw.trim().toUpperCase().replace(/[\s-]+/g, '_');
  return VALID_PAYMENT_STATUSES[cleaned] || null;
}

/**
 * Normalizes currency and balance representations.
 * Handles strings like "$24,500.00", " 1850 ", 1850.
 * Returns non-negative number, or NaN if unparseable.
 */
export function normalizeBalance(raw: unknown): number {
  if (typeof raw === 'number') {
    return Number.isFinite(raw) && raw >= 0 ? Math.round(raw * 100) / 100 : NaN;
  }
  if (typeof raw !== 'string') {
    return NaN;
  }
  const cleaned = raw.trim().replace(/[$,\s]/g, '');
  if (cleaned === '') return NaN;
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed) || parsed < 0) return NaN;
  return Math.round(parsed * 100) / 100;
}

/**
 * Normalizes dates to strict ISO YYYY-MM-DD.
 * Supports:
 *  - YYYY-MM-DD
 *  - YYYY-MM-DDTHH:mm:ss...
 *  - MM/DD/YYYY or M/D/YYYY
 *  - YYYY/MM/DD
 * Returns null if input is empty or invalid. Does not invent dates.
 */
export function normalizeDate(raw: unknown): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Pattern 1: ISO date prefix YYYY-MM-DD
  const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    const y = parseInt(isoMatch[1], 10);
    const m = parseInt(isoMatch[2], 10);
    const d = parseInt(isoMatch[3], 10);
    if (isValidDate(y, m, d)) {
      return `${y.toString().padStart(4, '0')}-${m.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
    }
    return null;
  }

  // Pattern 2: US style MM/DD/YYYY
  const usMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (usMatch) {
    const m = parseInt(usMatch[1], 10);
    const d = parseInt(usMatch[2], 10);
    const y = parseInt(usMatch[3], 10);
    if (isValidDate(y, m, d)) {
      return `${y.toString().padStart(4, '0')}-${m.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
    }
    return null;
  }

  // Pattern 3: YYYY/MM/DD
  const slashMatch = trimmed.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})/);
  if (slashMatch) {
    const y = parseInt(slashMatch[1], 10);
    const m = parseInt(slashMatch[2], 10);
    const d = parseInt(slashMatch[3], 10);
    if (isValidDate(y, m, d)) {
      return `${y.toString().padStart(4, '0')}-${m.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
    }
    return null;
  }

  return null;
}

function isValidDate(year: number, month: number, day: number): boolean {
  if (year < 1900 || year > 2100) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/**
 * Normalizes creditor name: trims, collapses internal whitespace.
 */
export function normalizeCreditorName(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw.trim().replace(/\s+/g, ' ');
}

/**
 * Normalizes account reference: trims, collapses whitespace, ensures standard casing.
 */
export function normalizeAccountReference(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw.trim().replace(/\s+/g, '-').toUpperCase();
}
