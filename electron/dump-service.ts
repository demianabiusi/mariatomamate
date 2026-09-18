import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { MariaDbService } from './mariadb-service';

export interface DumpOptions {
  outputPath: string;
  includeStructure: boolean;
  includeData: boolean;
  includeViews: boolean;
  includeProcedures: boolean;
  includeTriggers: boolean;
  includeForeignKeys: boolean;
  selectedTables: string[]; // empty means all tables
  batchCommitSize?: number;
}

export interface DumpProgress {
  stage: string;
  currentTable?: string;
  totalTables?: number;
  currentTableIndex?: number;
  rowsExported?: number;
  totalRowsInTable?: number;
  percentage: number;
  message: string;
}

export interface ImportOptions {
  filePath: string;
  stopOnError: boolean;
}

export interface ImportErrorItem {
  statementIndex: number;
  statementSnippet: string;
  error: string;
  lineNumber: number;
}

export interface ImportProgress {
  bytesProcessed: number;
  totalBytes: number;
  percentage: number;
  statementsExecuted: number;
  errorsCount: number;
  currentStatementSnippet: string;
  message: string;
}

export interface ImportResult {
  success: boolean;
  totalStatements: number;
  executedStatements: number;
  errorsCount: number;
  errors: ImportErrorItem[];
  durationMs: number;
}

export class DumpService {
  private mariaService: MariaDbService;
  private isCancelled: boolean = false;

  constructor(mariaService: MariaDbService) {
    this.mariaService = mariaService;
  }

  public cancel(): void {
    this.isCancelled = true;
  }

