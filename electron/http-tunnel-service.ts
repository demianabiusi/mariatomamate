import * as http from 'http';
import * as https from 'https';
import { URL } from 'url';
import mysql from 'mysql2';

export interface HttpTunnelConfig {
  enabled: boolean;
  url: string;
  accessKey?: string;
  httpUser?: string;
  httpPassword?: string;
  rejectUnauthorized?: boolean;
}

export interface TunnelDbParams {
  host: string;
  port: number;
  user: string;
  password?: string;
  database?: string;
  charset?: string;
  connectTimeout?: number;
}

interface PhpFieldMeta {
  name: string;
  orgName: string;
  table: string;
  orgTable: string;
  db: string;
  type: number;
  flags: number;
}

interface PhpSingleQueryResult {
  isResultSet: boolean;
  rows?: Record<string, any>[];
  fields?: PhpFieldMeta[];
  affectedRows?: number;
  insertId?: number | string;
  changedRows?: number;
  message?: string;
}

/**
 * Generates the self-contained mtm_tunnel.php script compatible with PHP 7.0+ (and 5.6 / 8.x).
 */
export function generatePhpTunnelScript(accessKey: string = ''): string {
  const escapedKey = accessKey.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

  return `<?php
/**
 * ============================================================================
 *  Maria Toma Mate - Puente HTTP/HTTPS para MySQL y MariaDB (mtm_tunnel.php)
 * ============================================================================
 *  Compatible con PHP 7.0, 7.1, 7.2, 7.3, 7.4 y PHP 8.x (mysqli / PDO)
 *
 *  INSTRUCCIONES:
 *  1. Sube este archivo (mtm_tunnel.php) a tu servidor web (por FTP, SFTP o
 *     el Administrador de Archivos de cPanel / DirectAdmin / Plesk) en una
 *     carpeta accesible por navegador (ej: https://tudominio.com/mtm_tunnel.php).
 *  2. En Maria Toma Mate, abre la pestaña "Puente HTTP (PHP)" de tu conexión,
 *     habilita el puente y pega la URL completa hacia este archivo.
 *  3. En la pestaña "General", coloca el Host MySQL visto desde el servidor
 *     web (normalmente "localhost" o "127.0.0.1") y tu usuario/clave de MySQL.
 * ============================================================================
 */

// Clave de seguridad opcional del puente. Si defines una clave aquí, deberás
// ingresar la misma en la pestaña "Puente HTTP (PHP)" de Maria Toma Mate.
$MTM_ACCESS_KEY = '${escapedKey}';

// Desactivar límite de tiempo y visualización de warnings en la salida JSON
@ini_set('display_errors', '0');
@ini_set('log_errors', '0');
@error_reporting(0);
@set_time_limit(300);

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-MTM-Key');

if (isset($_SERVER['REQUEST_METHOD']) && $_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$hasMysqli = extension_loaded('mysqli') && function_exists('mysqli_init');
$hasPdoMysql = extension_loaded('pdo_mysql') && class_exists('PDO');

// Si se abre desde el navegador con GET, mostrar página de estado diagnóstica
if (!isset($_SERVER['REQUEST_METHOD']) || $_SERVER['REQUEST_METHOD'] === 'GET') {
    header('Content-Type: text/html; charset=utf-8');
    $statusOk = ($hasMysqli || $hasPdoMysql);
    echo '<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Maria Toma Mate - Puente HTTP</title>';
    echo '<style>body{background:#09090b;color:#e4e4e7;font-family:system-ui,-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;min-height:95vh;margin:0}';
    echo '.card{background:#18181b;border:1px solid #27272a;border-radius:16px;padding:28px;max-width:480px;width:90%;box-shadow:0 20px 40px rgba(0,0,0,.5)}';
    echo '.badge{display:inline-block;padding:4px 10px;border-radius:999px;font-size:12px;font-weight:700;background:' . ($statusOk ? '#064e3b;color:#6ee7b7' : '#7f1d1d;color:#fca5a5') . '}';
    echo '.row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #27272a;font-size:13px}.muted{color:#a1a1aa}</style></head><body>';
    echo '<div class="card"><h2 style="margin:0 0 8px 0;font-size:18px">🧉 Maria Toma Mate — Puente HTTP</h2>';
    echo '<p class="muted" style="font-size:13px;margin:0 0 18px 0">El script puente está instalado y respondiendo correctamente.</p>';
    echo '<div class="row"><span class="muted">Estado</span><span class="badge">' . ($statusOk ? 'LISTO PARA CONECTAR' : 'FALTA EXTENSIÓN MYSQL') . '</span></div>';
    echo '<div class="row"><span class="muted">Versión de PHP</span><code>' . htmlspecialchars(PHP_VERSION) . '</code></div>';
    echo '<div class="row"><span class="muted">Driver mysqli</span><code>' . ($hasMysqli ? 'Disponible ✓' : 'No disponible') . '</code></div>';
    echo '<div class="row"><span class="muted">Driver PDO MySQL</span><code>' . ($hasPdoMysql ? 'Disponible ✓' : 'No disponible') . '</code></div>';
    echo '<div class="row" style="border:none"><span class="muted">Clave de Acceso</span><code>' . ($MTM_ACCESS_KEY !== '' ? 'Protegido con clave 🔒' : 'Sin clave adicional') . '</code></div>';
    echo '</div></body></html>';
    exit;
}

header('Content-Type: application/json; charset=utf-8');

function mtm_send_json($data) {
    $flags = 0;
    if (defined('JSON_UNESCAPED_UNICODE')) {
        $flags |= JSON_UNESCAPED_UNICODE;
    }
    if (defined('JSON_INVALID_UTF8_SUBSTITUTE')) {
        $flags |= JSON_INVALID_UTF8_SUBSTITUTE;
    }
    $json = json_encode($data, $flags);
    if ($json === false) {
        $json = json_encode(array(
            'ok' => false,
            'error' => 'Error al serializar respuesta JSON en PHP: ' . (function_exists('json_last_error_msg') ? json_last_error_msg() : 'Error desconocido')
        ));
    }
    echo $json;
    exit;
}

function mtm_sanitize_value($val, $isBinaryFlag = false) {
    if ($val === null || is_bool($val) || is_int($val) || is_float($val)) {
        return $val;
    }
    $str = (string)$val;
    if ($isBinaryFlag) {
        if ($str === '') return '';
        if (preg_match('/^[\\x20-\\x7E\\r\\n\\t]*$/', $str)) {
            return $str;
        }
        return '[BLOB Binary ' . strlen($str) . ' bytes]';
    }
    // Asegurar UTF-8 válido para que json_encode nunca falle en PHP 7.0 / 7.1
    if (!preg_match('//u', $str)) {
        if (function_exists('mb_convert_encoding')) {
            $str = mb_convert_encoding($str, 'UTF-8', 'ISO-8859-1');
        } elseif (function_exists('utf8_encode')) {
            $str = @utf8_encode($str);
        } else {
            $str = '[Binary ' . strlen($str) . ' bytes]';
        }
    }
    return $str;
}

// Leer cuerpo de la petición (soporta payload_b64 en POST o JSON crudo)
$rawBody = @file_get_contents('php://input');
$payloadJson = '';

if (isset($_POST['payload_b64']) && $_POST['payload_b64'] !== '') {
    $payloadJson = base64_decode($_POST['payload_b64']);
} elseif ($rawBody !== false && $rawBody !== '') {
    $trimmedBody = trim($rawBody);
    if (strpos($trimmedBody, '{') === 0) {
        $outer = json_decode($trimmedBody, true);
        if (is_array($outer) && isset($outer['payload_b64'])) {
            $payloadJson = base64_decode($outer['payload_b64']);
        } else {
            $payloadJson = $trimmedBody;
        }
    } else {
        parse_str($trimmedBody, $parsedForm);
        if (isset($parsedForm['payload_b64'])) {
            $payloadJson = base64_decode($parsedForm['payload_b64']);
        }
    }
}

$req = json_decode($payloadJson, true);
if (!is_array($req)) {
    mtm_send_json(array(
        'ok' => false,
        'error' => 'Petición inválida recibida por mtm_tunnel.php (no se pudo decodificar el payload).'
    ));
}

// Verificar clave de acceso si fue configurada en el archivo PHP
if ($MTM_ACCESS_KEY !== '') {
    $providedKey = isset($req['accessKey']) ? (string)$req['accessKey'] : '';
    $valid = function_exists('hash_equals')
        ? hash_equals($MTM_ACCESS_KEY, $providedKey)
        : ($MTM_ACCESS_KEY === $providedKey);
    if (!$valid) {
        mtm_send_json(array(
            'ok' => false,
            'error' => 'Clave de acceso del puente HTTP (Access Key) incorrecta o no proporcionada.',
            'code' => 'ER_TUNNEL_AUTH_FAILED'
        ));
    }
}

if (!$hasMysqli && !$hasPdoMysql) {
    mtm_send_json(array(
        'ok' => false,
        'error' => 'El servidor PHP no tiene habilitada la extensión mysqli ni pdo_mysql.'
    ));
}

$dbHost = isset($req['host']) && trim((string)$req['host']) !== '' ? trim((string)$req['host']) : '127.0.0.1';
$dbPort = isset($req['port']) && (int)$req['port'] > 0 ? (int)$req['port'] : 3306;
$dbUser = isset($req['user']) ? (string)$req['user'] : 'root';
$dbPass = isset($req['password']) ? (string)$req['password'] : '';
$dbName = isset($req['database']) && trim((string)$req['database']) !== '' ? trim((string)$req['database']) : '';
$dbCharset = isset($req['charset']) && trim((string)$req['charset']) !== '' ? trim((string)$req['charset']) : 'utf8mb4';
$action = isset($req['action']) ? (string)$req['action'] : 'query';

// ============================================================================
// EJECUCIÓN MEDIANTE MYSQLI (PREFERIDO)
// ============================================================================
if ($hasMysqli) {
    if (function_exists('mysqli_report')) {
        @mysqli_report(MYSQLI_REPORT_OFF);
    }

    $mysqli = @mysqli_init();
    if (!$mysqli) {
        mtm_send_json(array('ok' => false, 'error' => 'No se pudo inicializar mysqli_init().'));
    }

    $timeoutSec = isset($req['connectTimeout']) ? max(3, (int)($req['connectTimeout'] / 1000)) : 10;
    @mysqli_options($mysqli, MYSQLI_OPT_CONNECT_TIMEOUT, $timeoutSec);

    $connected = @mysqli_real_connect($mysqli, $dbHost, $dbUser, $dbPass, $dbName, $dbPort);
    if (!$connected) {
        $errNo = @mysqli_connect_errno();
        $errMsg = @mysqli_connect_error();
        mtm_send_json(array(
            'ok' => false,
            'error' => 'Error de conexión MySQL (' . $errNo . '): ' . $errMsg,
            'errno' => $errNo
        ));
    }

    @mysqli_set_charset($mysqli, $dbCharset);

    if ($action === 'ping') {
        $serverVer = @mysqli_get_server_info($mysqli);
        @mysqli_close($mysqli);
        mtm_send_json(array(
            'ok' => true,
            'serverVersion' => $serverVer ? $serverVer : 'MySQL/MariaDB',
            'phpVersion' => PHP_VERSION
        ));
    }

    function mtm_execute_mysqli_sql($mysqli, $sql) {
        $datasets = array();
        $ok = @mysqli_multi_query($mysqli, $sql);
        if (!$ok) {
            return array(
                'ok' => false,
                'error' => @mysqli_error($mysqli),
                'errno' => @mysqli_errno($mysqli)
            );
        }

        do {
            $res = @mysqli_store_result($mysqli);
            if ($res instanceof mysqli_result) {
                $rawFields = @mysqli_fetch_fields($res);
                $fields = array();
                $binaryCols = array();
                if (is_array($rawFields)) {
                    foreach ($rawFields as $f) {
                        $fFlags = isset($f->flags) ? (int)$f->flags : 0;
                        $fType = isset($f->type) ? (int)$f->type : 253;
                        $fCharset = isset($f->charsetnr) ? (int)$f->charsetnr : 0;
                        // charsetnr 63 es el collation binary en MySQL; excluyendo tipos numéricos/fecha
                        $isBin = ($fCharset === 63) && in_array($fType, array(249, 250, 251, 252, 253, 254), true);
                        $binaryCols[$f->name] = $isBin;
                        $fields[] = array(
                            'name' => (string)$f->name,
                            'orgName' => isset($f->orgname) ? (string)$f->orgname : (string)$f->name,
                            'table' => isset($f->table) ? (string)$f->table : '',
                            'orgTable' => isset($f->orgtable) ? (string)$f->orgtable : '',
                            'db' => isset($f->db) ? (string)$f->db : '',
                            'type' => $fType,
                            'flags' => $fFlags
                        );
                    }
                }

                $rows = array();
                while ($row = @mysqli_fetch_assoc($res)) {
                    $cleanRow = array();
                    foreach ($row as $k => $v) {
                        $isBinCol = isset($binaryCols[$k]) ? $binaryCols[$k] : false;
                        $cleanRow[$k] = mtm_sanitize_value($v, $isBinCol);
                    }
                    $rows[] = $cleanRow;
                }
                @mysqli_free_result($res);

                $datasets[] = array(
                    'isResultSet' => true,
                    'rows' => $rows,
                    'fields' => $fields
                );
            } else {
                if (@mysqli_errno($mysqli) !== 0) {
                    return array(
                        'ok' => false,
                        'error' => @mysqli_error($mysqli),
                        'errno' => @mysqli_errno($mysqli)
                    );
                }
                $affected = @mysqli_affected_rows($mysqli);
                $insertId = @mysqli_insert_id($mysqli);
                $info = @mysqli_info($mysqli);
                $datasets[] = array(
                    'isResultSet' => false,
                    'affectedRows' => $affected >= 0 ? $affected : 0,
                    'insertId' => $insertId,
                    'message' => $info ? (string)$info : ''
                );
            }

            if (!@mysqli_more_results($mysqli)) {
                break;
            }
            if (!@mysqli_next_result($mysqli)) {
                if (@mysqli_errno($mysqli) !== 0) {
                    return array(
                        'ok' => false,
                        'error' => @mysqli_error($mysqli),
                        'errno' => @mysqli_errno($mysqli)
                    );
                }
                break;
            }
        } while (true);

        return array(
            'ok' => true,
            'datasets' => $datasets
        );
    }

    if ($action === 'batch') {
        $queries = isset($req['queries']) && is_array($req['queries']) ? $req['queries'] : array();
        $batchResults = array();
        foreach ($queries as $qSql) {
            $batchResults[] = mtm_execute_mysqli_sql($mysqli, (string)$qSql);
        }
        @mysqli_close($mysqli);
        mtm_send_json(array(
            'ok' => true,
            'batchResults' => $batchResults
        ));
    }

    $sql = isset($req['sql']) ? (string)$req['sql'] : '';
    $execRes = mtm_execute_mysqli_sql($mysqli, $sql);
    @mysqli_close($mysqli);
    mtm_send_json($execRes);
}

// ============================================================================
// FALLBACK MEDIANTE PDO_MYSQL (SI MYSQLI NO ESTÁ ACTIVO)
// ============================================================================
try {
    $dsn = 'mysql:host=' . $dbHost . ';port=' . $dbPort . ($dbName !== '' ? ';dbname=' . $dbName : '') . ';charset=' . $dbCharset;
    $pdo = new PDO($dsn, $dbUser, $dbPass, array(
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
    ));

    if ($action === 'ping') {
        $ver = $pdo->getAttribute(PDO::ATTR_SERVER_VERSION);
        mtm_send_json(array(
            'ok' => true,
            'serverVersion' => $ver ? (string)$ver : 'MySQL/MariaDB (PDO)',
            'phpVersion' => PHP_VERSION
        ));
    }

    function mtm_execute_pdo_sql($pdo, $sql) {
        try {
            $stmt = $pdo->query($sql);
            $datasets = array();
            do {
                $colCount = $stmt->columnCount();
                if ($colCount > 0) {
                    $fields = array();
                    for ($i = 0; $i < $colCount; $i++) {
                        $meta = @$stmt->getColumnMeta($i);
                        $fName = isset($meta['name']) ? (string)$meta['name'] : ('col_' . $i);
                        $flagsArr = isset($meta['flags']) && is_array($meta['flags']) ? $meta['flags'] : array();
                        $flagBits = in_array('primary_key', $flagsArr, true) ? 2 : 0;
                        $fields[] = array(
                            'name' => $fName,
                            'orgName' => $fName,
                            'table' => isset($meta['table']) ? (string)$meta['table'] : '',
                            'orgTable' => isset($meta['table']) ? (string)$meta['table'] : '',
                            'db' => '',
                            'type' => 253,
                            'flags' => $flagBits
                        );
                    }
                    $rawRows = $stmt->fetchAll(PDO::FETCH_ASSOC);
                    $rows = array();
                    foreach ($rawRows as $r) {
                        $clean = array();
                        foreach ($r as $k => $v) {
                            $clean[$k] = mtm_sanitize_value($v, false);
                        }
                        $rows[] = $clean;
                    }
                    $datasets[] = array(
                        'isResultSet' => true,
                        'rows' => $rows,
                        'fields' => $fields
                    );
                } else {
                    $datasets[] = array(
                        'isResultSet' => false,
                        'affectedRows' => $stmt->rowCount(),
                        'insertId' => $pdo->lastInsertId(),
                        'message' => ''
                    );
                }
            } while (@$stmt->nextRowset());

            return array('ok' => true, 'datasets' => $datasets);
        } catch ( Exception $ex ) {
            return array('ok' => false, 'error' => $ex->getMessage());
        }
    }

    if ($action === 'batch') {
        $queries = isset($req['queries']) && is_array($req['queries']) ? $req['queries'] : array();
        $batchResults = array();
        foreach ($queries as $qSql) {
            $batchResults[] = mtm_execute_pdo_sql($pdo, (string)$qSql);
        }
        mtm_send_json(array('ok' => true, 'batchResults' => $batchResults));
    }

    $sql = isset($req['sql']) ? (string)$req['sql'] : '';
    mtm_send_json(mtm_execute_pdo_sql($pdo, $sql));
} catch (Exception $e) {
    mtm_send_json(array(
        'ok' => false,
        'error' => 'Error PDO MySQL: ' . $e->getMessage()
    ));
}
`;
}

