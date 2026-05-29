import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowUpRight,
  Banknote,
  CalendarCheck,
  Check,
  CreditCard,
  Download,
  FileSpreadsheet,
  KeyRound,
  Landmark,
  LockKeyhole,
  RefreshCw,
  ReceiptText,
  Search,
  Settings,
  ShieldCheck,
  Trash2,
  Upload,
  Users,
  X,
  Zap
} from 'lucide-react';
import * as FirebaseSDK from '../services/firebase';
import { db, functions, isFirebaseConfigured } from '../services/firebase';

const gatewayCards = [
  {
    id: 'stripe',
    name: 'Stripe',
    region: 'International',
    icon: CreditCard,
    logo: '/payment-logos/stripe.png',
    note: 'Global cards, Apple Pay, Google Pay, and checkout sessions.',
    fields: [
      { key: 'publishableKey', label: 'Publishable key', type: 'text' },
      { key: 'secretKey', label: 'Secret key', type: 'password' },
      { key: 'webhookSecret', label: 'Webhook signing secret', type: 'password' }
    ]
  },
  {
    id: 'payfast',
    name: 'Payfast',
    region: 'South Africa',
    icon: Zap,
    logo: '/payment-logos/payfast.png',
    note: 'Fast local checkout for cards, EFT, and popular South African payment flows.',
    fields: [
      { key: 'merchantId', label: 'Merchant ID', type: 'text' },
      { key: 'merchantKey', label: 'Merchant key', type: 'password' },
      { key: 'passphrase', label: 'Passphrase', type: 'password' }
    ]
  },
  {
    id: 'yoco',
    name: 'Yoco',
    region: 'South Africa',
    icon: CreditCard,
    logo: '/payment-logos/yoco.webp',
    note: 'Local card checkout with clean hosted payment links.',
    fields: [
      { key: 'publicKey', label: 'Public key', type: 'text' },
      { key: 'secretKey', label: 'Secret key', type: 'password' },
      { key: 'webhookSecret', label: 'Webhook secret', type: 'password' }
    ]
  },
  {
    id: 'ozow',
    name: 'Ozow',
    region: 'South Africa',
    icon: Landmark,
    logo: '/payment-logos/ozow.png',
    note: 'Instant EFT-style bank payments with signed payment URLs.',
    fields: [
      { key: 'siteCode', label: 'Site code', type: 'text' },
      { key: 'privateKey', label: 'Private key', type: 'password' },
      { key: 'apiKey', label: 'API key', type: 'password' }
    ]
  },
  {
    id: 'paystack',
    name: 'Paystack',
    region: 'Africa',
    icon: ShieldCheck,
    logo: '/payment-logos/paystack.png',
    note: 'Reliable card payments with clean initialization and webhooks.',
    fields: [
      { key: 'publicKey', label: 'Public key', type: 'text' },
      { key: 'secretKey', label: 'Secret key', type: 'password' }
    ]
  },
  {
    id: 'manual_eft',
    name: 'Manual EFT',
    region: 'South Africa',
    icon: Landmark,
    note: 'Show your bank details to clients and ask them to use their booking ID as the payment reference.',
    fields: [
      { key: 'accountHolder', label: 'Account holder', type: 'text' },
      { key: 'bankName', label: 'Bank name', type: 'text' },
      { key: 'accountNumber', label: 'Account number', type: 'text' },
      { key: 'branchCode', label: 'Branch code', type: 'text' },
      { key: 'accountType', label: 'Account type', type: 'text' },
      { key: 'instructions', label: 'Client instructions', type: 'textarea' }
    ]
  },
  {
    id: 'cash',
    name: 'Cash',
    region: 'Manual',
    icon: Banknote,
    note: 'Let clients choose cash and keep the booking unpaid until your team marks it paid.',
    fields: [
      { key: 'instructions', label: 'Client instructions', type: 'textarea' }
    ]
  }
];

const gatewayById = gatewayCards.reduce((acc, gateway) => {
  acc[gateway.id] = gateway;
  return acc;
}, {});

const cardGatewayIds = new Set(['stripe', 'payfast', 'yoco', 'paystack', 'ozow']);

const GatewayLogo = ({ gateway, className = '' }) => {
  const Icon = gateway?.icon || CreditCard;
  if (gateway?.logo) {
    return <img src={gateway.logo} alt="" className={`finance-gateway-logo ${className}`} loading="lazy" />;
  }
  return <Icon size={18} />;
};

const currencyOptions = [
  { code: 'ZAR', label: 'South African rand', locale: 'en-ZA' },
  { code: 'USD', label: 'US dollar', locale: 'en-US' },
  { code: 'GBP', label: 'British pound', locale: 'en-GB' },
  { code: 'EUR', label: 'Euro', locale: 'en-IE' },
  { code: 'AUD', label: 'Australian dollar', locale: 'en-AU' },
  { code: 'CAD', label: 'Canadian dollar', locale: 'en-CA' },
  { code: 'NGN', label: 'Nigerian naira', locale: 'en-NG' },
  { code: 'KES', label: 'Kenyan shilling', locale: 'en-KE' },
  { code: 'BWP', label: 'Botswana pula', locale: 'en-BW' }
];

const currencyOptionByCode = currencyOptions.reduce((acc, option) => {
  acc[option.code] = option;
  return acc;
}, {});

const emptyDrafts = gatewayCards.reduce((acc, gateway) => {
  acc[gateway.id] = {
    enabled: false,
    mode: 'test',
    credentials: gateway.fields.reduce((fields, field) => {
      fields[field.key] = '';
      return fields;
    }, {})
  };
  return acc;
}, {});

const guestDemoGatewaySettings = {
  stripe: {
    enabled: true,
    mode: 'demo',
    public: {}
  },
  payfast: {
    enabled: true,
    mode: 'demo',
    public: {}
  },
  manual_eft: {
    enabled: true,
    mode: 'demo',
    public: {
      accountHolder: 'Jump Studios',
      bankName: 'Demo Global Bank',
      accountNumber: '000 555 2026',
      branchCode: '000000',
      accountType: 'Business Current',
      instructions: 'Use your booking ID as the payment reference so the coaching team can match it to your session.'
    }
  },
  cash: {
    enabled: false,
    mode: 'demo',
    public: {
      instructions: 'Cash is disabled for this online academy demo.'
    }
  },
  yoco: {
    enabled: true,
    mode: 'demo',
    public: {}
  },
  paystack: {
    enabled: true,
    mode: 'demo',
    public: {}
  },
  ozow: {
    enabled: true,
    mode: 'demo',
    public: {}
  }
};

const startOfDay = (date) => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

const getWeekStart = (date) => {
  const next = startOfDay(date);
  const day = next.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  next.setDate(next.getDate() + diff);
  return next;
};

const getMonthStart = (date) => new Date(date.getFullYear(), date.getMonth(), 1);

const getYearStart = (date) => new Date(date.getFullYear(), 0, 1);

const addDays = (date, days) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const addMonths = (date, months) => {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months, 1);
  next.setHours(0, 0, 0, 0);
  return next;
};