  private formatSqlValue(val: any): string {
    if (val === null || val === undefined) return 'NULL';
    if (typeof val === 'number') return Number.isFinite(val) ? String(val) : 'NULL';
    if (typeof val === 'boolean') return val ? '1' : '0';
    if (val instanceof Date) {
      const pad = (n: number) => String(n).padStart(2, '0');
      const yyyy = val.getFullYear();
      const mm = pad(val.getMonth() + 1);
      const dd = pad(val.getDate());
      const hh = pad(val.getHours());
      const min = pad(val.getMinutes());
      const ss = pad(val.getSeconds());
      return `'${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}'`;
    }
    if (Buffer.isBuffer(val)) {
      return `X'${val.toString('hex')}'`;
    }
    if (typeof val === 'object') {
      const jsonStr = JSON.stringify(val).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      return `'${jsonStr}'`;
    }
    // Escape string characters for MySQL
    const str = String(val)
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/\0/g, '\\0')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\x1a/g, '\\Z');
    return `'${str}'`;
  }

  public async exportDatabase(
    options: DumpOptions,
    onProgress: (p: DumpProgress) => void
  ): Promise<{ success: boolean; filePath: string; totalStatements: number; durationMs: number }> {
    this.isCancelled = false;
    const startTime = Date.now();

    this.mariaService.setBusy(true);
    let conn: any;
    try {
      conn = await this.mariaService.ensureConnection();
    } catch {
      this.mariaService.setBusy(false);
      throw new Error('No hay una conexión activa para exportar.');
    }

    const currentConfig = this.mariaService.getCurrentConfig();
    const dbName = currentConfig?.database;
    if (!dbName) {
      throw new Error('No hay una base de datos seleccionada para exportar.');
    }

    // Ensure output directory exists
    const dir = path.dirname(options.outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const writeStream = fs.createWriteStream(options.outputPath, { encoding: 'utf-8' });
    const writeLine = (line: string): Promise<void> => {
      return new Promise((resolve, reject) => {
        if (!writeStream.write(line + '\n')) {
          writeStream.once('drain', resolve);
        } else {
          resolve();
        }
      });
    };

    let statementCount = 0;

    try {
      // 1. Header
      onProgress({
        stage: 'HEADER',
        percentage: 2,
        message: 'Iniciando volcado de base de datos MariaDB/MySQL...'
      });

      await writeLine(`-- ------------------------------------------------------`);
      await writeLine(`-- Maria Toma Mate - Database Dump`);
      await writeLine(`-- Servidor: ${currentConfig?.host}:${currentConfig?.port}`);
      await writeLine(`-- Base de Datos: \`${dbName}\``);
      await writeLine(`-- Fecha de Generación: ${new Date().toISOString()}`);
      await writeLine(`-- ------------------------------------------------------`);
      await writeLine(``);
      await writeLine(`/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;`);
      await writeLine(`/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;`);
      await writeLine(`/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;`);
      await writeLine(`/*!50503 SET NAMES utf8mb4 */;`);
      await writeLine(`/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;`);
      await writeLine(`/*!40103 SET TIME_ZONE='+00:00' */;`);
      await writeLine(`/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;`);
      await writeLine(`/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;`);
      await writeLine(`/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;`);
      await writeLine(`/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;`);
      await writeLine(``);

      // 2. Schema objects
      const schema = await this.mariaService.getSchemaObjects();
      const allTables = schema.tables || [];
      const tablesToExport = options.selectedTables && options.selectedTables.length > 0
        ? allTables.filter(t => options.selectedTables.includes(t))
        : allTables;

      const totalTables = tablesToExport.length;
      const batchSize = options.batchCommitSize || 500;

      // 3. Tables: Structure and Data
      for (let i = 0; i < totalTables; i++) {
        if (this.isCancelled) throw new Error('Operación cancelada por el usuario.');
        const tbl = tablesToExport[i];
        const tablePercent = 5 + Math.floor((i / totalTables) * 75);

        onProgress({
          stage: 'TABLES',
          currentTable: tbl,
          totalTables,
          currentTableIndex: i + 1,
          percentage: tablePercent,
          message: `Procesando tabla \`${tbl}\` (${i + 1}/${totalTables})...`
        });

        await writeLine(`--`);
        await writeLine(`-- Estructura y datos para tabla \`${tbl}\``);
        await writeLine(`--`);
        await writeLine(``);

        if (options.includeStructure) {
          await writeLine(`DROP TABLE IF EXISTS \`${tbl}\`;`);
          statementCount++;
          await writeLine(`/*!40101 SET @saved_cs_client     = @@character_set_client */;`);
          await writeLine(`/*!50503 SET character_set_client = utf8mb4 */;`);

          try {
            const [createRows] = await conn.query(`SHOW CREATE TABLE \`${dbName}\`.\`${tbl}\`;`);
            const createSql = (createRows as any[])[0]?.['Create Table'];
            if (createSql) {
              await writeLine(`${createSql};`);
              statementCount++;
            }
          } catch (err: any) {
            await writeLine(`-- Error exportando DDL de \`${tbl}\`: ${err.message}`);
          }

          await writeLine(`/*!40101 SET character_set_client = @saved_cs_client */;`);
          await writeLine(``);
        }

        if (options.includeData) {
          await writeLine(`-- Volcado de datos para la tabla \`${tbl}\``);
          await writeLine(`LOCK TABLES \`${tbl}\` WRITE;`);
          await writeLine(`/*!40000 ALTER TABLE \`${tbl}\` DISABLE KEYS */;`);
          statementCount += 2;

          const [rows] = await conn.query(`SELECT * FROM \`${dbName}\`.\`${tbl}\`;`);
          const dataRows = Array.isArray(rows) ? (rows as any[]) : [];
          const totalRowsInTable = dataRows.length;

          if (totalRowsInTable > 0) {
            const columns = Object.keys(dataRows[0]);
            const colsEscaped = columns.map(c => `\`${c}\``).join(', ');

            for (let r = 0; r < totalRowsInTable; r += batchSize) {
              if (this.isCancelled) throw new Error('Operación cancelada por el usuario.');
              const chunk = dataRows.slice(r, r + batchSize);
              const valuesStr = chunk.map(row => {
                const vals = columns.map(col => this.formatSqlValue(row[col]));
                return `(${vals.join(', ')})`;
              }).join(',\n');

              await writeLine(`INSERT INTO \`${tbl}\` (${colsEscaped}) VALUES\n${valuesStr};`);
              statementCount++;

              onProgress({
                stage: 'DATA',
                currentTable: tbl,
                totalTables,
                currentTableIndex: i + 1,
                rowsExported: Math.min(r + chunk.length, totalRowsInTable),
                totalRowsInTable,
                percentage: tablePercent,
                message: `Exportadas ${Math.min(r + chunk.length, totalRowsInTable)} de ${totalRowsInTable} filas de \`${tbl}\`...`
              });
            }
          }

          await writeLine(`/*!40000 ALTER TABLE \`${tbl}\` ENABLE KEYS */;`);
          await writeLine(`UNLOCK TABLES;`);
          await writeLine(``);
          statementCount += 2;
        }
      }

      // 4. Views
      if (options.includeViews && schema.views && schema.views.length > 0) {
        if (this.isCancelled) throw new Error('Operación cancelada.');
        onProgress({
          stage: 'VIEWS',
          percentage: 82,
          message: 'Exportando vistas...'
        });

        await writeLine(`--`);
        await writeLine(`-- Definición de Vistas`);
        await writeLine(`--`);
        await writeLine(``);

        for (const vw of schema.views) {
          try {
            await writeLine(`DROP VIEW IF EXISTS \`${vw}\`;`);
            statementCount++;
            const [viewRows] = await conn.query(`SHOW CREATE VIEW \`${dbName}\`.\`${vw}\`;`);
            const viewSql = (viewRows as any[])[0]?.['Create View'];
            if (viewSql) {
              await writeLine(`${viewSql};`);
              statementCount++;
            }
          } catch (err: any) {
            await writeLine(`-- Error exportando vista \`${vw}\`: ${err.message}`);
          }
        }
        await writeLine(``);
      }

      // 5. Stored Procedures and Functions
      if (options.includeProcedures) {
        if (this.isCancelled) throw new Error('Operación cancelada.');
        onProgress({
          stage: 'ROUTINES',
          percentage: 88,
          message: 'Exportando procedimientos y funciones almacenadas...'
        });

        if (schema.procedures && schema.procedures.length > 0) {
          await writeLine(`--`);
          await writeLine(`-- Procedimientos Almacenados`);
          await writeLine(`--`);
          await writeLine(`DELIMITER ;;`);
          for (const proc of schema.procedures) {
            try {
              await writeLine(`DROP PROCEDURE IF EXISTS \`${proc.name}\`;;`);
              statementCount++;
              const [procRows] = await conn.query(`SHOW CREATE PROCEDURE \`${dbName}\`.\`${proc.name}\`;`);
              const ddl = (procRows as any[])[0]?.['Create Procedure'];
              if (ddl) {
                await writeLine(`${ddl};;`);
                statementCount++;
              }
            } catch (err: any) {
              await writeLine(`-- Error exportando procedimiento \`${proc.name}\`: ${err.message}`);
            }
          }
          await writeLine(`DELIMITER ;`);
          await writeLine(``);
        }

        if (schema.functions && schema.functions.length > 0) {
          await writeLine(`--`);
          await writeLine(`-- Funciones Almacenadas`);
          await writeLine(`--`);
          await writeLine(`DELIMITER ;;`);
          for (const fn of schema.functions) {
            try {
              await writeLine(`DROP FUNCTION IF EXISTS \`${fn.name}\`;;`);
              statementCount++;
              const [fnRows] = await conn.query(`SHOW CREATE FUNCTION \`${dbName}\`.\`${fn.name}\`;`);
              const ddl = (fnRows as any[])[0]?.['Create Function'];
              if (ddl) {
                await writeLine(`${ddl};;`);
                statementCount++;
              }
            } catch (err: any) {
              await writeLine(`-- Error exportando función \`${fn.name}\`: ${err.message}`);
            }
          }
          await writeLine(`DELIMITER ;`);
          await writeLine(``);
        }
      }

      // 6. Triggers
      if (options.includeTriggers && schema.triggers && schema.triggers.length > 0) {
        if (this.isCancelled) throw new Error('Operación cancelada.');
        onProgress({
          stage: 'TRIGGERS',
          percentage: 93,
          message: 'Exportando triggers...'
        });

        await writeLine(`--`);
        await writeLine(`-- Triggers`);
        await writeLine(`--`);
        await writeLine(`DELIMITER ;;`);
        for (const tr of schema.triggers) {
          try {
            await writeLine(`DROP TRIGGER IF EXISTS \`${tr.name}\`;;`);
            statementCount++;
            const [trigRows] = await conn.query(`SHOW CREATE TRIGGER \`${dbName}\`.\`${tr.name}\`;`);
            const ddl = (trigRows as any[])[0]?.['SQL Original Statement'] || (trigRows as any[])[0]?.['Create Trigger'];
            if (ddl) {
              await writeLine(`${ddl};;`);
              statementCount++;
            }
          } catch (err: any) {
            await writeLine(`-- Error exportando trigger \`${tr.name}\`: ${err.message}`);
          }
        }
        await writeLine(`DELIMITER ;`);
        await writeLine(``);
      }

      // 7. Footer
      await writeLine(`/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;`);
      await writeLine(`/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;`);
      await writeLine(`/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;`);
      await writeLine(`/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;`);
      await writeLine(`/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;`);
      await writeLine(`/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;`);
      await writeLine(`/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;`);
      await writeLine(`/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;`);
      await writeLine(`-- Volcado completado exitosamente.`);

      await new Promise<void>((res) => writeStream.end(res));

      const durationMs = Date.now() - startTime;
      onProgress({
        stage: 'COMPLETED',
        percentage: 100,
        message: `¡Dump finalizado con éxito! (${statementCount} sentencias en ${(durationMs / 1000).toFixed(1)}s)`
      });

      return {
        success: true,
        filePath: options.outputPath,
        totalStatements: statementCount,
        durationMs
      };
    } catch (err: any) {
      writeStream.end();
      throw err;
    } finally {
      this.mariaService.setBusy(false);
    }
  }

  public async importDatabase(
    options: ImportOptions,
    onProgress: (p: ImportProgress) => void
  ): Promise<ImportResult> {
    this.isCancelled = false;
    const startTime = Date.now();

    if (!fs.existsSync(options.filePath)) {
      throw new Error(`El archivo '${options.filePath}' no existe.`);
    }

    this.mariaService.setBusy(true);
    let conn: any;
    try {
      conn = await this.mariaService.ensureConnection();
    } catch {
      this.mariaService.setBusy(false);
      throw new Error('No hay conexión activa a la base de datos.');
    }

    try {
      const stat = fs.statSync(options.filePath);
    const totalBytes = stat.size;

    const fileStream = fs.createReadStream(options.filePath, { encoding: 'utf-8' });
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    let bytesProcessed = 0;
    let statementsExecuted = 0;
    const errors: ImportErrorItem[] = [];
    let currentStatement = '';
    let lineNumber = 0;
    let inBlockComment = false;
    let delimiter = ';';
    let lastProgressTime = 0;

    const emitProgress = (force: boolean = false) => {
      const now = Date.now();
      if (force || now - lastProgressTime > 150) {
        lastProgressTime = now;
        const percentage = totalBytes > 0 ? Math.min(99, Math.round((bytesProcessed / totalBytes) * 100)) : 50;
        const snippet = currentStatement.substring(0, 80).replace(/\s+/g, ' ');
        onProgress({
          bytesProcessed,
          totalBytes,
          percentage,
          statementsExecuted,
          errorsCount: errors.length,
          currentStatementSnippet: snippet,
          message: `Procesando: ${statementsExecuted} sentencias ejecutadas...`
        });
      }
    };

    for await (const line of rl) {
      lineNumber++;
      bytesProcessed += Buffer.byteLength(line, 'utf-8') + 1;

      if (this.isCancelled) {
        rl.close();
        fileStream.destroy();
        throw new Error('Importación cancelada por el usuario.');
      }

      const trimmedLine = line.trim();

      // Check DELIMITER commands
      const delimMatch = trimmedLine.match(/^DELIMITER\s+(.+)$/i);
      if (delimMatch && !inBlockComment) {
        delimiter = delimMatch[1].trim();
        continue;
      }

      // Check comments
      if (!currentStatement.trim()) {
        if (trimmedLine.startsWith('--') || trimmedLine.startsWith('#')) {
          continue;
        }
        if (trimmedLine.startsWith('/*') && trimmedLine.endsWith('*/') && !trimmedLine.startsWith('/*!')) {
          continue;
        }
      }

      currentStatement += line + '\n';

      // Check if statement ends with delimiter
      const trimmedStmt = currentStatement.trim();
      if (trimmedStmt.endsWith(delimiter)) {
        let stmtToExecute = trimmedStmt.substring(0, trimmedStmt.length - delimiter.length).trim();
        currentStatement = '';

        if (!stmtToExecute) continue;

        try {
          await conn.query(stmtToExecute);
          statementsExecuted++;
        } catch (err: any) {
          const errMsg = err.message || String(err);
          errors.push({
            statementIndex: statementsExecuted + errors.length + 1,
            statementSnippet: stmtToExecute.substring(0, 150),
            error: errMsg,
            lineNumber
          });

          if (options.stopOnError) {
            rl.close();
            fileStream.destroy();
            return {
              success: false,
              totalStatements: statementsExecuted + errors.length,
              executedStatements: statementsExecuted,
              errorsCount: errors.length,
              errors,
              durationMs: Date.now() - startTime
            };
          }
        }

        emitProgress();
      }
    }

    // Execute remaining statement if any
    if (currentStatement.trim()) {
      try {
        await conn.query(currentStatement.trim());
        statementsExecuted++;
      } catch (err: any) {
        errors.push({
          statementIndex: statementsExecuted + errors.length + 1,
          statementSnippet: currentStatement.trim().substring(0, 150),
          error: err.message || String(err),
          lineNumber
        });
      }
    }

    const durationMs = Date.now() - startTime;
    onProgress({
      bytesProcessed: totalBytes,
      totalBytes,
      percentage: 100,
      statementsExecuted,
      errorsCount: errors.length,
      currentStatementSnippet: '',
      message: `¡Importación finalizada! ${statementsExecuted} sentencias ejecutadas en ${(durationMs / 1000).toFixed(1)}s.`
    });

      return {
        success: errors.length === 0,
        totalStatements: statementsExecuted + errors.length,
        executedStatements: statementsExecuted,
        errorsCount: errors.length,
        errors,
        durationMs
      };
    } finally {
      this.mariaService.setBusy(false);
    }
  }
}
