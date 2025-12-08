export function onlyUnique<T>(value: T, index: number, self: T[]): boolean {
  return self.indexOf(value) === index;
}

export function uuidv4() {
  if ('randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * A utility class for generating string hash codes. Cryptographically insecure but fast.
 */
export class StringHash {
  private static cyrb64(str: string, seed: number = 0): [number, number] {
    let h1 = 0xdeadbeef ^ seed,
      h2 = 0x41c6ce57 ^ seed;
    for (let i = 0, ch; i < str.length; i++) {
      ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return [h1, h2];
  }

  static get(str: string, seed: number = 0): string {
    if (typeof str !== 'string') return '0'.repeat(14);
    const [h1, h2] = this.cyrb64(str, seed);
    return (h2 >>> 0).toString(36).padStart(7, '0') + (h1 >>> 0).toString(36).padStart(7, '0');
  }

  static legacy(str: string, seed: number = 0): number {
    if (typeof str !== 'string') return 0;
    const [h1, h2] = this.cyrb64(str, seed);
    return 4294967296 * (2097151 & h2) + (h1 >>> 0);
  }
}

// --- Date Utils ---

export function humanizedDateTime() {
  const now = new Date(Date.now());
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  };
  return now.toLocaleString(undefined, options);
}

export function getMessageTimeStamp(): string {
  return new Date().toISOString();
}

export function formatTimeStamp(dateString?: string | number): string {
  if (!dateString) return '';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return String(dateString);

  const months = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  return (
    `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} ` +
    `${d.getHours() % 12 || 12}:${('0' + d.getMinutes()).slice(-2)}${d.getHours() >= 12 ? 'pm' : 'am'}`
  );
}

// --- File Utils ---

export function getBase64Async(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = function () {
      resolve(String(reader.result));
    };
    reader.onerror = function (error) {
      reject(error);
    };
  });
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsText(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
}

export function downloadFile(content: string, fileName: string, contentType: string) {
  const a = document.createElement('a');
  const file = new Blob([content], { type: contentType });
  a.href = URL.createObjectURL(file);
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
}