/**
 * Emulates a mysql2/promise Connection over HTTP/HTTPS by communicating with mtm_tunnel.php.
 */
export class HttpTunnelConnection {
  public readonly isHttpTunnel = true;
  public _closing = false;
  private currentDatabase: string;

  constructor(
    private readonly tunnelConfig: HttpTunnelConfig,
    private readonly dbParams: TunnelDbParams
  ) {
    this.currentDatabase = (dbParams.database || '').trim();
  }

  public on(_event: string, _listener: (...args: any[]) => void): this {
    return this;
  }

  public async ping(): Promise<{ serverVersion: string; phpVersion?: string }> {
    const res = await this.sendTunnelRequest({ action: 'ping' });
    return {
      serverVersion: res.serverVersion || 'MySQL/MariaDB (HTTP Tunnel)',
      phpVersion: res.phpVersion
    };
  }

  public async end(): Promise<void> {
    this._closing = true;
  }

  public destroy(): void {
    this._closing = true;
  }

  public async execute(sql: string, values?: any[]): Promise<[any, any]> {
    return this.query(sql, values);
  }

  public async query(sql: string, values?: any[]): Promise<[any, any]> {
    if (this._closing) {
      throw new Error('Connection is in closed state');
    }

    const formattedSql =
      values !== undefined && values !== null && (Array.isArray(values) ? values.length > 0 : true)
        ? mysql.format(sql, values)
        : sql;

    // Intercept USE `database` statements so stateful DB switching works across stateless HTTP calls
    const useMatch = formattedSql.trim().match(/^USE\s+[`"']?([a-zA-Z0-9_$-]+)[`"']?\s*;?$/i);
    if (useMatch) {
      const targetDb = useMatch[1];
      // Verify the database is accessible by connecting with it
      const prevDb = this.currentDatabase;
      this.currentDatabase = targetDb;
      try {
        await this.sendTunnelRequest({
          action: 'query',
          sql: 'SELECT 1;'
        });
        return [
          {
            fieldCount: 0,
            affectedRows: 0,
            insertId: 0,
            info: '',
            serverStatus: 2,
            warningStatus: 0
          },
          undefined
        ];
      } catch (err) {
        this.currentDatabase = prevDb;
        throw err;
      }
    }

    const res = await this.sendTunnelRequest({
      action: 'query',
      sql: formattedSql
    });

    return this.convertDatasetsToMysql2Tuple(res.datasets || []);
  }

  /**
   * Executes multiple independent SQL statements in a single HTTP request to mtm_tunnel.php
   * to avoid N roundtrips (e.g., during Schema Diff metadata extraction).
   */
  public async batchQuery(queries: string[]): Promise<Array<{ ok: boolean; rows?: any[]; fields?: any[]; error?: string }>> {
    if (queries.length === 0) return [];
    const res = await this.sendTunnelRequest({
      action: 'batch',
      queries
    });

    const batchResults = Array.isArray(res.batchResults) ? res.batchResults : [];
    return batchResults.map((item: any) => {
      if (!item || !item.ok) {
        return { ok: false, error: item?.error || 'Error en consulta por lotes' };
      }
      const [rows, fields] = this.convertDatasetsToMysql2Tuple(item.datasets || []);
      return {
        ok: true,
        rows: Array.isArray(rows) ? rows : [],
        fields
      };
    });
  }

  private convertDatasetsToMysql2Tuple(datasets: PhpSingleQueryResult[]): [any, any] {
    if (!datasets || datasets.length === 0) {
      return [
        {
          fieldCount: 0,
          affectedRows: 0,
          insertId: 0,
          info: '',
          serverStatus: 2,
          warningStatus: 0
        },
        undefined
      ];
    }

    if (datasets.length === 1) {
      const ds = datasets[0];
      if (ds.isResultSet) {
        const fields = (ds.fields || []).map(f => ({
          name: f.name,
          orgName: f.orgName || f.name,
          table: f.table || '',
          orgTable: f.orgTable || f.table || '',
          db: f.db || this.currentDatabase || '',
          columnType: f.type,
          type: f.type,
          flags: f.flags
        }));
        return [ds.rows || [], fields];
      } else {
        return [
          {
            fieldCount: 0,
            affectedRows: ds.affectedRows ?? 0,
            insertId: ds.insertId ?? 0,
            changedRows: ds.changedRows ?? 0,
            info: ds.message || '',
            message: ds.message || '',
            serverStatus: 2,
            warningStatus: 0
          },
          undefined
        ];
      }
    }

    // Multiple datasets (multi-statement query)
    const multiResults: any[] = [];
    const multiFields: any[] = [];

    for (const ds of datasets) {
      if (ds.isResultSet) {
        multiResults.push(ds.rows || []);
        multiFields.push(
          (ds.fields || []).map(f => ({
            name: f.name,
            orgName: f.orgName || f.name,
            table: f.table || '',
            orgTable: f.orgTable || f.table || '',
            db: f.db || this.currentDatabase || '',
            columnType: f.type,
            type: f.type,
            flags: f.flags
          }))
        );
      } else {
        multiResults.push({
          fieldCount: 0,
          affectedRows: ds.affectedRows ?? 0,
          insertId: ds.insertId ?? 0,
          changedRows: ds.changedRows ?? 0,
          info: ds.message || '',
          message: ds.message || '',
          serverStatus: 2,
          warningStatus: 0
        });
        multiFields.push(undefined);
      }
    }

    return [multiResults, multiFields];
  }

  private async sendTunnelRequest(
    extraPayload: Record<string, any>,
    redirectDepth: number = 0
  ): Promise<any> {
    if (redirectDepth > 5) {
      throw new Error('Demasiadas redirecciones HTTP al contactar con mtm_tunnel.php.');
    }

    const rawUrl = (this.tunnelConfig.url || '').trim();
    if (!rawUrl) {
      throw new Error('Debe especificar la URL del puente HTTP (ej: https://tudominio.com/mtm_tunnel.php).');
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(rawUrl);
    } catch {
      throw new Error(`La URL del puente HTTP no es válida: "${rawUrl}"`);
    }

    const payloadObj = {
      host: this.dbParams.host || '127.0.0.1',
      port: Number(this.dbParams.port) || 3306,
      user: this.dbParams.user || 'root',
      password: this.dbParams.password || '',
      database: this.currentDatabase || '',
      charset: (this.dbParams.charset || 'utf8mb4').toLowerCase(),
      connectTimeout: this.dbParams.connectTimeout || 15000,
      accessKey: this.tunnelConfig.accessKey || '',
      ...extraPayload
    };

    const payloadB64 = Buffer.from(JSON.stringify(payloadObj), 'utf-8').toString('base64');
    const postBody = `payload_b64=${encodeURIComponent(payloadB64)}`;

    const isHttps = parsedUrl.protocol === 'https:';
    const requestMod = isHttps ? https : http;

    const headers: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'Content-Length': String(Buffer.byteLength(postBody)),
      'User-Agent': 'MariaTomaMate-HttpTunnel/1.2',
      'Accept': 'application/json'
    };

    if (this.tunnelConfig.httpUser) {
      const basicAuth = Buffer.from(
        `${this.tunnelConfig.httpUser}:${this.tunnelConfig.httpPassword || ''}`,
        'utf-8'
      ).toString('base64');
      headers['Authorization'] = `Basic ${basicAuth}`;
    }

    return new Promise((resolve, reject) => {
      const reqOptions: https.RequestOptions = {
        protocol: parsedUrl.protocol,
        hostname: parsedUrl.hostname,
        port: parsedUrl.port ? Number(parsedUrl.port) : isHttps ? 443 : 80,
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'POST',
        headers,
        timeout: 60000,
        rejectUnauthorized: this.tunnelConfig.rejectUnauthorized !== undefined ? this.tunnelConfig.rejectUnauthorized : false
      };

      const req = requestMod.request(reqOptions, (res) => {
        const statusCode = res.statusCode || 0;

        // Handle HTTP Redirects (301, 302, 303, 307, 308)
        if ([301, 302, 303, 307, 308].includes(statusCode) && res.headers.location) {
          const nextUrl = new URL(res.headers.location, parsedUrl).toString();
          this.tunnelConfig.url = nextUrl;
          res.resume();
          this.sendTunnelRequest(extraPayload, redirectDepth + 1)
            .then(resolve)
            .catch(reject);
          return;
        }

        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        res.on('end', () => {
          const bodyText = Buffer.concat(chunks).toString('utf-8').trim();

          if (statusCode === 401) {
            reject(new Error('El servidor web devolvió 401 Unauthorized. Verifica el usuario/contraseña de Autenticación HTTP Básica.'));
            return;
          }
          if (statusCode === 403) {
            reject(new Error(`El servidor web devolvió 403 Forbidden al acceder a ${parsedUrl.pathname}. Verifica los permisos del archivo mtm_tunnel.php.`));
            return;
          }
          if (statusCode === 404) {
            reject(new Error(`No se encontró el archivo en la URL especificada (404 Not Found: ${parsedUrl.href}). Verifica haber subido mtm_tunnel.php en esa ruta.`));
            return;
          }
          if (statusCode >= 500) {
            reject(new Error(`Error interno del servidor web (${statusCode}) en mtm_tunnel.php: ${bodyText.substring(0, 200)}`));
            return;
          }

          let parsed: any;
          try {
            // Strip any accidental BOM or PHP warning prefix before the first '{'
            const firstBrace = bodyText.indexOf('{');
            const lastBrace = bodyText.lastIndexOf('}');
            const jsonSlice =
              firstBrace >= 0 && lastBrace > firstBrace
                ? bodyText.slice(firstBrace, lastBrace + 1)
                : bodyText;
            parsed = JSON.parse(jsonSlice);
          } catch {
            const preview = bodyText.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 180);
            reject(
              new Error(
                `La URL no devolvió una respuesta JSON válida de mtm_tunnel.php (HTTP ${statusCode}). Respuesta recibida: "${preview || '(vacía)'}"`
              )
            );
            return;
          }

          if (!parsed || parsed.ok !== true) {
            const errMsg = parsed?.error || 'Error desconocido reportado por el puente HTTP PHP.';
            const err: any = new Error(errMsg);
            if (parsed?.errno) err.errno = parsed.errno;
            if (parsed?.code) err.code = parsed.code;
            reject(err);
            return;
          }

          resolve(parsed);
        });
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Tiempo de espera agotado (Timeout) al comunicar con mtm_tunnel.php.'));
      });

      req.on('error', (err: any) => {
        reject(new Error(`Error de red al conectar con el puente HTTP (${parsedUrl.hostname}): ${err.message}`));
      });

      req.write(postBody);
      req.end();
    });
  }
}
