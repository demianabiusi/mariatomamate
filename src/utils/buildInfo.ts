import packageInfo from '../../package.json';

// Injected at build time by Vite define
declare const __BUILD_DATE__: string;

export const BUILD_DATE = typeof __BUILD_DATE__ !== 'undefined' ? __BUILD_DATE__ : new Date().toISOString();
export const APP_VERSION = packageInfo.version;

/**
 * Returns the build date in a readable format: DD/MM/YYYY HH:mm
 */
export function getFormattedBuildDate(): string {
  try {
    const d = new Date(BUILD_DATE);
    if (isNaN(d.getTime())) return BUILD_DATE;
    const pad = (n: number) => String(n).padStart(2, '0');
    const day = pad(d.getDate());
    const month = pad(d.getMonth() + 1);
    const year = d.getFullYear();
    const hours = pad(d.getHours());
    const minutes = pad(d.getMinutes());
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  } catch {
    return BUILD_DATE;
  }
}

/**
 * Returns full build date with seconds and localized format
 */
export function getFullBuildDate(locale: string = 'es-AR'): string {
  try {
    const d = new Date(BUILD_DATE);
    if (isNaN(d.getTime())) return BUILD_DATE;
    return d.toLocaleString(locale === 'es' ? 'es-AR' : 'en-US', {
      dateStyle: 'medium',
      timeStyle: 'medium'
    });
  } catch {
    return BUILD_DATE;
  }
}