const dateToMs = (value) => {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  if (value?.toMillis) return value.toMillis();
  if (value?.seconds) return value.seconds * 1000;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const formatMoney = (amountInCents = 0, currency = 'ZAR') => {
  const amount = Math.max(0, Math.round(Number(amountInCents) || 0)) / 100;
  const option = currencyOptionByCode[currency] || currencyOptionByCode.ZAR;
  try {
    return new Intl.NumberFormat(option.locale, {
      style: 'currency',
      currency: option.code,
      maximumFractionDigits: amount % 1 ? 2 : 0
    }).format(amount);
  } catch {
    return `${option.code} ${amount.toFixed(amount % 1 ? 2 : 0)}`;
  }
};

const formatCompactMoney = (amountInCents = 0, currency = 'ZAR') => {
  const amount = Math.max(0, Math.round(Number(amountInCents) || 0)) / 100;
  const option = currencyOptionByCode[currency] || currencyOptionByCode.ZAR;
  try {
    return new Intl.NumberFormat(option.locale, {
      style: 'currency',
      currency: option.code,
      notation: 'compact',
      maximumFractionDigits: amount >= 1000 ? 1 : 0
    }).format(amount);
  } catch {
    return `${option.code} ${amount >= 1000 ? `${Math.round(amount / 100) / 10}K` : Math.round(amount)}`;
  }
};

const formatDateTime = (ms) => {
  if (!ms) return 'Not dated';
  return new Intl.DateTimeFormat('en-ZA', {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(ms));
};

const normalizeAttempt = (docSnap) => {
  const data = docSnap.data() || {};
  return {
    id: docSnap.id,
    gatewayType: data.gatewayType || 'stripe',
    status: data.status || 'initiated',
    amountInCents: Number(data.amountInCents || data.amountPaidInCents || 0),
    currency: data.currency || 'ZAR',
    customerName: data.customerName || data.clientName || 'Client',
    customerEmail: data.customerEmail || '',
    description: data.description || 'Booking payment',
    bookingId: data.bookingId || '',
    providerReference: data.providerReference || '',
    checkoutUrl: data.checkoutUrl || '',
    updatedAtMs: dateToMs(data.paidAt || data.updatedAt || data.createdAt)
  };
};

const manualGatewayIds = new Set(['manual_eft', 'cash']);

const parseAmountToCents = (value) => {
  if (Number.isSafeInteger(Number(value)) && Number(value) > 1000) return Number(value);
  const cleaned = String(value ?? '').replace(/[^\d.,-]/g, '').replace(',', '.');
  const parsed = Number.parseFloat(cleaned);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.round(parsed * 100));
};

const getBookingAmountInCents = (booking = {}) => {
  const direct = Number(booking.amountInCents ?? booking.amountPaidInCents ?? booking.totalInCents);
  if (Number.isSafeInteger(direct) && direct > 0) return direct;
  return parseAmountToCents(booking.total || booking.servicePrice || booking.price || booking.deposit || 0);
};

const getPeriodRange = (period) => {
  const now = new Date();
  if (period === 'all') {
    return { start: new Date(2000, 0, 1), end: new Date(2100, 0, 1), label: 'All time' };
  }
  if (period === 'day') {
    const start = startOfDay(now);
    return { start, end: addDays(start, 1), label: 'Today' };
  }
  if (period === 'week') {
    const start = getWeekStart(now);
    return { start, end: addDays(start, 7), label: 'This week' };
  }
  if (period === 'year') {
    const start = getYearStart(now);
    return { start, end: new Date(now.getFullYear() + 1, 0, 1), label: String(now.getFullYear()) };
  }
  const start = getMonthStart(now);
  return { start, end: new Date(now.getFullYear(), now.getMonth() + 1, 1), label: now.toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' }) };
};

const buildChartBuckets = (records, period, range) => {
  const paidRecords = records
    .filter((record) => record.status === 'paid' && record.updatedAtMs)
    .sort((a, b) => a.updatedAtMs - b.updatedAtMs);
  const dayMs = 86400000;
  const defaultStart = range?.start || startOfDay(new Date());
  const defaultEnd = range?.end || addDays(defaultStart, 1);
  let start = new Date(defaultStart);
  let end = new Date(defaultEnd);
  let unit = 'day';
  let step = 1;

  if (period === 'all' && paidRecords.length) {
    const first = new Date(paidRecords[0].updatedAtMs);
    const last = new Date(paidRecords[paidRecords.length - 1].updatedAtMs);
    const days = Math.max(1, Math.ceil((startOfDay(last).getTime() - startOfDay(first).getTime()) / dayMs) + 1);
    if (days <= 45) {
      unit = 'day';
      start = startOfDay(first);
      end = addDays(startOfDay(last), 1);
    } else if (days <= 160) {
      unit = 'week';
      start = getWeekStart(first);
      end = addDays(getWeekStart(last), 7);
    } else {
      unit = 'month';
      start = getMonthStart(first);
      end = addMonths(getMonthStart(last), 1);
      const monthSpan = Math.max(1, (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()));
      step = monthSpan > 36 ? 3 : 1;
    }
  } else if (period === 'day') {
    unit = 'hour';
    step = 3;
    start = startOfDay(defaultStart);
    end = addDays(start, 1);
  } else if (period === 'week') {
    unit = 'day';
    start = getWeekStart(defaultStart);
    end = addDays(start, 7);
  } else if (period === 'month') {
    unit = 'day';
    start = getMonthStart(defaultStart);
    end = addMonths(start, 1);
  } else if (period === 'year') {
    unit = 'month';
    start = getYearStart(defaultStart);
    end = new Date(defaultStart.getFullYear() + 1, 0, 1);
  }

  if (end <= start) end = unit === 'month' ? addMonths(start, step) : unit === 'hour' ? new Date(start.getTime() + step * 60 * 60 * 1000) : addDays(start, step);

  const advance = (date) => {
    if (unit === 'hour') {
      const next = new Date(date);
      next.setHours(next.getHours() + step, 0, 0, 0);
      return next;
    }
    if (unit === 'week') return addDays(date, 7 * step);
    if (unit === 'month') return addMonths(date, step);
    return addDays(date, step);
  };

  const formatLabel = (date) => {
    if (unit === 'hour') return date.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });
    if (unit === 'week') return date.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short' });
    if (unit === 'month') {
      const options = period === 'all' ? { month: 'short', year: '2-digit' } : { month: 'short' };
      return date.toLocaleDateString('en-ZA', options);
    }
    return period === 'week'
      ? date.toLocaleDateString('en-ZA', { weekday: 'short' })
      : date.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short' });
  };

  const buckets = [];
  let cursor = new Date(start);
  while (cursor < end && buckets.length < 96) {
    const bucketStart = new Date(cursor);
    const bucketEnd = advance(bucketStart);
    const bucketStartMs = bucketStart.getTime();
    const bucketEndMs = bucketEnd.getTime();
    const bucketRecords = paidRecords.filter((record) => record.updatedAtMs >= bucketStartMs && record.updatedAtMs < bucketEndMs);
    buckets.push({
      label: formatLabel(bucketStart),
      rangeLabel: `${bucketStart.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' })} - ${new Date(bucketEndMs - 1).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' })}`,
      value: bucketRecords.reduce((sum, record) => sum + record.amountInCents, 0),
      count: bucketRecords.length,
      startMs: bucketStartMs,
      endMs: bucketEndMs
    });
    cursor = bucketEnd;
  }

  return buckets.length ? buckets : [{ label: 'No data', rangeLabel: 'No paid records', value: 0, count: 0, startMs: start.getTime(), endMs: end.getTime() }];
};

