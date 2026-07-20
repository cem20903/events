const STORAGE_KEY = 'misevents_instagram';

export function normalizeInstagram(raw) {
  if (!raw) return '';
  let value = raw.trim();
  const urlMatch = value.match(/instagram\.com\/([^/?]+)/i);
  if (urlMatch) value = urlMatch[1];
  return value.replace(/^@/, '').trim().toLowerCase();
}

export function getStoredInstagram() {
  return localStorage.getItem(STORAGE_KEY) || '';
}

export function setStoredInstagram(instagram) {
  localStorage.setItem(STORAGE_KEY, instagram);
}
