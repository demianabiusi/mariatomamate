import {
  SchemaDiffResult,
  TableDiffItem,
  GenericObjectDiffItem,
  DiffStatus
} from '../types';

export type ObjectCategory = 'TABLE' | 'VIEW' | 'PROCEDURE' | 'FUNCTION' | 'TRIGGER' | 'EVENT';

export interface DependencyResolveOptions {
  recursive: boolean;
  includeTablesAndFks: boolean;
  includeViews: boolean;
  includeRoutines: boolean;
  includeTableTriggers: boolean;
}

export interface ResolvedDependencyItem {
  key: string; // e.g. "table:users", "procedure:sp_calc"
  type: ObjectCategory;
  name: string;
  status: DiffStatus;
  isRoot: boolean;
  depth: number;
  requiredBy: string[]; // Names of objects that directly reference this object
  dependencyChain: string[]; // Path from root object, e.g. ["sp_facturar", "facturas", "clientes"]
  reasons: string[];
}

export interface DependencyAnalysisResult {
  items: ResolvedDependencyItem[];
  rootCount: number;
  dependencyCount: number;
  diffCount: number; // missing_in_target or different
  identicalCount: number;
  notFoundInputs: string[];
  selectedMap: Record<string, boolean>; // Ready to apply to SchemaDiffModal selectedItems
}

const KEY_PREFIX_BY_TYPE: Record<ObjectCategory, string> = {
  TABLE: 'table',
  VIEW: 'view',
  PROCEDURE: 'procedure',
  FUNCTION: 'function',
  TRIGGER: 'trigger',
  EVENT: 'event'
};

export function makeObjectKey(type: ObjectCategory, name: string): string {
  return `${KEY_PREFIX_BY_TYPE[type]}:${name}`;
}

/**
 * Parses a free-form user input string (lines, commas, semicolons, SQL snippets)
 * into clean object names and optional type hints.
 */
