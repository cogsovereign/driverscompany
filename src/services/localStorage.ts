import {
  BillingConfig,
  SavedRecipient,
  SavedSubmission,
  SenderProfile,
  StorageSchema,
  StructuredHours,
} from '../types/storage';

const STORAGE_KEY = 'drivers_company_data';
const STORAGE_VERSION = 1;


const getDefaultStructuredHours = (): StructuredHours => ({
  lunedi: { isOpen: true, openTime: '09:00', closeTime: '18:00' },
  martedi: { isOpen: true, openTime: '09:00', closeTime: '18:00' },
  mercoledi: { isOpen: true, openTime: '09:00', closeTime: '18:00' },
  giovedi: { isOpen: true, openTime: '09:00', closeTime: '18:00' },
  venerdi: { isOpen: true, openTime: '09:00', closeTime: '18:00' },
  sabato: { isOpen: false, openTime: '09:00', closeTime: '13:00' },
  domenica: { isOpen: false, openTime: '09:00', closeTime: '13:00' },
});

export const getDefaultStorage = (): StorageSchema => ({
  version: STORAGE_VERSION,
  senderProfile: null,
  addressBook: [],
  submissions: [],
  billingConfig: {
    costPerDelivery: 0,
    costPerPickup: 0,
    lastUpdated: '',
  },
});

export const getStorage = (): StorageSchema => {
  if (typeof window === 'undefined') {
    return getDefaultStorage();
  }

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return getDefaultStorage();
    }

    const parsed = JSON.parse(stored) as StorageSchema;

    if (parsed.version !== STORAGE_VERSION) {
      return getDefaultStorage();
    }

    return parsed;
  } catch {
    return getDefaultStorage();
  }
};

export const saveStorage = (data: StorageSchema): void => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Silently fail on quota exceeded or other storage errors
  }
};

export const getSenderProfile = (): SenderProfile | null => {
  const storage = getStorage();
  const profile = storage.senderProfile;
  if (!profile) return null;
  return {
    ...profile,
    billingClient: profile.billingClient || '',
  };
};

export const saveSenderProfile = (profile: SenderProfile): void => {
  const storage = getStorage();
  storage.senderProfile = {
    ...profile,
    lastUpdated: new Date().toISOString(),
  };
  saveStorage(storage);
};

export const getAddressBook = (): SavedRecipient[] => {
  const storage = getStorage();
  const original = storage.addressBook || [];
  const deduped = dedupeAddressBook(original);

  // If we cleaned anything up, persist the cleaned list so it stays clean
  if (deduped.length !== original.length) {
    storage.addressBook = deduped;
    saveStorage(storage);
  }

  // Return sorted by lastUsed DESC (most recently used first) for nicer UX
  return [...deduped].sort((a, b) =>
    (b.lastUsed || '').localeCompare(a.lastUsed || '')
  );
};

// Normalize destination + address into a stable dedup key
const recipientKey = (destination: string, shippingAddress: string): string => {
  const normalize = (s: string) =>
    (s || '').trim().toLowerCase().replace(/\s+/g, ' ');
  return `${normalize(destination)}|${normalize(shippingAddress)}`;
};

// Remove duplicate recipients (same destination + address), keeping the most recently used one
export const dedupeAddressBook = (recipients: SavedRecipient[]): SavedRecipient[] => {
  const byKey = new Map<string, SavedRecipient>();
  // Sort by lastUsed DESC so we keep the most recent entry per key
  const sorted = [...recipients].sort((a, b) =>
    (b.lastUsed || '').localeCompare(a.lastUsed || '')
  );
  for (const r of sorted) {
    const key = recipientKey(r.destination, r.shippingAddress);
    if (!key || key === '|') continue; // skip empties
    if (!byKey.has(key)) {
      byKey.set(key, r);
    }
  }
  return Array.from(byKey.values());
};

export const saveRecipient = (recipient: SavedRecipient): void => {
  const storage = getStorage();
  const key = recipientKey(recipient.destination, recipient.shippingAddress);

  // If destination + address are empty, ignore
  if (!key || key === '|') {
    return;
  }

  const existingIndex = storage.addressBook.findIndex(
    (r) => recipientKey(r.destination, r.shippingAddress) === key
  );

  const now = new Date().toISOString();

  if (existingIndex >= 0) {
    // Update existing record in place; keep its original id for stability
    const existing = storage.addressBook[existingIndex];
    const preferNonEmpty = (next: string, prev: string): string =>
      (next || '').trim() ? next : (prev || '');
    storage.addressBook[existingIndex] = {
      ...existing,
      destination: recipient.destination,
      shippingAddress: recipient.shippingAddress,
      phoneNumber: preferNonEmpty(recipient.phoneNumber, existing.phoneNumber),
      deliveryTime: preferNonEmpty(recipient.deliveryTime, existing.deliveryTime),
      specialInstructions: preferNonEmpty(recipient.specialInstructions, existing.specialInstructions),
      lastUsed: now,
    };
  } else {
    storage.addressBook.push({
      ...recipient,
      lastUsed: now,
    });
  }

  // Always dedupe on save to clean up any legacy duplicates retroactively
  storage.addressBook = dedupeAddressBook(storage.addressBook);

  saveStorage(storage);
};

export const removeRecipient = (id: string): void => {
  const storage = getStorage();
  storage.addressBook = storage.addressBook.filter((r) => r.id !== id);
  saveStorage(storage);
};



export const getBillingConfig = (): BillingConfig => {
  const storage = getStorage();
  return storage.billingConfig;
};

export const saveBillingConfig = (config: BillingConfig): void => {
  const storage = getStorage();
  storage.billingConfig = {
    ...config,
    lastUpdated: new Date().toISOString(),
  };
  saveStorage(storage);
};

export const saveSubmission = (submission: SavedSubmission): void => {
  const storage = getStorage();
  storage.submissions.unshift(submission);
  if (storage.submissions.length > 50) {
    storage.submissions = storage.submissions.slice(0, 50);
  }
  saveStorage(storage);
};

export const getSubmissions = (): SavedSubmission[] => {
  return getStorage().submissions;
};

export const clearSubmissions = (): void => {
  const storage = getStorage();
  storage.submissions = [];
  saveStorage(storage);
};

export const clearAll = (): void => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Silently fail
  }
};
