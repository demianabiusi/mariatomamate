import React from 'react';

export type TypeCategory = 'numeric' | 'decimal' | 'text' | 'datetime' | 'json' | 'binary' | 'enum' | 'other';

export interface CategoryTheme {
  category: TypeCategory;
  label: string;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
  badgeBorderFocus: string;
  iconName: 'hash' | 'decimal' | 'type' | 'calendar' | 'braces' | 'binary' | 'tag' | 'box';
  colorHex: string;
}

export const CATEGORY_THEMES: Record<TypeCategory, CategoryTheme> = {
  numeric: {
    category: 'numeric',
    label: 'Numérico Entero',
    badgeBg: 'bg-sky-500/15',
    badgeBorder: 'border-sky-500/30',
    badgeText: 'text-sky-300',
    badgeBorderFocus: 'border-sky-400',
    iconName: 'hash',
    colorHex: '#38bdf8'
  },
  decimal: {
    category: 'decimal',
    label: 'Decimal / Flotante',
    badgeBg: 'bg-cyan-500/15',
    badgeBorder: 'border-cyan-500/30',
    badgeText: 'text-cyan-300',
    badgeBorderFocus: 'border-cyan-400',
    iconName: 'decimal',
    colorHex: '#22d3ee'
  },
  text: {
    category: 'text',
    label: 'Texto / Cadena',
    badgeBg: 'bg-emerald-500/15',
    badgeBorder: 'border-emerald-500/30',
    badgeText: 'text-emerald-300',
    badgeBorderFocus: 'border-emerald-400',
    iconName: 'type',
    colorHex: '#34d399'
  },
  datetime: {
    category: 'datetime',
    label: 'Fecha y Hora',
    badgeBg: 'bg-amber-500/15',
    badgeBorder: 'border-amber-500/30',
    badgeText: 'text-amber-300',
    badgeBorderFocus: 'border-amber-400',
    iconName: 'calendar',
    colorHex: '#fbbf24'
  },
  json: {
    category: 'json',
    label: 'JSON / Documento',
    badgeBg: 'bg-purple-500/15',
    badgeBorder: 'border-purple-500/30',
    badgeText: 'text-purple-300',
    badgeBorderFocus: 'border-purple-400',
    iconName: 'braces',
    colorHex: '#c084fc'
  },
  binary: {
    category: 'binary',
    label: 'Binario / Archivo',
    badgeBg: 'bg-rose-500/15',
    badgeBorder: 'border-rose-500/30',
    badgeText: 'text-rose-300',
    badgeBorderFocus: 'border-rose-400',
    iconName: 'binary',
    colorHex: '#fb7185'
  },
  enum: {
    category: 'enum',
    label: 'Enum / Opciones',
    badgeBg: 'bg-indigo-500/15',
    badgeBorder: 'border-indigo-500/30',
    badgeText: 'text-indigo-300',
    badgeBorderFocus: 'border-indigo-400',
    iconName: 'tag',
    colorHex: '#818cf8'
  },
  other: {
    category: 'other',
    label: 'Otro',
    badgeBg: 'bg-zinc-800/80',
    badgeBorder: 'border-zinc-700',
    badgeText: 'text-zinc-300',
    badgeBorderFocus: 'border-zinc-500',
    iconName: 'box',
    colorHex: '#a1a1aa'
  }
};

/**
 * Returns the semantic category for any MySQL / MariaDB raw data type string.
 */
export function getTypeCategory(typeStr: string = ''): TypeCategory {
  if (!typeStr) return 'other';
  const upper = typeStr.trim().toUpperCase();
  // Strip parentheses and arguments: e.g. "VARCHAR(255)" -> "VARCHAR"
  const clean = upper.split('(')[0].trim().replace(/\s+UNSIGNED|\s+ZEROFILL/g, '');

  if (/^(INT|INTEGER|BIGINT|TINYINT|SMALLINT|MEDIUMINT|BIT|SERIAL)$/.test(clean)) {
    return 'numeric';
  }
  if (/^(DECIMAL|NUMERIC|FLOAT|DOUBLE|REAL|FIXED)$/.test(clean)) {
    return 'decimal';
  }
  if (/^(VARCHAR|CHAR|TEXT|TINYTEXT|MEDIUMTEXT|LONGTEXT|STRING)$/.test(clean)) {
    return 'text';
  }
  if (/^(DATETIME|TIMESTAMP|DATE|TIME|YEAR)$/.test(clean)) {
    return 'datetime';
  }
  if (/^JSON$/.test(clean)) {
    return 'json';
  }
  if (/^(BLOB|TINYBLOB|MEDIUMBLOB|LONGBLOB|BINARY|VARBINARY)$/.test(clean)) {
    return 'binary';
  }
  if (/^(ENUM|SET)$/.test(clean)) {
    return 'enum';
  }
  return 'other';
}

export interface MySQLTypeOption {
  value: string;
  label: string;
  category: TypeCategory;
  hasLength: boolean;
  defaultLength?: string;
  canUnsigned: boolean;
  hint: string;
}