export function parseObjectListInput(rawInput: string): { typeHint?: ObjectCategory; name: string }[] {
  if (!rawInput || !rawInput.trim()) return [];

  // Strip block and line comments if user pasted from SQL script
  const withoutComments = rawInput
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--.*$/gm, ' ')
    .replace(/#.*$/gm, ' ');

  const rawTokens = withoutComments
    .split(/[\r\n,;]+/)
    .map(s => s.trim())
    .filter(Boolean);

  const results: { typeHint?: ObjectCategory; name: string }[] = [];
  const seen = new Set<string>();

  for (const rawLine of rawTokens) {
    let line = rawLine.trim();
    if (!line) continue;

    let typeHint: ObjectCategory | undefined;

    // Check explicit prefix like "table:users" or "procedure:sp_x"
    const prefixMatch = line.match(/^(table|view|procedure|proc|sp|function|func|fn|trigger|event)\s*:\s*(.+)$/i);
    if (prefixMatch) {
      const p = prefixMatch[1].toUpperCase();
      if (p === 'TABLE') typeHint = 'TABLE';
      else if (p === 'VIEW') typeHint = 'VIEW';
      else if (p === 'PROCEDURE' || p === 'PROC' || p === 'SP') typeHint = 'PROCEDURE';
      else if (p === 'FUNCTION' || p === 'FUNC' || p === 'FN') typeHint = 'FUNCTION';
      else if (p === 'TRIGGER') typeHint = 'TRIGGER';
      else if (p === 'EVENT') typeHint = 'EVENT';
      line = prefixMatch[2].trim();
    } else {
      // Check SQL DDL / CALL prefixes like "CREATE PROCEDURE sp_x", "CALL sp_x", "TABLE users"
      const sqlPrefixMatch = line.match(
        /^(?:CREATE\s+(?:OR\s+REPLACE\s+)?(?:DEFINER\s*=\s*\S+\s+)?|ALTER\s+|DROP\s+(?:IF\s+EXISTS\s+)?)?(TABLE|VIEW|PROCEDURE|FUNCTION|TRIGGER|EVENT|CALL)\s+(.+)$/i
      );
      if (sqlPrefixMatch) {
        const kw = sqlPrefixMatch[1].toUpperCase();
        if (kw === 'CALL') typeHint = 'PROCEDURE';
        else typeHint = kw as ObjectCategory;
        line = sqlPrefixMatch[2].trim();
      }
    }

    // Split remaining tokens if separated by spaces (unless single quoted/backticked name)
    const subTokens = line.split(/\s+/).filter(Boolean);
    for (let tok of subTokens) {
      // Remove trailing parameters/parens like sp_name(a, b)
      tok = tok.replace(/\([^)]*\).*$/, '');
      // Remove quotes and backticks
      tok = tok.replace(/[`'"]/g, '').trim();
      // If qualified with database name (db.object_name), keep the object_name
      if (tok.includes('.')) {
        const parts = tok.split('.').filter(Boolean);
        tok = parts[parts.length - 1];
      }
      tok = tok.replace(/[^a-zA-Z0-9_$]/g, '');
      if (!tok) continue;

      const upperTok = tok.toUpperCase();
      if (
        ['CREATE', 'OR', 'REPLACE', 'ALTER', 'DROP', 'IF', 'EXISTS', 'NOT', 'TABLE', 'VIEW', 'PROCEDURE', 'FUNCTION', 'TRIGGER', 'EVENT', 'CALL'].includes(
          upperTok
        )
      ) {
        continue;
      }

      const dedupKey = `${typeHint || 'ANY'}:${tok.toLowerCase()}`;
      if (!seen.has(dedupKey)) {
        seen.add(dedupKey);
        results.push({ typeHint, name: tok });
      }
    }
  }

  return results;
}

/**
 * Strips SQL comments and replaces string literals with placeholders
 * while preserving MySQL conditional comments (e.g. /*!50003 ... * /).
 */
export function stripSqlCommentsAndStrings(sql: string): string {
  if (!sql) return '';

  // 1. Unwrap MySQL versioned comments /*!50003 ... */ -> keep inner content
  let cleaned = sql.replace(/\/\*!(?:\d+)?\s*([\s\S]*?)\*\//g, ' $1 ');

  // 2. Remove normal block comments /* ... */
  cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, ' ');

  // 3. Remove single-line comments (-- ... and # ...) and replace string literals
  // We scan character by character to handle quotes and comments accurately
  let out = '';
  let i = 0;
  const len = cleaned.length;

  while (i < len) {
    const ch = cleaned[i];
    const next = cleaned[i + 1];

    // Single-line comment --
    if (ch === '-' && next === '-') {
      i += 2;
      while (i < len && cleaned[i] !== '\n') i++;
      out += ' ';
      continue;
    }

    // Single-line comment #
    if (ch === '#') {
      i += 1;
      while (i < len && cleaned[i] !== '\n') i++;
      out += ' ';
      continue;
    }

    // Single-quoted string '...'
    if (ch === "'") {
      i += 1;
      while (i < len) {
        if (cleaned[i] === '\\') {
          i += 2;
          continue;
        }
        if (cleaned[i] === "'" && cleaned[i + 1] === "'") {
          i += 2;
          continue;
        }
        if (cleaned[i] === "'") {
          i += 1;
          break;
        }
        i += 1;
      }
      out += " '__STR__' ";
      continue;
    }

    // Double-quoted string "..."
    if (ch === '"') {
      i += 1;
      while (i < len) {
        if (cleaned[i] === '\\') {
          i += 2;
          continue;
        }
        if (cleaned[i] === '"' && cleaned[i + 1] === '"') {
          i += 2;
          continue;
        }
        if (cleaned[i] === '"') {
          i += 1;
          break;
        }
        i += 1;
      }
      out += " '__STR__' ";
      continue;
    }

    out += ch;
    i++;
  }

  return out;
}

/**
 * Skips the CREATE header of a routine/view/trigger so we only scan its actual body
 * and don't confuse its own declaration name or parameter names with dependencies.
 */
function extractSqlBody(cleanedSql: string, type: ObjectCategory): { body: string; triggerTable?: string } {
  if (type === 'VIEW') {
    const asMatch = cleanedSql.match(/\bVIEW\s+(?:`?[a-zA-Z0-9_$]+`?\s*\.\s*)?`?[a-zA-Z0-9_$]+`?\s+AS\s+/i);
    if (asMatch && asMatch.index !== undefined) {
      return { body: cleanedSql.slice(asMatch.index + asMatch[0].length) };
    }
    return { body: cleanedSql };
  }

  if (type === 'TRIGGER') {
    const onMatch = cleanedSql.match(
      /\bON\s+(?:`?[a-zA-Z0-9_$]+`?\s*\.\s*)?`?([a-zA-Z0-9_$]+)`?\s+FOR\s+EACH\s+ROW\b/i
    );
    if (onMatch && onMatch.index !== undefined) {
      return {
        triggerTable: onMatch[1],
        body: cleanedSql.slice(onMatch.index + onMatch[0].length)
      };
    }
    return { body: cleanedSql };
  }

  if (type === 'PROCEDURE' || type === 'FUNCTION') {
    const headerMatch = cleanedSql.match(
      new RegExp(`\\b${type}\\s+(?:\`?[a-zA-Z0-9_$]+\`?\\s*\\.\\s*)?\`?[a-zA-Z0-9_$]+\`?\\s*\\(`, 'i')
    );
    if (headerMatch && headerMatch.index !== undefined) {
      // Find matching closing parenthesis of the parameter list
      let idx = headerMatch.index + headerMatch[0].length - 1; // at '('
      let depth = 0;
      while (idx < cleanedSql.length) {
        if (cleanedSql[idx] === '(') depth++;
        else if (cleanedSql[idx] === ')') {
          depth--;
          if (depth === 0) {
            return { body: cleanedSql.slice(idx + 1) };
          }
        }
        idx++;
      }
    }
    return { body: cleanedSql };
  }

  if (type === 'EVENT') {
    const doMatch = cleanedSql.match(/\bDO\b/i);
    if (doMatch && doMatch.index !== undefined) {
      return { body: cleanedSql.slice(doMatch.index + doMatch[0].length) };
    }
  }

  return { body: cleanedSql };
}

const STOP_CLAUSE_KEYWORDS = new Set([
  'WHERE',
  'SET',
  'GROUP',
  'HAVING',
  'ORDER',
  'LIMIT',
  'UNION',
  'INTO',
  'FOR',
  'LOCK',
  'WINDOW',
  'VALUES',
  'VALUE',
  'SELECT',
  'LEFT',
  'RIGHT',
  'INNER',
  'OUTER',
  'CROSS',
  'STRAIGHT_JOIN',
  'NATURAL',
  'JOIN',
  'ON',
  'USING',
  'PARTITION',
  'PROCEDURE'
]);

/**
 * Analyzes a SQL DDL string and extracts references to existing tables, views, procedures, and functions.
 */
export function extractDependenciesFromSql(
  rawDdl: string,
  selfType: ObjectCategory,
  selfName: string,
  sourceDb: string,
  catalog: {
    tables: Map<string, TableDiffItem>;
    views: Map<string, GenericObjectDiffItem>;
    procedures: Map<string, GenericObjectDiffItem>;
    functions: Map<string, GenericObjectDiffItem>;
  },
  options: DependencyResolveOptions
): { type: ObjectCategory; name: string; reason: string }[] {
  if (!rawDdl) return [];

  const found = new Map<string, { type: ObjectCategory; name: string; reason: string }>();
  const selfLower = selfName.toLowerCase();

  const addDep = (type: ObjectCategory, actualName: string, reason: string) => {
    if (type === selfType && actualName.toLowerCase() === selfLower) return;
    const key = makeObjectKey(type, actualName);
    if (!found.has(key)) {
      found.set(key, { type, name: actualName, reason });
    }
  };

  let cleaned = stripSqlCommentsAndStrings(rawDdl);

  // Strip schema prefix if matches sourceDb (e.g. `my_db`.`my_table` -> `my_table`)
  if (sourceDb) {
    const escapedDb = sourceDb.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    cleaned = cleaned.replace(new RegExp('`' + escapedDb + '`\\s*\\.\\s*', 'gi'), '');
    cleaned = cleaned.replace(new RegExp('\\b' + escapedDb + '\\s*\\.\\s*', 'gi'), '');
  }

  const { body, triggerTable } = extractSqlBody(cleaned, selfType);

  // If this is a trigger, it directly depends on its target table
  if (triggerTable && options.includeTablesAndFks) {
    const tMatch = catalog.tables.get(triggerTable.toLowerCase());
    if (tMatch) {
      addDep('TABLE', tMatch.name, `Tabla objetivo del trigger ${selfName}`);
    }
  }

  // 1. Detect Procedures called via CALL
  if (options.includeRoutines) {
    const callRegex = /\bCALL\s+(?:`?[a-zA-Z0-9_$]+`?\s*\.\s*)?`?([a-zA-Z0-9_$]+)`?/gi;
    let m: RegExpExecArray | null;
    while ((m = callRegex.exec(body)) !== null) {
      const candidate = m[1].toLowerCase();
      const proc = catalog.procedures.get(candidate);
      if (proc) {
        addDep('PROCEDURE', proc.name, `Invocado con CALL en ${selfName}`);
      }
    }

    // 2. Detect Functions invoked as fn_name(...)
    const fnRegex = /(?:^|[^.`a-zA-Z0-9_$])`?([a-zA-Z0-9_$]+)`?\s*\(/g;
    while ((m = fnRegex.exec(body)) !== null) {
      const candidate = m[1].toLowerCase();
      const fn = catalog.functions.get(candidate);
      if (fn) {
        addDep('FUNCTION', fn.name, `Función invocada en ${selfName}`);
      }
    }
  }

  // 3. Detect Tables and Views
  if (options.includeTablesAndFks || options.includeViews) {
    const checkTableOrView = (candidateRaw: string, contextLabel: string) => {
      const candidate = candidateRaw.replace(/[`'"]/g, '').trim().toLowerCase();
      if (!candidate) return;
      if (options.includeTablesAndFks) {
        const tbl = catalog.tables.get(candidate);
        if (tbl) {
          addDep('TABLE', tbl.name, `${contextLabel} en ${selfName}`);
          return;
        }
      }
      if (options.includeViews) {
        const vw = catalog.views.get(candidate);
        if (vw) {
          addDep('VIEW', vw.name, `${contextLabel} en ${selfName}`);
          return;
        }
      }
    };

    // 3a. Single-table keywords: JOIN, INTO, TABLE, LIKE, DESCRIBE, REFERENCES
    const singleTableRegex =
      /\b(JOIN|INTO|TABLE|TABLES|LIKE|DESCRIBE|REFERENCES)\s+(?:LOW_PRIORITY\s+|DELAYED\s+|HIGH_PRIORITY\s+|IGNORE\s+|TEMPORARY\s+|IF\s+EXISTS\s+|IF\s+NOT\s+EXISTS\s+)*(?:`?[a-zA-Z0-9_$]+`?\s*\.\s*)?`?([a-zA-Z0-9_$]+)`?/gi;
    let sm: RegExpExecArray | null;
    while ((sm = singleTableRegex.exec(body)) !== null) {
      const kw = sm[1].toUpperCase();
      const ident = sm[2];
      checkTableOrView(ident, `Referencia (${kw})`);
    }

    // 3b. INSERT / REPLACE without INTO (e.g. INSERT `tabla` VALUES ...)
    const insertRegex =
      /\b(INSERT|REPLACE)\s+(?:LOW_PRIORITY\s+|DELAYED\s+|HIGH_PRIORITY\s+|IGNORE\s+)*(?:INTO\s+)?(?:`?[a-zA-Z0-9_$]+`?\s*\.\s*)?`?([a-zA-Z0-9_$]+)`?/gi;
    while ((sm = insertRegex.exec(body)) !== null) {
      checkTableOrView(sm[2], `Escritura (${sm[1].toUpperCase()})`);
    }

    // 3c. Multi-table clauses: FROM and UPDATE (supports comma-separated tables and parenthesized MySQL view joins)
    const multiClauseRegex = /\b(FROM|UPDATE)\b\s+([\s\S]{1,1500}?)(?=\b(?:WHERE|SET|GROUP|HAVING|ORDER|LIMIT|UNION|VALUES|SELECT)\b|;|$)/gi;
    while ((sm = multiClauseRegex.exec(body)) !== null) {
      const clauseKw = sm[1].toUpperCase();
      const segment = sm[2];

      // Split by comma to handle FROM t1 a, t2 b or UPDATE t1 a, t2 b
      const commaParts = segment.split(',');
      for (const part of commaParts) {
        // Strip leading parentheses (MySQL SHOW CREATE VIEW uses `from ((`t1` join `t2`))`)
        let trimmed = part.replace(/^[\s(]+/, '').trim();
        if (!trimmed) continue;

        // Skip modifiers
        trimmed = trimmed.replace(/^(?:LOW_PRIORITY|IGNORE|LATERAL)\s+/i, '').trim();

        // If starts with SELECT, it's a subquery (its inner FROM will be matched separately)
        if (/^SELECT\b/i.test(trimmed)) continue;

        // Extract first identifier
        const firstIdentMatch = trimmed.match(/^(?:`?[a-zA-Z0-9_$]+`?\s*\.\s*)?`?([a-zA-Z0-9_$]+)`?/);
        if (firstIdentMatch) {
          const ident = firstIdentMatch[1];
          if (!STOP_CLAUSE_KEYWORDS.has(ident.toUpperCase())) {
            checkTableOrView(ident, `Consulta (${clauseKw})`);
          }
        }
      }
    }

    // 3d. Qualified column access `table_or_view`.`column` where qualifier is an actual table/view name
    const qualifiedDotRegex = /`?([a-zA-Z0-9_$]+)`?\s*\.\s*`?[a-zA-Z0-9_$]+`?/g;
    while ((sm = qualifiedDotRegex.exec(body)) !== null) {
      checkTableOrView(sm[1], `Referencia calificada`);
    }
  }

  return Array.from(found.values());
}

/**
 * Resolves all direct and (optionally) transitive dependencies for a given list of object names
 * against a SchemaDiffResult.
 */
export function resolveObjectDependencies(
  diff: SchemaDiffResult,
  rawInputList: string,
  options: DependencyResolveOptions
): DependencyAnalysisResult {
  // 1. Build lookup maps (case-insensitive)
  const tableMap = new Map<string, TableDiffItem>();
  const viewMap = new Map<string, GenericObjectDiffItem>();
  const procMap = new Map<string, GenericObjectDiffItem>();
  const funcMap = new Map<string, GenericObjectDiffItem>();
  const triggerMap = new Map<string, GenericObjectDiffItem>();
  const eventMap = new Map<string, GenericObjectDiffItem>();

  for (const t of diff.tables) tableMap.set(t.name.toLowerCase(), t);
  for (const v of diff.views) viewMap.set(v.name.toLowerCase(), v);
  for (const p of diff.procedures) procMap.set(p.name.toLowerCase(), p);
  for (const f of diff.functions) funcMap.set(f.name.toLowerCase(), f);
  for (const tr of diff.triggers) triggerMap.set(tr.name.toLowerCase(), tr);
  for (const ev of diff.events) eventMap.set(ev.name.toLowerCase(), ev);

  const catalog = {
    tables: tableMap,
    views: viewMap,
    procedures: procMap,
    functions: funcMap
  };

  // Pre-compute table -> triggers map for includeTableTriggers
  const triggersByTable = new Map<string, GenericObjectDiffItem[]>();
  for (const tr of diff.triggers) {
    const ddl = tr.sourceDdl || tr.createSql || tr.targetDdl || '';
    const cleaned = stripSqlCommentsAndStrings(ddl);
    const { triggerTable } = extractSqlBody(cleaned, 'TRIGGER');
    if (triggerTable) {
      const lowerTbl = triggerTable.toLowerCase();
      if (!triggersByTable.has(lowerTbl)) triggersByTable.set(lowerTbl, []);
      triggersByTable.get(lowerTbl)!.push(tr);
    }
  }

  // 2. Parse user input and locate root objects
  const parsedInputs = parseObjectListInput(rawInputList);
  const notFoundInputs: string[] = [];
  const resolvedMap = new Map<string, ResolvedDependencyItem>();
  const queue: string[] = [];

  const getObjectMeta = (type: ObjectCategory, lowerName: string): { name: string; status: DiffStatus; ddl?: string; table?: TableDiffItem } | null => {
    if (type === 'TABLE') {
      const t = tableMap.get(lowerName);
      return t ? { name: t.name, status: t.status, ddl: t.createSql || t.sourceTable?.rawDdl, table: t } : null;
    }
    const map =
      type === 'VIEW' ? viewMap :
      type === 'PROCEDURE' ? procMap :
      type === 'FUNCTION' ? funcMap :
      type === 'TRIGGER' ? triggerMap :
      eventMap;
    const obj = map.get(lowerName);
    return obj ? { name: obj.name, status: obj.status, ddl: obj.sourceDdl || obj.createSql || obj.targetDdl } : null;
  };

  const addOrUpdateNode = (
    type: ObjectCategory,
    name: string,
    status: DiffStatus,
    isRoot: boolean,
    depth: number,
    parentName: string | null,
    parentChain: string[],
    reason: string
  ): boolean => {
    const key = makeObjectKey(type, name);
    const existing = resolvedMap.get(key);
    if (existing) {
      if (isRoot) existing.isRoot = true;
      if (parentName && !existing.requiredBy.includes(parentName)) {
        existing.requiredBy.push(parentName);
      }
      if (reason && !existing.reasons.includes(reason)) {
        existing.reasons.push(reason);
      }
      return false; // Already visited
    }

    resolvedMap.set(key, {
      key,
      type,
      name,
      status,
      isRoot,
      depth,
      requiredBy: parentName ? [parentName] : [],
      dependencyChain: [...parentChain, name],
      reasons: [reason]
    });
    return true;
  };

  for (const inp of parsedInputs) {
    const lower = inp.name.toLowerCase();
    let matchedAny = false;

    const typesToTry: ObjectCategory[] = inp.typeHint
      ? [inp.typeHint]
      : ['PROCEDURE', 'TABLE', 'VIEW', 'FUNCTION', 'TRIGGER', 'EVENT'];

    for (const t of typesToTry) {
      const meta = getObjectMeta(t, lower);
      if (meta) {
        matchedAny = true;
        const isNew = addOrUpdateNode(t, meta.name, meta.status, true, 0, null, [], 'Solicitado en la lista');
        if (isNew) {
          queue.push(makeObjectKey(t, meta.name));
        }
      }
    }

    if (!matchedAny) {
      notFoundInputs.push(inp.name);
    }
  }

  // 3. Breadth-First Search (BFS) to discover dependencies
  while (queue.length > 0) {
    const currKey = queue.shift()!;
    const currNode = resolvedMap.get(currKey)!;

    // If recursive is disabled, only expand root nodes (depth === 0)
    if (!options.recursive && currNode.depth >= 1) {
      continue;
    }

    const meta = getObjectMeta(currNode.type, currNode.name.toLowerCase());
    if (!meta) continue;

    if (currNode.type === 'TABLE' && meta.table) {
      const tbl = meta.table;

      // 3a. Foreign Key dependencies
      if (options.includeTablesAndFks) {
        const fks = tbl.sourceTable?.foreignKeys || {};
        for (const [fkName, fk] of Object.entries(fks) as [string, any][]) {
          const refTableLower = (fk.referencedTable || '').toLowerCase();
          if (refTableLower && refTableLower !== tbl.name.toLowerCase()) {
            const refMeta = getObjectMeta('TABLE', refTableLower);
            if (refMeta) {
              const isNew = addOrUpdateNode(
                'TABLE',
                refMeta.name,
                refMeta.status,
                false,
                currNode.depth + 1,
                currNode.name,
                currNode.dependencyChain,
                `FK ${fkName} (${tbl.name}.${fk.column} → ${refMeta.name}.${fk.referencedColumn})`
              );
              if (isNew) queue.push(makeObjectKey('TABLE', refMeta.name));
            }
          }
        }
      }

      // 3b. Associated Triggers on this table
      if (options.includeTableTriggers) {
        const trigs = triggersByTable.get(tbl.name.toLowerCase()) || [];
        for (const tr of trigs) {
          const isNew = addOrUpdateNode(
            'TRIGGER',
            tr.name,
            tr.status,
            false,
            currNode.depth + 1,
            currNode.name,
            currNode.dependencyChain,
            `Trigger asociado a la tabla ${tbl.name}`
          );
          if (isNew) queue.push(makeObjectKey('TRIGGER', tr.name));
        }
      }
    } else if (meta.ddl) {
      // Routine, View, Trigger, or Event -> Parse SQL DDL
      const deps = extractDependenciesFromSql(
        meta.ddl,
        currNode.type,
        currNode.name,
        diff.sourceDb,
        catalog,
        options
      );

      for (const dep of deps) {
        const depMeta = getObjectMeta(dep.type, dep.name.toLowerCase());
        if (depMeta) {
          const isNew = addOrUpdateNode(
            dep.type,
            depMeta.name,
            depMeta.status,
            false,
            currNode.depth + 1,
            currNode.name,
            currNode.dependencyChain,
            dep.reason
          );
          if (isNew) queue.push(makeObjectKey(dep.type, depMeta.name));
        }
      }
    }
  }

  // 4. Sort items: Root items first, then by depth, then by type order (TABLE -> FUNCTION -> VIEW -> PROCEDURE -> TRIGGER -> EVENT)
  const typeOrder: Record<ObjectCategory, number> = {
    TABLE: 1,
    FUNCTION: 2,
    VIEW: 3,
    PROCEDURE: 4,
    TRIGGER: 5,
    EVENT: 6
  };

  const items = Array.from(resolvedMap.values()).sort((a, b) => {
    if (a.isRoot !== b.isRoot) return a.isRoot ? -1 : 1;
    if (a.depth !== b.depth) return a.depth - b.depth;
    if (typeOrder[a.type] !== typeOrder[b.type]) return typeOrder[a.type] - typeOrder[b.type];
    return a.name.localeCompare(b.name);
  });

  const selectedMap: Record<string, boolean> = {};
  let rootCount = 0;
  let dependencyCount = 0;
  let diffCount = 0;
  let identicalCount = 0;

  for (const item of items) {
    if (item.isRoot) rootCount++;
    else dependencyCount++;

    if (item.status === 'identical') {
      identicalCount++;
    } else {
      diffCount++;
    }

    selectedMap[item.key] = true;
  }

  return {
    items,
    rootCount,
    dependencyCount,
    diffCount,
    identicalCount,
    notFoundInputs,
    selectedMap
  };
}
