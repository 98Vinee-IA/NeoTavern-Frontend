import { token } from './state/Store';

export function getRequestHeaders({ omitContentType = false } = {}) {
  const tokenValue = token.get();
  if (!tokenValue) {
    throw new Error('CSRF token is not set');
  }

  const headers: {
    'Content-Type'?: string;
    'X-CSRF-Token': string;
  } = {
    'Content-Type': 'application/json',
    'X-CSRF-Token': tokenValue,
  };

  if (omitContentType) {
    delete headers['Content-Type'];
  }

  return headers;
}

export function humanizedDateTime() {
  const now = new Date(Date.now());
  const dt = {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
    hour: now.getHours(),
    minute: now.getMinutes(),
    second: now.getSeconds(),
  };
  for (const key in dt) {
    dt[key as keyof typeof dt] = dt[key as keyof typeof dt].toString().padStart(2, '0') as any;
  }
  return `${dt.year}-${dt.month}-${dt.day}@${dt.hour}h${dt.minute}m${dt.second}s`;
}

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
 * Checks if the given control has an animation applied to it
 *
 * @param {HTMLElement} control - The control element to check for animation
 * @returns {boolean} Whether the control has an animation applied
 */
export function hasAnimation(control: HTMLElement): boolean {
  // @ts-ignore
  const animatioName = getComputedStyle(control, null)['animation-name'];
  return animatioName != 'none';
}

/**
 * Run an action once an animation on a control ends. If the control has no animation, the action will be executed immediately.
 * The action will be executed after the animation ends or after the timeout, whichever comes first.
 * @param {HTMLElement} control - The control element to listen for animation end event
 * @param {(control:*?) => void} callback - The callback function to be executed when the animation ends
 * @param {number} [timeout=500] - The timeout in milliseconds to wait for the animation to end before executing the callback
 */
export function runAfterAnimation(control: HTMLElement, callback: (control: HTMLElement) => void, timeout = 500) {
  if (hasAnimation(control)) {
    Promise.race([
      new Promise((r) => setTimeout(r, timeout)), // Fallback timeout
      new Promise((r) => control.addEventListener('animationend', r, { once: true })),
    ]).finally(() => callback(control));
  } else {
    callback(control);
  }
}

export function removeFromArray<T>(arr: T[], item: T): boolean {
  const index = arr.indexOf(item);
  if (index > -1) {
    arr.splice(index, 1);
    return true;
  }
  return false;
}

export function onlyUnique<T>(value: T, index: number, self: T[]): boolean {
  return self.indexOf(value) === index;
}

/**
 * Returns a promise that resolves after the specified number of milliseconds.
 */
export function delay(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

export function getMessageTimeStamp() {
  const date = Date.now();
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
  const d = new Date(date);
  const month = months[d.getMonth()];
  const day = d.getDate();
  const year = d.getFullYear();
  let hours = d.getHours();
  const minutes = ('0' + d.getMinutes()).slice(-2);
  let meridiem = 'am';
  if (hours >= 12) {
    meridiem = 'pm';
    hours -= 12;
  }
  if (hours === 0) {
    hours = 12;
  }
  const formattedDate = month + ' ' + day + ', ' + year + ' ' + hours + ':' + minutes + meridiem;
  return formattedDate;
}