const getPaidAverageByUnit = (records = [], unit = 'month') => {
  const buckets = records
    .filter((record) => record.status === 'paid' && record.updatedAtMs)
    .reduce((acc, record) => {
      const date = new Date(record.updatedAtMs);
      const key = unit === 'year'
        ? String(date.getFullYear())
        : unit === 'day'
          ? `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
          : `${date.getFullYear()}-${date.getMonth() + 1}`;
      acc[key] = (acc[key] || 0) + Number(record.amountInCents || 0);
      return acc;
    }, {});
  const values = Object.values(buckets);
  if (!values.length) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
};

const getAverageMetricMeta = (period) => {
  if (period === 'day') {
    return { unit: 'day', label: 'Average Daily Income', caption: 'Across paid days' };
  }
  if (period === 'year') {
    return { unit: 'year', label: 'Average Yearly Income', caption: 'Across paid years' };
  }
  return { unit: 'month', label: 'Average Monthly Revenue', caption: 'Across paid months' };
};

const Toggle = ({ checked, onChange }) => (
  <button
    type="button"
    onClick={() => onChange(!checked)}
    className={`finance-toggle ${checked ? 'is-on' : ''}`}
    aria-pressed={checked}
  >
    <span />
  </button>
);

const StatusPill = ({ status }) => {
  const clean = String(status || 'initiated').toLowerCase();
  const label = clean === 'manual_pending' ? 'pending payment' : clean.replace(/_/g, ' ');
  const tone = clean === 'paid'
    ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
    : clean.includes('ready')
      ? 'bg-blue-50 text-blue-700 border-blue-100'
      : clean.includes('fail') || clean.includes('cancel')
        ? 'bg-rose-50 text-rose-700 border-rose-100'
        : clean.includes('pending') || clean.includes('manual')
          ? 'bg-amber-50 text-amber-700 border-amber-100'
          : 'bg-neutral-50 text-neutral-500 border-neutral-100';
  return <span className={`rounded-full border px-2 py-1 text-[8px] font-bold uppercase tracking-widest ${tone}`}>{label}</span>;
};

const migrationColumnAliases = {
  clientName: ['client name', 'customer name', 'customer', 'name', 'full name', 'member name'],
  firstName: ['first name', 'firstname', 'given name'],
  lastName: ['last name', 'lastname', 'surname', 'family name'],
  email: ['email', 'email address', 'customer email', 'client email'],
  phone: ['phone', 'phone number', 'mobile', 'mobile number', 'contact number', 'client phone'],
  birthday: ['birthday', 'birth date', 'date of birth', 'dob'],
  notes: ['notes', 'client notes', 'memo', 'comments'],
  tags: ['tags', 'labels', 'segment'],
  serviceName: ['service', 'service name', 'class', 'class name', 'appointment type', 'product'],
  serviceCategory: ['category', 'service category', 'class category'],
  serviceDuration: ['duration', 'service duration', 'minutes', 'length'],
  bookingDate: ['booking date', 'appointment date', 'date', 'session date', 'class date', 'scheduled date'],
  bookingTime: ['booking time', 'appointment time', 'time', 'session time', 'start time'],
  bookingStatus: ['booking status', 'appointment status', 'status'],
  bookingId: ['booking id', 'appointment id', 'reservation id', 'order id', 'reference'],
  staffName: ['staff', 'coach', 'trainer', 'instructor', 'specialist'],
  amount: ['amount', 'total', 'price', 'paid', 'payment amount', 'transaction amount', 'gross amount', 'amount paid'],
  amountInCents: ['amount in cents', 'amount_in_cents', 'total cents', 'price cents'],
  currency: ['currency', 'currency code'],
  paymentStatus: ['payment status', 'transaction status', 'paid status', 'finance status'],
  paymentMethod: ['payment method', 'method', 'gateway', 'payment gateway', 'processor'],
  paymentReference: ['payment reference', 'transaction id', 'transaction reference', 'receipt id', 'invoice id', 'payment id'],
  paidAt: ['paid at', 'payment date', 'transaction date', 'settled date', 'updated at'],
  description: ['description', 'transaction description', 'item', 'line item']
};

const migrationScopeCards = [
  {
    id: 'clients',
    title: 'Client list',
    caption: 'Creates saved client profiles only.',
    Icon: Users
  },
  {
    id: 'bookings',
    title: 'Bookings',
    caption: 'Adds dated sessions to the booking desk.',
    Icon: CalendarCheck
  },
  {
    id: 'finance',
    title: 'Finance history',
    caption: 'Imports paid or pending transaction rows.',
    Icon: ReceiptText
  }
];

const normalizeCsvColumn = (value = '') => String(value)
  .trim()
  .toLowerCase()
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, '');

const csvAliasKeys = Object.fromEntries(
  Object.entries(migrationColumnAliases).map(([key, aliases]) => [
    key,
    aliases.map(normalizeCsvColumn)
  ])
);

const parseCsvText = (text = '') => {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;
  const source = String(text || '').replace(/^\uFEFF/, '');

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];
    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === ',' && !inQuotes) {
      row.push(cell);
      cell = '';
      continue;
    }
    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      continue;
    }
    cell += char;
  }

  row.push(cell);
  rows.push(row);

  const cleanRows = rows
    .map((cells) => cells.map((value) => String(value ?? '').trim()))
    .filter((cells) => cells.some(Boolean));

  if (cleanRows.length < 2) {
    throw new Error('CSV needs a header row and at least one data row.');
  }

  const headers = cleanRows[0].map((header, index) => header || `Column ${index + 1}`);
  const normalizedHeaders = headers.map(normalizeCsvColumn);
  const dataRows = cleanRows.slice(1)
    .map((cells, rowIndex) => {
      const values = {};
      headers.forEach((header, index) => {
        const key = normalizedHeaders[index];
        if (!key || Object.prototype.hasOwnProperty.call(values, key)) return;
        values[key] = String(cells[index] ?? '').trim();
      });
      return { index: rowIndex, values };
    })
    .filter((item) => Object.values(item.values).some(Boolean));

  if (!dataRows.length) {
    throw new Error('No usable rows were found after the header.');
  }

  return { headers, normalizedHeaders, rows: dataRows };
};

const hasCsvColumns = (parsedCsv, fields = []) => fields.some((field) => {
  const aliases = csvAliasKeys[field] || [];
  return parsedCsv.normalizedHeaders.some((header) => aliases.includes(header));
});

const detectCsvScopes = (parsedCsv) => ({
  clients: hasCsvColumns(parsedCsv, ['clientName', 'firstName', 'lastName', 'email', 'phone', 'birthday', 'notes', 'tags']),
  bookings: hasCsvColumns(parsedCsv, ['serviceName', 'bookingDate', 'bookingTime', 'bookingStatus', 'bookingId', 'staffName']),
  finance: hasCsvColumns(parsedCsv, ['amount', 'amountInCents', 'currency', 'paymentStatus', 'paymentMethod', 'paymentReference', 'paidAt'])
});

const pickCsvField = (row, field) => {
  const aliases = csvAliasKeys[field] || [];
  for (const key of aliases) {
    const value = row.values[key];
    if (String(value || '').trim()) return { key, value: String(value).trim() };
  }
  return { key: '', value: '' };
};

const slugifyImportValue = (value = 'item') => String(value || 'item')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '') || 'item';

const buildImportedClientId = ({ name = '', email = '', phone = '' }) => {
  const emailKey = String(email || '').trim().toLowerCase();
  const phoneKey = String(phone || '').replace(/\D/g, '');
  if (emailKey) return `email-${emailKey.replace(/[^a-z0-9]+/g, '-')}`;
  if (phoneKey) return `phone-${phoneKey}`;
  return `name-${slugifyImportValue(name || 'client')}`;
};

const parseCsvMoneyToCents = (field = {}) => {
  if (!field.value) return 0;
  const raw = String(field.value || '').trim();
  const numeric = raw.replace(/[^\d.,-]/g, '').replace(',', '.');
  const parsed = Number.parseFloat(numeric);
  if (!Number.isFinite(parsed)) return 0;
  const key = String(field.key || '').toLowerCase();
  if (key.includes('cents')) return Math.max(0, Math.round(parsed));
  return Math.max(0, Math.round(parsed * 100));
};

const parseCsvDate = (value = '') => {
  const clean = String(value || '').trim();
  if (!clean) return null;
  const iso = clean.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (iso) {
    const date = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const splitDate = clean.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (splitDate) {
    const first = Number(splitDate[1]);
    const second = Number(splitDate[2]);
    const year = Number(splitDate[3].length === 2 ? `20${splitDate[3]}` : splitDate[3]);
    const month = second > 12 ? first : second;
    const day = second > 12 ? second : first;
    const date = new Date(year, month - 1, day);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const parsed = Date.parse(clean);
  return Number.isNaN(parsed) ? null : new Date(parsed);
};

const applyCsvTime = (date, value = '') => {
  if (!date) return null;
  const next = new Date(date);
  const clean = String(value || '').trim();
  if (!clean) return next;
  const match = clean.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (!match) return next;
  let hours = Number(match[1]);
  const minutes = Number(match[2] || 0);
  const meridian = String(match[3] || '').toLowerCase();
  if (meridian === 'pm' && hours < 12) hours += 12;
  if (meridian === 'am' && hours === 12) hours = 0;
  next.setHours(hours, minutes, 0, 0);
  return next;
};

const formatCsvDateKey = (date) => {
  if (!date) return '';
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
};

const formatCsvBookingDate = (date) => (
  date
    ? date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    : ''
);

const normalizeCsvPaymentStatus = (value = '', amountInCents = 0) => {
  const clean = String(value || '').trim().toLowerCase();
  if (clean.includes('unpaid') || clean.includes('not paid') || clean.includes('not_paid')) return 'manual_pending';
  if (clean.includes('paid') && !clean.includes('unpaid')) return 'paid';
  if (clean.includes('settled') || clean.includes('complete') || clean.includes('success')) return 'paid';
  if (clean.includes('pending') || clean.includes('open') || clean.includes('due') || clean.includes('manual')) return 'manual_pending';
  if (clean.includes('fail') || clean.includes('cancel') || clean.includes('refund')) return 'failed';
  return amountInCents > 0 ? 'paid' : 'manual_pending';
};

const normalizeCsvBookingStatus = (value = '') => {
  const clean = String(value || '').trim().toLowerCase();
  if (clean.includes('cancel')) return 'cancelled';
  if (clean.includes('declin')) return 'declined';
  if (clean.includes('wait')) return 'waitlist';
  if (clean.includes('pending') || clean.includes('request')) return 'pending';
  if (clean.includes('complete')) return 'completed';
  return 'confirmed';
};

const normalizeCsvGateway = (value = '') => {
  const clean = String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
  if (clean.includes('eft') || clean.includes('bank')) return 'manual_eft';
  if (clean.includes('cash')) return 'cash';
  if (clean.includes('stripe')) return 'stripe';
  if (clean.includes('payfast')) return 'payfast';
  if (clean.includes('paystack')) return 'paystack';
  if (clean.includes('yoco')) return 'yoco';
  if (clean.includes('ozow')) return 'ozow';
  return clean || 'cash';
};

const extractCsvClient = (row) => {
  const firstName = pickCsvField(row, 'firstName').value;
  const lastName = pickCsvField(row, 'lastName').value;
  const email = pickCsvField(row, 'email').value;
  const phone = pickCsvField(row, 'phone').value;
  const explicitName = pickCsvField(row, 'clientName').value;
  const name = explicitName || [firstName, lastName].filter(Boolean).join(' ') || email.split('@')[0] || '';
  return {
    name: name.trim(),
    email,
    phone,
    birthday: pickCsvField(row, 'birthday').value,
    notes: pickCsvField(row, 'notes').value,
    tags: pickCsvField(row, 'tags').value
  };
};

const buildCsvMigrationPayload = (parsedCsv, selectedScopes, displayCurrency, batchId) => {
  if (!parsedCsv) return { clients: [], bookings: [], financeRecords: [], skippedRows: 0, total: 0 };
  const clients = new Map();
  const bookings = [];
  const financeRecords = [];
  let skippedRows = 0;
  const importedAt = Date.now();

  parsedCsv.rows.forEach((row) => {
    const rowNumber = row.index + 2;
    const client = extractCsvClient(row);
    const hasClient = Boolean(client.name || client.email || client.phone);
    const clientId = hasClient ? buildImportedClientId(client) : '';
    const serviceName = pickCsvField(row, 'serviceName').value;
    const serviceCategory = pickCsvField(row, 'serviceCategory').value;
    const serviceDuration = pickCsvField(row, 'serviceDuration').value;
    const bookingDate = parseCsvDate(pickCsvField(row, 'bookingDate').value);
    const bookingTime = pickCsvField(row, 'bookingTime').value;
    const bookingDateTime = applyCsvTime(bookingDate, bookingTime);
    const bookingId = pickCsvField(row, 'bookingId').value;
    const amountField = pickCsvField(row, 'amountInCents').value
      ? pickCsvField(row, 'amountInCents')
      : pickCsvField(row, 'amount');
    const amountInCents = parseCsvMoneyToCents(amountField);
    const currency = (pickCsvField(row, 'currency').value || displayCurrency || 'ZAR').toUpperCase();
    const paymentStatus = normalizeCsvPaymentStatus(pickCsvField(row, 'paymentStatus').value, amountInCents);
    const gatewayType = normalizeCsvGateway(pickCsvField(row, 'paymentMethod').value);
    const paymentReference = pickCsvField(row, 'paymentReference').value || bookingId;
    const paidDate = parseCsvDate(pickCsvField(row, 'paidAt').value);
    const paidDateTime = applyCsvTime(paidDate, bookingTime);
    const description = pickCsvField(row, 'description').value || serviceName || 'Imported transaction';
    const rowHasBooking = Boolean((bookingDate || bookingTime || serviceName || bookingId) && hasClient);
    const rowHasFinance = Boolean(amountInCents || (paymentReference && (paidDate || pickCsvField(row, 'paymentStatus').value)));
    let createdSomething = false;
    let createdBooking = null;

    if (selectedScopes.clients && hasClient) {
      const labels = client.tags
        ? client.tags.split(/[|;,]/).map((tag) => tag.trim()).filter(Boolean)
        : [];
      clients.set(clientId, {
        id: clientId,
        name: client.name || 'Imported Client',
        phone: client.phone || '',
        email: client.email || '',
        birthday: client.birthday || '',
        notes: client.notes || '',
        avatar: '',
        labels: Array.from(new Set(['Imported', ...labels])),
        source: 'csv-import',
        importedViaCsv: true,
        importBatchId: batchId,
        importedAt,
        createdAt: importedAt,
        updatedAt: importedAt
      });
      createdSomething = true;
    }

    if (selectedScopes.bookings && rowHasBooking) {
      const id = bookingId
        ? `csv-booking-${slugifyImportValue(bookingId)}`
        : `${batchId}-booking-${rowNumber}`;
      const timestamp = bookingDateTime?.getTime() || paidDateTime?.getTime() || importedAt;
      createdBooking = {
        id,
        clientName: client.name || 'Imported Client',
        clientPhone: client.phone || '',
        clientEmail: client.email || '',
        clientBirthday: client.birthday || '',
        clientNote: client.notes || '',
        clientEmailOptIn: Boolean(client.email),
        serviceId: '',
        serviceName: serviceName || description || 'Imported booking',
        serviceDescription: '',
        servicePrice: amountInCents ? String(amountInCents / 100) : '',
        servicePriceType: 'fixed',
        serviceDuration,
        serviceCategory,
        amountInCents,
        amountPaidInCents: paymentStatus === 'paid' ? amountInCents : 0,
        currency,
        paymentMethod: gatewayType,
        paymentGateway: cardGatewayIds.has(gatewayType) ? gatewayType : '',
        paymentProviderName: gatewayById[gatewayType]?.name || gatewayType.replace(/_/g, ' '),
        paymentStatus,
        paymentReference,
        paidAt: paymentStatus === 'paid' ? (paidDateTime?.getTime() || timestamp) : null,
        notificationChannels: { email: false, portal: false },
        date: formatCsvBookingDate(bookingDate),
        dateKey: formatCsvDateKey(bookingDate),
        time: bookingTime || '',
        status: normalizeCsvBookingStatus(pickCsvField(row, 'bookingStatus').value),
        staffName: pickCsvField(row, 'staffName').value,
        noShowHistory: false,
        source: 'csv-import',
        importedViaCsv: true,
        importBatchId: batchId,
        importedAt,
        createdAt: timestamp,
        updatedAt: importedAt,
        timestamp
      };
      bookings.push(createdBooking);
      createdSomething = true;
    }

    if (selectedScopes.finance && rowHasFinance && !createdBooking) {
      const financeId = paymentReference
        ? `csv-finance-${slugifyImportValue(paymentReference)}`
        : `${batchId}-finance-${rowNumber}`;
      const updatedAtMs = paidDateTime?.getTime() || bookingDateTime?.getTime() || importedAt;
      financeRecords.push({
        id: financeId,
        gatewayType,
        status: paymentStatus,
        amountInCents,
        currency,
        customerName: client.name || 'Imported Client',
        customerEmail: client.email || '',
        description,
        bookingId: bookingId || paymentReference || '',
        providerReference: paymentReference || '',
        updatedAtMs,
        importedViaCsv: true,
        importBatchId: batchId,
        importedAt,
        source: 'csv-import'
      });
      createdSomething = true;
    }

    if (!createdSomething) skippedRows += 1;
  });

  return {
    clients: Array.from(clients.values()),
    bookings,
    financeRecords,
    skippedRows,
    total: clients.size + bookings.length + financeRecords.length
  };
};

const MigrationImportPanel = ({
  canManageWorkspace,
  displayCurrency,
  importedCounts = {},
  onImportMigrationCsv,
  onClearMigrationData,
  showToast
}) => {
  const [parsedCsv, setParsedCsv] = useState(null);
  const [fileName, setFileName] = useState('');
  const [csvError, setCsvError] = useState('');
  const [selectedScopes, setSelectedScopes] = useState({ clients: true, bookings: false, finance: false });
  const [batchId, setBatchId] = useState(`csv-${Date.now()}`);
  const [importing, setImporting] = useState(false);
  const [clearing, setClearing] = useState(false);

  const preview = useMemo(
    () => buildCsvMigrationPayload(parsedCsv, selectedScopes, displayCurrency, batchId),
    [batchId, displayCurrency, parsedCsv, selectedScopes]
  );
  const uploadedTotal = Number(importedCounts.clients || 0) + Number(importedCounts.bookings || 0) + Number(importedCounts.financeRecords || 0);
  const selectedCount = Object.values(selectedScopes).filter(Boolean).length;
  const canImport = Boolean(canManageWorkspace && parsedCsv && selectedCount && preview.total && !importing);

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setCsvError('');
    setParsedCsv(null);
    if (file.size > 3 * 1024 * 1024) {
      setCsvError('Keep CSV uploads under 3MB for a fast import.');
      event.target.value = '';
      return;
    }
    try {
      const text = await file.text();
      const parsed = parseCsvText(text);
      const detectedScopes = detectCsvScopes(parsed);
      setParsedCsv(parsed);
      setFileName(file.name);
      setBatchId(`csv-${Date.now()}`);
      setSelectedScopes({
        clients: detectedScopes.clients || (!detectedScopes.bookings && !detectedScopes.finance),
        bookings: detectedScopes.bookings,
        finance: detectedScopes.finance
      });
    } catch (error) {
      setCsvError(error?.message || 'This CSV could not be read.');
      setFileName('');
    } finally {
      event.target.value = '';
    }
  };

  const toggleScope = (scopeId) => {
    setSelectedScopes((current) => ({ ...current, [scopeId]: !current[scopeId] }));
  };

  const handleImport = async () => {
    if (!canImport) {
      if (!canManageWorkspace) showToast?.('Only owners and admins can import data.');
      else if (!parsedCsv) showToast?.('Upload a CSV first.');
      else showToast?.('Select at least one data type with usable rows.');
      return;
    }
    setImporting(true);
    try {
      await onImportMigrationCsv?.({
        ...preview,
        batchId,
        fileName,
        selectedScopes
      });
      setParsedCsv(null);
      setFileName('');
    } finally {
      setImporting(false);
    }
  };

  const handleClear = async () => {
    if (!uploadedTotal || clearing) return;
    if (!window.confirm('Delete CSV-uploaded clients, bookings, and finance rows only? Existing live records will stay untouched.')) return;
    setClearing(true);
    try {
      await onClearMigrationData?.();
    } finally {
      setClearing(false);
    }
  };

  return (
    <section className="finance-migration-panel rounded-[1.25rem] border border-neutral-200 bg-white shadow-sm overflow-hidden">
      <div className="p-4 md:p-5 border-b border-neutral-100 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="finance-migration-icon w-11 h-11 rounded-2xl bg-black text-white flex items-center justify-center shrink-0">
            <FileSpreadsheet size={19} />
          </span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Migration studio</p>
            <h3 className="text-2xl font-black tracking-tight text-black mt-1">Import one CSV, choose what it contains</h3>
            <p className="mt-2 text-sm text-neutral-500 max-w-2xl">
              Upload a client list, booking history, transaction history, or a mixed export. Build A Booking only creates the records you tick below.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 w-full sm:w-auto">
          <label className="h-11 px-4 rounded-2xl native-gradient-button text-black text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 cursor-pointer">
            <Upload size={15} /> Upload CSV
            <input type="file" accept=".csv,text/csv" className="sr-only" onChange={handleFileChange} />
          </label>
          <button
            type="button"
            onClick={handleClear}
            disabled={!uploadedTotal || clearing}
            className="h-11 px-4 rounded-2xl border border-neutral-200 bg-white text-black text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-40"
          >
            <Trash2 size={15} /> {clearing ? 'Clearing' : 'Delete uploads'}
          </button>
        </div>
      </div>

      <div className="p-4 md:p-5 grid xl:grid-cols-[minmax(0,1fr)_360px] gap-4">
        <div className="finance-migration-drop rounded-2xl border border-neutral-100 bg-neutral-50 p-4 md:p-5">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">File readout</p>
              <p className="mt-1 text-lg font-black text-black">{fileName || 'No CSV selected'}</p>
            </div>
            <span className="rounded-full border border-neutral-200 bg-white px-3 py-2 text-[9px] font-bold uppercase tracking-widest text-neutral-400">
              {parsedCsv ? `${parsedCsv.rows.length} rows` : 'CSV only'}
            </span>
          </div>
          {csvError && (
            <p className="mt-4 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{csvError}</p>
          )}
          {parsedCsv ? (
            <div className="mt-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Detected columns</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {parsedCsv.headers.slice(0, 14).map((header) => (
                  <span key={header} className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-[10px] font-bold text-neutral-500">{header}</span>
                ))}
                {parsedCsv.headers.length > 14 && (
                  <span className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-[10px] font-bold text-neutral-500">+{parsedCsv.headers.length - 14} more</span>
                )}
              </div>
            </div>
          ) : (
            <div className="mt-5 grid sm:grid-cols-3 gap-2">
              {migrationScopeCards.map(({ id, title, Icon }) => (
                <div key={id} className="rounded-2xl border border-neutral-100 bg-white p-3 flex items-center gap-2">
                  <Icon size={16} className="text-neutral-400" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">{title}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <aside className="finance-migration-summary rounded-2xl border border-neutral-100 bg-white p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Upload status</p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {[
              ['Clients', importedCounts.clients || 0],
              ['Bookings', importedCounts.bookings || 0],
              ['Finance', importedCounts.financeRecords || 0]
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-neutral-100 bg-neutral-50 p-3">
                <p className="text-xl font-black text-black">{value}</p>
                <p className="mt-1 text-[8px] font-bold uppercase tracking-widest text-neutral-400">{label}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs font-bold text-neutral-400">
            Imported rows are tagged as uploaded data. Delete uploads clears those rows without touching native bookings, live payments, or manually created clients.
          </p>
        </aside>
      </div>

      {parsedCsv && (
        <div className="px-4 md:px-5 pb-4 md:pb-5">
          <div className="grid lg:grid-cols-3 gap-3">
            {migrationScopeCards.map(({ id, title, caption, Icon }) => {
              const checked = Boolean(selectedScopes[id]);
              const count = id === 'clients' ? preview.clients.length : id === 'bookings' ? preview.bookings.length : preview.financeRecords.length;
              return (
                <label key={id} className={`finance-migration-scope rounded-2xl border p-4 cursor-pointer transition-all ${checked ? 'is-selected' : ''}`}>
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={checked}
                    onChange={() => toggleScope(id)}
                  />
                  <span className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-3 min-w-0">
                      <span className="w-10 h-10 rounded-2xl bg-neutral-50 border border-neutral-100 flex items-center justify-center text-black shrink-0">
                        <Icon size={17} />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-black text-black truncate">{title}</span>
                        <span className="block mt-1 text-xs text-neutral-500">{caption}</span>
                      </span>
                    </span>
                    <span className={`finance-migration-check w-6 h-6 rounded-full border flex items-center justify-center shrink-0 ${checked ? 'is-selected' : ''}`}>
                      {checked && <Check size={14} />}
                    </span>
                  </span>
                  <span className="mt-4 block text-[10px] font-bold uppercase tracking-widest text-neutral-400">{count} ready</span>
                </label>
              );
            })}
          </div>

          <div className="mt-3 rounded-2xl border border-neutral-100 bg-neutral-50 p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="grid grid-cols-4 gap-2 lg:min-w-[420px]">
              {[
                ['Clients', preview.clients.length],
                ['Bookings', preview.bookings.length],
                ['Finance', preview.financeRecords.length],
                ['Skipped', preview.skippedRows]
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl bg-white border border-neutral-100 p-3">
                  <p className="text-xl font-black text-black">{value}</p>
                  <p className="text-[8px] font-bold uppercase tracking-widest text-neutral-400">{label}</p>
                </div>
              ))}
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={() => { setParsedCsv(null); setFileName(''); setCsvError(''); }}
                className="h-11 px-5 rounded-2xl border border-neutral-200 bg-white text-black text-[10px] font-bold uppercase tracking-widest"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={handleImport}
                disabled={!canImport}
                className="h-11 px-5 rounded-2xl bg-black text-white text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-40"
              >
                {importing ? <RefreshCw size={15} className="animate-spin" /> : <Check size={15} />}
                Import selected data
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

const FinanceTimelineChart = ({ buckets = [], currency = 'ZAR', statItems = [] }) => {
  const safeBuckets = buckets.length ? buckets : [{ label: 'No data', rangeLabel: 'No paid records', value: 0, count: 0 }];
  const chartWidth = 920;
  const chartHeight = 360;
  const padding = { top: 28, right: 42, bottom: 58, left: 92 };
  const plotWidth = chartWidth - padding.left - padding.right;
  const plotHeight = chartHeight - padding.top - padding.bottom;
  const totalValue = safeBuckets.reduce((sum, bucket) => sum + Number(bucket.value || 0), 0);
  const chartMax = Math.max(totalValue, 1);
  const xLabelIndexes = safeBuckets.length <= 6
    ? safeBuckets.map((_, index) => index)
    : [0, 0.25, 0.5, 0.75, 1]
      .map((ratio) => Math.round((safeBuckets.length - 1) * ratio))
      .filter((index, position, indexes) => index >= 0 && index < safeBuckets.length && indexes.indexOf(index) === position);
  let cumulativeValue = 0;
  const points = safeBuckets.map((bucket, index) => {
    cumulativeValue += Number(bucket.value || 0);
    const x = padding.left + (safeBuckets.length === 1 ? plotWidth / 2 : (index / (safeBuckets.length - 1)) * plotWidth);
    const y = padding.top + plotHeight - ((cumulativeValue / chartMax) * plotHeight);
    return { ...bucket, rawValue: Number(bucket.value || 0), cumulativeValue, x, y };
  });
  const linePath = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(2)} ${(padding.top + plotHeight).toFixed(2)} L ${points[0].x.toFixed(2)} ${(padding.top + plotHeight).toFixed(2)} Z`;
  const yTicks = totalValue > 0
    ? [totalValue, totalValue * 0.75, totalValue * 0.5, totalValue * 0.25, 0].map((value) => Math.round(value))
    : [0];
  const peakPointIndex = points.reduce((latestIndex, point, index) => (
    Number(point.cumulativeValue || 0) > 0 ? index : latestIndex
  ), 0);
  const summaryItems = statItems.length ? statItems : [
    { label: 'Total Revenue', value: formatMoney(totalValue, currency), caption: 'Paid revenue' },
    { label: 'Average Monthly Revenue', value: formatMoney(totalValue, currency), caption: 'Across paid months' },
    { label: 'Pending Payments', value: formatMoney(0, currency), caption: 'Awaiting confirmation' }
  ];

  return (
    <div className="finance-timeline-chart rounded-[1.35rem] border border-neutral-100 bg-white p-3 md:p-4">
      <div className="finance-timeline-statbar grid grid-cols-1 sm:grid-cols-3 gap-px overflow-hidden rounded-2xl border border-neutral-100 bg-neutral-100 mb-4">
        {summaryItems.map(({ label, value, caption }) => (
          <div key={label} className="bg-white px-4 py-3">
            <p className="text-[8px] font-black uppercase tracking-widest text-neutral-400">{label}</p>
            <p className="mt-1 text-lg md:text-xl font-black tracking-tight text-black truncate">{value}</p>
            <p className="mt-0.5 text-[9px] font-bold uppercase tracking-widest text-neutral-300 truncate">{caption}</p>
          </div>
        ))}
      </div>

      <div className="finance-timeline-canvas h-[20rem] rounded-[1.15rem] border border-neutral-100 bg-[#FBFCFE] overflow-hidden">
        <svg className="h-full w-full" viewBox={`0 0 ${chartWidth} ${chartHeight}`} role="img" aria-label="Cumulative paid revenue over time">
          <title>Cumulative paid revenue over time</title>
          <defs>
            <linearGradient id="financeTimelineArea" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#14b8a6" stopOpacity="0.16" />
              <stop offset="68%" stopColor="#14b8a6" stopOpacity="0.06" />
              <stop offset="100%" stopColor="#14b8a6" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="financeTimelineLine" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="#111827" />
              <stop offset="48%" stopColor="#14b8a6" />
              <stop offset="100%" stopColor="#8b5cf6" />
            </linearGradient>
          </defs>

          {yTicks.map((tick, index) => {
            const y = padding.top + plotHeight - ((tick / chartMax) * plotHeight);
            const isZero = tick === 0;
            const label = index === 0 && totalValue > 0 ? formatMoney(tick, currency) : formatCompactMoney(tick, currency);
            return (
              <g key={`${tick}-${index}`}>
                <line className={isZero ? 'finance-axis-baseline' : 'finance-grid-line'} x1={padding.left} x2={chartWidth - padding.right} y1={y} y2={y} />
                <text className="finance-axis-label finance-axis-label-y" x={padding.left - 16} y={y + 5} textAnchor="end">
                  {label}
                </text>
              </g>
            );
          })}

          <line className="finance-axis-line" x1={padding.left} x2={padding.left} y1={padding.top} y2={padding.top + plotHeight} />
          <line className="finance-axis-line" x1={padding.left} x2={chartWidth - padding.right} y1={padding.top + plotHeight} y2={padding.top + plotHeight} />

          <path d={areaPath} fill="url(#financeTimelineArea)" />
          <path className="finance-chart-line-shadow" d={linePath} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <path className="finance-chart-line" d={linePath} fill="none" stroke="url(#financeTimelineLine)" strokeLinecap="round" strokeLinejoin="round" />

          {xLabelIndexes.map((index) => {
            const point = points[index];
            if (!point) return null;
            return (
              <g key={`x-axis-${point.label}-${index}`}>
                <line className="finance-x-axis-tick" x1={point.x} x2={point.x} y1={padding.top + plotHeight} y2={padding.top + plotHeight + 7} />
                <text
                  className="finance-axis-label finance-axis-label-x"
                  x={point.x}
                  y={chartHeight - 21}
                  textAnchor={index === 0 ? 'start' : index === points.length - 1 ? 'end' : 'middle'}
                >
                  {point.label}
                </text>
              </g>
            );
          })}

          {points.map((point, index) => {
            const isPeak = index === peakPointIndex && Number(point.cumulativeValue || 0) > 0;
            const hasValue = Number(point.cumulativeValue || 0) > 0;
            return (
              <g key={`${point.label}-${point.startMs || index}`}>
                {hasValue && (
                  <>
                    <circle className="finance-chart-hit-dot" cx={point.x} cy={point.y} r="11">
                      <title>{`${point.rangeLabel || point.label}: ${formatMoney(point.rawValue || 0, currency)} from ${point.count || 0} paid booking${point.count === 1 ? '' : 's'} · ${formatMoney(point.cumulativeValue || 0, currency)} cumulative`}</title>
                    </circle>
                    <circle className={`finance-chart-dot ${isPeak ? 'is-peak' : ''}`} cx={point.x} cy={point.y} r={isPeak ? 6 : 4.2} />
                  </>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};
export const FinancePaymentSettings = ({
  appId,
  businessId,
  isGuestWorkspace = false,
  canManageWorkspace,
  showToast,
  bookings = [],
  importedFinanceRecords = [],
  importedMigrationCounts = {},
  onImportMigrationCsv,
  onClearMigrationData,
  onMarkBookingPaid
}) => {
  const [saved, setSaved] = useState({});
  const [drafts, setDrafts] = useState(emptyDrafts);
  const [saving, setSaving] = useState('');
  const [gatewayModalOpen, setGatewayModalOpen] = useState(false);
  const [selectedGatewayId, setSelectedGatewayId] = useState('stripe');
  const [financeSummary, setFinanceSummary] = useState({});
  const [paymentAttempts, setPaymentAttempts] = useState([]);
  const [period, setPeriod] = useState('all');
  const [deskView, setDeskView] = useState('transactions');
  const [search, setSearch] = useState('');
  const [deskStatusFilter, setDeskStatusFilter] = useState('all');
  const [deskSort, setDeskSort] = useState('newest');
  const [displayCurrency, setDisplayCurrency] = useState('ZAR');

  useEffect(() => {
    if (!isFirebaseConfigured || !db || !appId || !businessId) return undefined;
    const settingsRef = FirebaseSDK.collection(db, 'artifacts', appId, 'users', businessId, 'payment_settings');
    return FirebaseSDK.onSnapshot(settingsRef, (snapshot) => {
      const next = {};
      snapshot.forEach((docSnap) => { next[docSnap.id] = docSnap.data() || {}; });
      setSaved(next);
      setDrafts((current) => {
        const merged = { ...current };
        gatewayCards.forEach((gateway) => {
          const publicConfig = next[gateway.id] || {};
          merged[gateway.id] = {
            ...merged[gateway.id],
            enabled: Boolean(publicConfig.enabled),
            mode: publicConfig.mode || merged[gateway.id]?.mode || 'test'
          };
        });
        return merged;
      });
    }, (error) => {
      console.error('Finance gateway settings listener failed', error);
    });
  }, [appId, businessId]);

  useEffect(() => {
    if (!isFirebaseConfigured || !db || !appId || !businessId) return undefined;
    const userRef = FirebaseSDK.doc(db, 'artifacts', appId, 'users', businessId);
    const summaryRef = FirebaseSDK.doc(db, 'artifacts', appId, 'users', businessId, 'finance', 'summary');
    const attemptsQuery = FirebaseSDK.query(
      FirebaseSDK.collection(userRef, 'payment_attempts'),
      FirebaseSDK.limit(80)
    );
    const unsubSummary = FirebaseSDK.onSnapshot(summaryRef, (docSnap) => {
      setFinanceSummary(docSnap.exists() ? docSnap.data() || {} : {});
    }, (error) => {
      console.error('Finance summary listener failed', error);
    });
    const unsubAttempts = FirebaseSDK.onSnapshot(attemptsQuery, (snapshot) => {
      const next = snapshot.docs.map(normalizeAttempt).sort((a, b) => (b.updatedAtMs || 0) - (a.updatedAtMs || 0));
      setPaymentAttempts(next);
    }, (error) => {
      console.error('Payment attempts listener failed', error);
    });
    return () => {
      unsubSummary();
      unsubAttempts();
    };
  }, [appId, businessId]);

  const selectedGateway = gatewayById[selectedGatewayId] || gatewayCards[0];
  const selectedDraft = drafts[selectedGateway.id] || emptyDrafts[selectedGateway.id];
  const effectiveSaved = useMemo(() => (
    isGuestWorkspace ? { ...guestDemoGatewaySettings, ...saved } : saved
  ), [isGuestWorkspace, saved]);
  const selectedPublicConfig = effectiveSaved[selectedGateway.id] || {};
  const isManualGateway = manualGatewayIds.has(selectedGateway.id);
  const isCashGateway = selectedGateway.id === 'cash';

  const periodRange = useMemo(() => getPeriodRange(period), [period]);

  const manualBookingRows = useMemo(() => (
    (bookings || [])
      .filter((booking) => {
        if (!booking || booking.isExample) return false;
        const method = booking.paymentGateway || booking.paymentMethod || '';
        return isGuestWorkspace || manualGatewayIds.has(method) || booking.paymentStatus === 'manual_pending';
      })
      .map((booking) => {
        const method = booking.paymentGateway || booking.paymentMethod || 'cash';
        const paid = booking.paymentStatus === 'paid';
        return {
          id: `manual-${booking.id}`,
          gatewayType: isGuestWorkspace ? method : (manualGatewayIds.has(method) ? method : 'cash'),
          status: paid ? 'paid' : 'manual_pending',
          amountInCents: getBookingAmountInCents(booking),
          currency: booking.currency || 'ZAR',
          customerName: booking.clientName || booking.name || 'Client',
          customerEmail: booking.clientEmail || booking.email || '',
          description: booking.serviceName || booking.description || 'Manual booking payment',
          bookingId: booking.id || '',
          updatedAtMs: dateToMs(booking.paidAt || booking.updatedAt || booking.timestamp || booking.createdAt) || Date.now(),
          originalBooking: booking,
          canMarkPaid: !paid
        };
      })
  ), [bookings, isGuestWorkspace]);

  const importedFinanceRows = useMemo(() => (
    (importedFinanceRecords || [])
      .filter((record) => record && !record.isExample)
      .map((record) => ({
        id: `csv-${record.id || record.providerReference || record.bookingId}`,
        gatewayType: normalizeCsvGateway(record.gatewayType || record.paymentMethod || record.paymentGateway || 'cash'),
        status: normalizeCsvPaymentStatus(record.status || record.paymentStatus, Number(record.amountInCents || 0)),
        amountInCents: Number(record.amountInCents || 0),
        currency: record.currency || 'ZAR',
        customerName: record.customerName || record.clientName || 'Imported Client',
        customerEmail: record.customerEmail || record.clientEmail || '',
        description: record.description || 'Imported transaction',
        bookingId: record.bookingId || record.providerReference || '',
        providerReference: record.providerReference || '',
        updatedAtMs: dateToMs(record.updatedAtMs || record.updatedAt || record.paidAt || record.createdAt) || Date.now(),
        importedViaCsv: true
      }))
  ), [importedFinanceRecords]);

  const financeRecords = useMemo(() => (
    [...manualBookingRows, ...paymentAttempts, ...importedFinanceRows]
      .sort((a, b) => (b.updatedAtMs || 0) - (a.updatedAtMs || 0))
  ), [importedFinanceRows, manualBookingRows, paymentAttempts]);

  const effectiveFinanceRecords = useMemo(() => financeRecords, [financeRecords]);

  const inferredCurrency = useMemo(() => {
    if (currencyOptionByCode[financeSummary.currency]) return financeSummary.currency;
    const counts = effectiveFinanceRecords.reduce((acc, record) => {
      const code = currencyOptionByCode[record.currency] ? record.currency : '';
      if (code) acc[code] = (acc[code] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'ZAR';
  }, [effectiveFinanceRecords, financeSummary.currency]);

  const currencyStorageKey = useMemo(() => (
    `build-a-booking-finance-currency-${String(businessId || (isGuestWorkspace ? 'guest' : 'local')).replace(/[^a-zA-Z0-9_-]/g, '-')}`
  ), [businessId, isGuestWorkspace]);

  useEffect(() => {
    let stored = '';
    try {
      stored = window.localStorage.getItem(currencyStorageKey) || '';
    } catch {
      stored = '';
    }
    setDisplayCurrency(currencyOptionByCode[stored] ? stored : inferredCurrency);
  }, [currencyStorageKey, inferredCurrency]);

  const updateDisplayCurrency = (code) => {
    const next = currencyOptionByCode[code] ? code : inferredCurrency;
    setDisplayCurrency(next);
    try {
      window.localStorage.setItem(currencyStorageKey, next);
    } catch {
      // Local persistence is optional; the selected currency still applies for this session.
    }
  };

  const periodRecords = useMemo(() => {
    const startMs = periodRange.start.getTime();
    const endMs = periodRange.end.getTime();
    return effectiveFinanceRecords.filter((record) => {
      if (!record.updatedAtMs) return false;
      return record.updatedAtMs >= startMs && record.updatedAtMs < endMs;
    });
  }, [effectiveFinanceRecords, periodRange]);

  const financeMetrics = useMemo(() => {
    const paid = periodRecords.filter((record) => record.status === 'paid');
    const pending = periodRecords.filter((record) => record.status === 'manual_pending' || (record.canMarkPaid && !['paid', 'failed', 'cancelled', 'canceled'].includes(record.status)));
    const averageMeta = getAverageMetricMeta(period);
    return {
      revenueInCents: paid.reduce((sum, record) => sum + record.amountInCents, 0),
      paidCount: paid.length,
      pendingInCents: pending.reduce((sum, record) => sum + Number(record.amountInCents || 0), 0),
      pendingCount: pending.length,
      averageLabel: averageMeta.label,
      averageCaption: averageMeta.caption,
      averageInCents: getPaidAverageByUnit(effectiveFinanceRecords, averageMeta.unit)
    };
  }, [effectiveFinanceRecords, period, periodRecords]);

  const chartBuckets = useMemo(() => buildChartBuckets(periodRecords, period, periodRange), [period, periodRange, periodRecords]);

  const financeStatItems = useMemo(() => ([
    {
      label: 'Total Revenue',
      value: formatMoney(financeMetrics.revenueInCents, displayCurrency),
      caption: `${financeMetrics.paidCount} paid booking${financeMetrics.paidCount === 1 ? '' : 's'}`
    },
    {
      label: financeMetrics.averageLabel,
      value: formatMoney(financeMetrics.averageInCents, displayCurrency),
      caption: financeMetrics.averageCaption
    },
    {
      label: 'Pending Payments',
      value: formatMoney(financeMetrics.pendingInCents, displayCurrency),
      caption: `${financeMetrics.pendingCount} awaiting confirmation`
    }
  ]), [displayCurrency, financeMetrics]);

  const visibleDeskRows = useMemo(() => {
    const rows = effectiveFinanceRecords;
    const queryText = search.trim().toLowerCase();
    const filtered = rows.filter((row) => {
      const typeMatches = deskView === 'transactions'
        ? true
        : deskView === 'invoices'
          ? ['initiated', 'checkout_ready', 'paid'].includes(row.status)
          : row.status === 'paid';
      if (!typeMatches) return false;
      if (deskStatusFilter === 'paid' && row.status !== 'paid') return false;
      if (deskStatusFilter === 'open' && ['paid', 'failed', 'cancelled', 'canceled'].includes(row.status)) return false;
      if (deskStatusFilter === 'cash' && row.gatewayType !== 'cash') return false;
      if (deskStatusFilter === 'eft' && row.gatewayType !== 'manual_eft') return false;
      if (deskStatusFilter === 'card' && !cardGatewayIds.has(row.gatewayType)) return false;
      if (!queryText) return true;
      return [
        row.customerName,
        row.customerEmail,
        row.description,
        row.gatewayType,
        row.bookingId,
        row.status
      ].some((value) => String(value || '').toLowerCase().includes(queryText));
    });
    const sorted = [...filtered].sort((a, b) => {
      if (deskSort === 'oldest') return Number(a.updatedAtMs || 0) - Number(b.updatedAtMs || 0);
      if (deskSort === 'amount-high') return Number(b.amountInCents || 0) - Number(a.amountInCents || 0);
      if (deskSort === 'amount-low') return Number(a.amountInCents || 0) - Number(b.amountInCents || 0);
      if (deskSort === 'client') return String(a.customerName || '').localeCompare(String(b.customerName || ''));
      if (deskSort === 'status') return String(a.status || '').localeCompare(String(b.status || ''));
      return Number(b.updatedAtMs || 0) - Number(a.updatedAtMs || 0);
    });
    return sorted.slice(0, 12);
  }, [deskSort, deskStatusFilter, deskView, effectiveFinanceRecords, search]);

  const updateDraft = (gatewayId, patch) => {
    setDrafts((current) => ({
      ...current,
      [gatewayId]: {
        ...current[gatewayId],
        ...patch,
        credentials: {
          ...(current[gatewayId]?.credentials || {}),
          ...(patch.credentials || {})
        }
      }
    }));
  };

  const saveGateway = async (gateway) => {
    if (!canManageWorkspace) {
      showToast?.('Only owners and admins can manage finance settings.');
      return;
    }
    if (!businessId) {
      showToast?.('Sign in or save this workspace before saving payment settings.');
      return;
    }
    if (!functions) {
      showToast?.('Firebase Functions are not connected yet.');
      return;
    }
    const manual = manualGatewayIds.has(gateway.id);
    setSaving(gateway.id);
    try {
      const callable = FirebaseSDK.httpsCallable(functions, 'savePaymentGatewaySettings');
      await callable({
        appId,
        businessId,
        gatewayType: gateway.id,
        enabled: drafts[gateway.id]?.enabled || false,
        mode: manual ? 'live' : (drafts[gateway.id]?.mode || 'test'),
        providerName: gateway.name,
        credentials: drafts[gateway.id]?.credentials || {}
      });
      updateDraft(gateway.id, {
        credentials: gateway.fields.reduce((acc, field) => {
          acc[field.key] = '';
          return acc;
        }, {})
      });
      showToast?.(`${gateway.name} settings saved.`);
    } catch (error) {
      console.error('Payment settings save failed', error);
      showToast?.(error?.message || `${gateway.name} could not be saved.`);
    } finally {
      setSaving('');
    }
  };

  const openGatewayModal = (gatewayId = selectedGatewayId) => {
    setSelectedGatewayId(gatewayId);
    setGatewayModalOpen(true);
  };

  const downloadFinanceCsv = () => {
    const rows = effectiveFinanceRecords.map((row) => ({
      id: row.id,
      status: row.status,
      gateway: gatewayById[row.gatewayType]?.name || row.gatewayType || 'Gateway',
      client: row.customerName || 'Client',
      email: row.customerEmail || '',
      description: row.description || '',
      bookingId: row.bookingId || '',
      amount: formatMoney(row.amountInCents, displayCurrency),
      updated: formatDateTime(row.updatedAtMs)
    }));

    if (!rows.length) {
      showToast?.('No finance records to export yet.');
      return;
    }

    const headers = Object.keys(rows[0]);
    const escapeCell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const csv = [
      headers.join(','),
      ...rows.map((row) => headers.map((header) => escapeCell(row[header])).join(','))
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `build-a-booking-finance-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showToast?.('Finance export prepared.');
  };

  return (
    <section className="finance-studio w-full max-w-7xl mx-auto">
      <header className="dashboard-page-header mb-5 md:mb-8 flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4">
        <div>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-black">Finance</h2>
          <p className="mt-2 text-sm md:text-base text-neutral-500 max-w-2xl">
            Track money in, connect gateways, and keep payments tied to bookings without exposing secret keys in the browser.
          </p>
        </div>
        <div className="grid grid-cols-2 sm:flex gap-2 w-full xl:w-auto">
          <button
            type="button"
            onClick={() => openGatewayModal()}
            className="h-12 px-4 md:px-5 rounded-2xl native-gradient-button text-black text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 shadow-xl shadow-black/10"
          >
            <Settings size={15} /> Gateway setup
          </button>
          <button
            type="button"
            onClick={downloadFinanceCsv}
            className="h-12 px-4 md:px-5 rounded-2xl finance-export-button text-black text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 shadow-xl shadow-black/5"
          >
            <Download size={15} /> Export
          </button>
        </div>
      </header>

      <div className="mb-4 md:mb-5">
        <MigrationImportPanel
          canManageWorkspace={canManageWorkspace}
          displayCurrency={displayCurrency}
          importedCounts={importedMigrationCounts}
          onImportMigrationCsv={onImportMigrationCsv}
          onClearMigrationData={onClearMigrationData}
          showToast={showToast}
        />
      </div>

      <div className="finance-hero rounded-[1.25rem] border border-neutral-200 bg-white shadow-sm overflow-hidden">
        <div className="finance-hero-accent" />
        <div className="p-4 md:p-6 border-b border-neutral-100 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Revenue pulse</p>
            <h3 className="mt-1 text-2xl md:text-3xl font-black tracking-tight text-black">{periodRange.label}</h3>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full xl:w-auto">
            <label className="relative sm:w-36">
              <span className="sr-only">Display currency</span>
              <select
                value={displayCurrency}
                onChange={(event) => updateDisplayCurrency(event.target.value)}
                className="h-12 w-full rounded-2xl border border-neutral-100 bg-white px-4 text-[10px] font-black uppercase tracking-widest text-black outline-none focus:border-black"
              >
                {currencyOptions.map((option) => (
                  <option key={option.code} value={option.code}>{option.code}</option>
                ))}
              </select>
            </label>
            <div className="finance-period-tabs schedule-scope-toggle grid grid-cols-4 rounded-lg bg-neutral-100 p-1 min-w-full sm:min-w-[440px]">
              {[
                ['day', 'Day'],
                ['month', 'Monthly'],
                ['year', 'Year'],
                ['all', 'All time']
              ].map(([item, label]) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setPeriod(item)}
                  className={`finance-period-tab h-10 rounded-md text-[9px] md:text-[10px] font-bold uppercase tracking-widest transition-all ${period === item ? 'is-active bg-[#39FF14] text-black shadow-lg shadow-[#39FF14]/20' : 'text-neutral-500 hover:text-black'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="p-4 md:p-6">
          <FinanceTimelineChart buckets={chartBuckets} currency={displayCurrency} statItems={financeStatItems} />
        </div>
      </div>

      <div className="mt-4 md:mt-5">
        <section className="finance-desk rounded-[1.25rem] border border-neutral-200 bg-white shadow-sm overflow-hidden">
          <div className="p-4 md:p-5 border-b border-neutral-100 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Finance desk</p>
              <h3 className="text-2xl font-black tracking-tight text-black mt-1">Transactions and invoices</h3>
            </div>
            <div className="grid grid-cols-3 rounded-2xl border border-neutral-100 bg-neutral-50 p-1 min-w-full sm:min-w-[360px]">
              {[
                ['transactions', 'Transactions'],
                ['invoices', 'Invoices'],
                ['paid', 'Paid']
              ].map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setDeskView(id)}
                  className={`h-10 rounded-xl text-[9px] font-bold uppercase tracking-widest transition-all ${deskView === id ? 'bg-black text-white shadow-lg shadow-black/10' : 'text-neutral-400 hover:text-black'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="p-4 md:p-5 border-b border-neutral-100 grid gap-3 lg:grid-cols-[1fr_220px_220px]">
            <div className="relative">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-300" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search client, gateway, booking, reference"
                aria-label="Search finance records"
                className="h-12 w-full rounded-2xl border border-neutral-200 bg-white pl-11 pr-4 text-sm font-bold text-black outline-none focus:border-black transition-colors placeholder:text-neutral-300"
              />
            </div>
            <select
              aria-label="Filter finance records by status"
              value={deskStatusFilter}
              onChange={(event) => setDeskStatusFilter(event.target.value)}
              className="h-12 rounded-2xl border border-neutral-200 bg-white px-4 text-[10px] font-bold uppercase tracking-widest text-black outline-none focus:border-black"
            >
              <option value="all">All statuses</option>
              <option value="paid">Paid</option>
              <option value="open">Pending payment</option>
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="eft">Manual EFT</option>
            </select>
            <select
              aria-label="Sort finance records"
              value={deskSort}
              onChange={(event) => setDeskSort(event.target.value)}
              className="h-12 rounded-2xl border border-neutral-200 bg-white px-4 text-[10px] font-bold uppercase tracking-widest text-black outline-none focus:border-black"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="amount-high">Amount high</option>
              <option value="amount-low">Amount low</option>
              <option value="client">Client A-Z</option>
              <option value="status">Status A-Z</option>
            </select>
          </div>
          <div className="divide-y divide-neutral-100">
            {visibleDeskRows.map((row) => {
              const gateway = gatewayById[row.gatewayType] || gatewayCards[0];
              return (
                <div key={row.id} className="finance-desk-row p-4 md:p-5 flex flex-col md:flex-row md:items-center gap-4">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span className={`finance-gateway-mark w-11 h-11 rounded-2xl bg-neutral-50 border border-neutral-100 flex items-center justify-center text-black shrink-0 ${gateway.logo ? 'has-logo' : ''}`}>
                      <GatewayLogo gateway={gateway} />
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-black text-black truncate">{row.customerName || 'Client'}</p>
                        {row.isExample && <span className="rounded-full bg-neutral-50 border border-neutral-100 px-2 py-1 text-[8px] font-bold uppercase tracking-widest text-neutral-400">Example</span>}
                        <StatusPill status={row.status} />
                      </div>
                      <p className="mt-1 text-sm text-neutral-500 truncate">{row.description || 'Booking payment'} / {gateway.name}</p>
                      {row.bookingId && (
                        <p className="mt-1 text-[9px] font-bold uppercase tracking-widest text-neutral-300">Reference: {row.bookingId}</p>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:flex md:items-center gap-3 md:text-right">
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-widest text-neutral-400">Amount</p>
                      <p className="font-black text-black">{formatMoney(row.amountInCents, displayCurrency)}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-widest text-neutral-400">Updated</p>
                      <p className="font-bold text-sm text-neutral-500">{formatDateTime(row.updatedAtMs)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => row.canMarkPaid ? onMarkBookingPaid?.(row.originalBooking) : null}
                      disabled={!row.canMarkPaid}
                      className={`h-10 px-3 rounded-xl border text-[9px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 ${row.canMarkPaid ? 'native-gradient-button text-black border-transparent' : 'border-neutral-200 bg-white text-black opacity-60'}`}
                    >
                      {row.canMarkPaid ? 'Mark Paid' : 'View'} <ArrowUpRight size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {gatewayModalOpen && (
        <div className="finance-modal fixed inset-0 z-[1400] bg-black/45 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-6">
          <div className="finance-modal-panel w-full md:max-w-5xl max-h-[92vh] overflow-hidden rounded-t-[1.75rem] md:rounded-[1.5rem] bg-white border border-neutral-200 shadow-2xl shadow-black/30 flex flex-col">
            <div className="p-4 md:p-5 border-b border-neutral-100 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <button type="button" onClick={() => setGatewayModalOpen(false)} className="w-11 h-11 rounded-2xl bg-neutral-50 border border-neutral-100 flex items-center justify-center text-black md:hidden">
                  <ArrowLeft size={18} />
                </button>
                <div className={`finance-gateway-mark w-11 h-11 rounded-2xl native-gradient-button flex items-center justify-center text-black shrink-0 ${selectedGateway.logo ? 'has-logo bg-white border border-neutral-100' : ''}`}>
                  <GatewayLogo gateway={selectedGateway} />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Gateway setup</p>
                  <h3 className="text-2xl font-black tracking-tight text-black truncate">{selectedGateway.name}</h3>
                </div>
              </div>
              <button type="button" onClick={() => setGatewayModalOpen(false)} className="hidden md:flex w-11 h-11 rounded-2xl bg-white border border-neutral-200 items-center justify-center text-black">
                <X size={18} />
              </button>
            </div>

            <div className="finance-modal-body grid lg:grid-cols-[320px_1fr] min-h-0 flex-1 overflow-y-auto lg:overflow-hidden">
              <aside className="finance-modal-gateway-list border-b lg:border-b-0 lg:border-r border-neutral-100 bg-neutral-50/60 p-3 overflow-x-auto lg:overflow-y-auto">
                <div className="flex lg:flex-col gap-2 min-w-max lg:min-w-0">
                  {gatewayCards.map((gateway) => {
                    const active = selectedGatewayId === gateway.id;
                    const enabled = Boolean(drafts[gateway.id]?.enabled);
                    return (
                      <button
                        key={gateway.id}
                        type="button"
                        onClick={() => setSelectedGatewayId(gateway.id)}
                        className={`w-[220px] lg:w-full rounded-2xl border px-3 py-3 flex items-center gap-3 text-left transition-all ${active ? 'bg-black text-white border-black shadow-xl shadow-black/10' : 'bg-white text-black border-neutral-100 hover:border-neutral-300'}`}
                      >
                        <span className={`finance-gateway-mark w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${gateway.logo ? 'has-logo' : ''} ${active ? 'bg-white text-black' : enabled ? 'native-gradient-button text-black' : 'bg-neutral-50 text-black'}`}>
                          <GatewayLogo gateway={gateway} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-black truncate">{gateway.name}</span>
                          <span className={`block text-[9px] font-bold uppercase tracking-widest ${active ? 'text-white/55' : 'text-neutral-400'}`}>
                            {enabled ? 'Enabled' : gateway.region}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </aside>

              <div className="finance-modal-config p-4 md:p-6 overflow-visible lg:overflow-y-auto lg:max-h-full">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                  <div>
                    <p className="text-sm text-neutral-500 max-w-xl">{selectedGateway.note}</p>
                    <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-neutral-50 border border-neutral-100 px-3 py-2 text-[9px] font-bold uppercase tracking-widest text-neutral-400">
                      <LockKeyhole size={13} /> {isManualGateway ? (isCashGateway ? 'No API keys needed' : 'Bank details show to clients') : 'Secrets save through Cloud Functions'}
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-2xl border border-neutral-100 bg-neutral-50 p-3 md:min-w-[220px]">
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-widest text-neutral-400">{isManualGateway ? 'Payment method' : 'Gateway'}</p>
                      <p className="text-sm font-black text-black">{selectedDraft.enabled ? 'Enabled' : 'Disabled'}</p>
                    </div>
                    <Toggle checked={selectedDraft.enabled} onChange={(enabled) => updateDraft(selectedGateway.id, { enabled })} />
                  </div>
                </div>

                {!isManualGateway && (
                  <div className="mt-5 grid grid-cols-2 rounded-2xl border border-neutral-100 bg-neutral-50 p-1">
                    {['test', 'live'].map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => updateDraft(selectedGateway.id, { mode })}
                        className={`h-11 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${selectedDraft.mode === mode ? 'bg-black text-white shadow-lg shadow-black/10' : 'text-neutral-400'}`}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                )}

                <div className="mt-5 grid md:grid-cols-2 gap-3">
                  {selectedGateway.fields.map((field) => (
                    <label key={field.key} className="block">
                      <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-neutral-400">{field.label}</span>
                      <div className={`mt-2 flex gap-2 rounded-2xl border border-neutral-200 bg-white px-3 focus-within:border-black transition-colors ${field.type === 'textarea' ? 'items-start py-3' : 'items-center'}`}>
                        <KeyRound size={15} className="text-neutral-300 shrink-0" />
                        {field.type === 'textarea' ? (
                          <textarea
                            value={selectedDraft.credentials?.[field.key] || ''}
                            onChange={(event) => updateDraft(selectedGateway.id, { credentials: { [field.key]: event.target.value } })}
                            placeholder={selectedPublicConfig.credentialSummary?.[field.key] || `Enter ${field.label.toLowerCase()}`}
                            className="min-h-24 flex-1 min-w-0 resize-none bg-transparent outline-none text-sm font-bold text-black placeholder:text-neutral-300"
                          />
                        ) : (
                          <input
                            type={field.type}
                            value={selectedDraft.credentials?.[field.key] || ''}
                            onChange={(event) => updateDraft(selectedGateway.id, { credentials: { [field.key]: event.target.value } })}
                            placeholder={selectedPublicConfig.credentialSummary?.[field.key] || `Enter ${field.label.toLowerCase()}`}
                            className="h-12 flex-1 min-w-0 bg-transparent outline-none text-sm font-bold text-black placeholder:text-neutral-300"
                            autoComplete="off"
                          />
                        )}
                      </div>
                    </label>
                  ))}
                </div>

                <div className="mt-6 rounded-2xl border border-neutral-100 bg-neutral-50 p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <ShieldCheck size={18} className="text-neutral-400 mt-0.5" />
                    <div>
                      <p className="text-sm font-black text-black">
                        {isCashGateway
                          ? 'Cash instructions are ready for clients'
                          : selectedGateway.id === 'manual_eft'
                            ? 'Use the booking ID as payment reference'
                            : selectedPublicConfig.configured ? 'Saved keys are masked' : 'Add keys once, then save'}
                      </p>
                      <p className="text-sm text-neutral-500 mt-1">
                        {isCashGateway
                          ? 'Clients can choose cash, then your team marks the booking paid once money is received.'
                          : selectedGateway.id === 'manual_eft'
                            ? 'Your bank details appear after booking. The finance desk tracks it until you mark it paid.'
                            : 'Public settings sync to the dashboard. Secret values are stored only by the backend.'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => saveGateway(selectedGateway)}
                    disabled={saving === selectedGateway.id}
                    className="h-12 px-6 rounded-2xl native-gradient-button text-black text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {saving === selectedGateway.id ? <RefreshCw size={15} className="animate-spin" /> : <Check size={15} />}
                    {isCashGateway ? 'Save Cash' : selectedGateway.id === 'manual_eft' ? 'Save EFT' : 'Save Gateway'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </section>
  );
};