export const MYSQL_DATA_TYPES: MySQLTypeOption[] = [
  // Numeric Integer
  { value: 'INT', label: 'INT (32-bit: -2.1B a +2.1B)', category: 'numeric', hasLength: false, canUnsigned: true, hint: 'Entero estándar de 4 bytes' },
  { value: 'BIGINT', label: 'BIGINT (64-bit grande)', category: 'numeric', hasLength: false, canUnsigned: true, hint: 'Para IDs de alto volumen o contadores gigantes' },
  { value: 'TINYINT', label: 'TINYINT (8-bit / Booleano 0/1)', category: 'numeric', hasLength: false, canUnsigned: true, hint: '1 byte. Habitual para booleanos o estados' },
  { value: 'SMALLINT', label: 'SMALLINT (16-bit: -32K a +32K)', category: 'numeric', hasLength: false, canUnsigned: true, hint: '2 bytes para rangos pequeños/medianos' },
  { value: 'MEDIUMINT', label: 'MEDIUMINT (24-bit: -8M a +8M)', category: 'numeric', hasLength: false, canUnsigned: true, hint: '3 bytes intermedio' },

  // Numeric Decimal
  { value: 'DECIMAL', label: 'DECIMAL(m, d) (Exacto / Moneda)', category: 'decimal', hasLength: true, defaultLength: '10,2', canUnsigned: true, hint: 'Precisión exacta para moneda y contabilidad' },
  { value: 'DOUBLE', label: 'DOUBLE (Flotante 64-bit)', category: 'decimal', hasLength: false, canUnsigned: true, hint: 'Punto flotante de doble precisión' },
  { value: 'FLOAT', label: 'FLOAT (Flotante 32-bit)', category: 'decimal', hasLength: false, canUnsigned: true, hint: 'Punto flotante de simple precisión' },

  // Text & Strings
  { value: 'VARCHAR', label: 'VARCHAR(n) (Texto variable)', category: 'text', hasLength: true, defaultLength: '255', canUnsigned: false, hint: 'Cadenas de longitud variable (hasta 65.535)' },
  { value: 'CHAR', label: 'CHAR(n) (Texto fijo)', category: 'text', hasLength: true, defaultLength: '1', canUnsigned: false, hint: 'Longitud fija (códigos ISO, estados, claves fijas)' },
  { value: 'TEXT', label: 'TEXT (Hasta 64 KB)', category: 'text', hasLength: false, canUnsigned: false, hint: 'Textos extensos, descripciones o notas' },
  { value: 'MEDIUMTEXT', label: 'MEDIUMTEXT (Hasta 16 MB)', category: 'text', hasLength: false, canUnsigned: false, hint: 'Documentos o contenidos web largos' },
  { value: 'LONGTEXT', label: 'LONGTEXT (Hasta 4 GB)', category: 'text', hasLength: false, canUnsigned: false, hint: 'Almacenamiento de texto masivo' },

  // Date & Time
  { value: 'DATETIME', label: 'DATETIME (YYYY-MM-DD HH:MM:SS)', category: 'datetime', hasLength: false, canUnsigned: false, hint: 'Fecha y hora calendario estándar' },
  { value: 'TIMESTAMP', label: 'TIMESTAMP (Zona horaria UTC)', category: 'datetime', hasLength: false, canUnsigned: false, hint: 'Marca temporal UTC, ideal para auditorías' },
  { value: 'DATE', label: 'DATE (YYYY-MM-DD)', category: 'datetime', hasLength: false, canUnsigned: false, hint: 'Solo fecha (sin hora)' },
  { value: 'TIME', label: 'TIME (HH:MM:SS)', category: 'datetime', hasLength: false, canUnsigned: false, hint: 'Solo hora o intervalo de tiempo' },
  { value: 'YEAR', label: 'YEAR (Año)', category: 'datetime', hasLength: false, canUnsigned: false, hint: 'Año (1901 a 2155)' },

  // Structured & Binary
  { value: 'JSON', label: 'JSON (Documento estructurado)', category: 'json', hasLength: false, canUnsigned: false, hint: 'Documentos y arrays con validación nativa' },
  { value: 'BLOB', label: 'BLOB (Binario hasta 64 KB)', category: 'binary', hasLength: false, canUnsigned: false, hint: 'Archivos binarios o imágenes pequeñas' },
  { value: 'MEDIUMBLOB', label: 'MEDIUMBLOB (Binario hasta 16 MB)', category: 'binary', hasLength: false, canUnsigned: false, hint: 'Archivos binarios medianos' },
  { value: 'LONGBLOB', label: 'LONGBLOB (Binario hasta 4 GB)', category: 'binary', hasLength: false, canUnsigned: false, hint: 'Archivos binarios grandes' },

  // Enums
  { value: 'ENUM', label: "ENUM('a','b') (Opciones predefinidas)", category: 'enum', hasLength: true, defaultLength: "'A','B'", canUnsigned: false, hint: 'Lista cerrada de opciones permitidas' }
];

export const TYPE_GROUPS = [
  { key: 'numeric', label: 'Numéricos Enteros', types: ['INT', 'BIGINT', 'TINYINT', 'SMALLINT', 'MEDIUMINT'] },
  { key: 'decimal', label: 'Decimales y Precisión', types: ['DECIMAL', 'DOUBLE', 'FLOAT'] },
  { key: 'text', label: 'Texto y Cadenas', types: ['VARCHAR', 'CHAR', 'TEXT', 'MEDIUMTEXT', 'LONGTEXT'] },
  { key: 'datetime', label: 'Fechas y Horas', types: ['DATETIME', 'TIMESTAMP', 'DATE', 'TIME', 'YEAR'] },
  { key: 'json', label: 'JSON y Estructurados', types: ['JSON'] },
  { key: 'binary', label: 'Binarios', types: ['BLOB', 'MEDIUMBLOB', 'LONGBLOB'] },
  { key: 'enum', label: 'Opciones Especiales', types: ['ENUM'] }
];
