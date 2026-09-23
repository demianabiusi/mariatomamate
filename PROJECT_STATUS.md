# Estado del Proyecto: Maria Toma Mate 🧉

*Documento de contexto técnico y estado de la aplicación.*
*Fecha de creación: 09/09/2026*

---

## 1. 📌 Resumen General
**Maria Toma Mate** es un cliente de escritorio ágil, moderno y liviano para **MariaDB y MySQL (todas las versiones modernas 5.5, 5.7, 8.0, 8.4+ y MariaDB 10.x/11.x)**.

Fue construido utilizando el cliente Firebird (FirebirdYog) como referencia arquitectónica y funcional, adaptando todo el backend, metadatos, diseñador visual, autocompletado y herramientas al ecosistema de MariaDB/MySQL.

- **Stack Tecnológico:**
  - **Runtime:** Electron (v44+)
  - **Frontend:** React 19, TypeScript, Tailwind CSS v4, Monaco Editor (VS Code Editor)
  - **Conector BD:** `mysql2/promise` (100% JavaScript, sin dependencias de compilación nativa en C++, soporte para streaming, SSL, múltiples sentencias y big numbers).
  - **Empaquetado:** electron-builder (Portable Windows .exe, NSIS installer, Linux AppImage).

---

## 2. 🚀 Funcionalidades Completadas

### A. Conectividad y Multi-Esquema
- Conexión a servidores MariaDB y MySQL por host, puerto (por defecto 3306), usuario, contraseña, base de datos inicial opcional y SSL.
- **Túneles SSH (Bastion / Jump host):**
  - Canalización segura de conexiones MariaDB y MySQL a través de servidores SSH intermedios (`ssh2`).
  - Métodos de autenticación SSH: Contraseña o Archivo de Clave Privada (`.pem`, `.id_rsa`, `.key`, OpenSSH, Ed25519) con soporte de frase de paso (passphrase) y selector de archivo nativo.
  - Herramienta para probar la conectividad del túnel SSH de forma independiente con cálculo de latencia (ping).
  - Persistencia de credenciales y configuración del túnel SSH en el perfil guardado.
  - Indicadores visuales interactivos de estado `SSH` en la barra de navegación y en la lista de conexiones.
- Soporte para **múltiples bases de datos** en un mismo servidor:
  - Listado automático de bases de datos (`SHOW DATABASES`).
  - Selector desplegable en el sidebar para cambiar de base activa al instante.
  - Creación de nuevas bases de datos (`CREATE DATABASE`) con selección de charset (`utf8mb4`, etc.) y collation.
  - Eliminación de bases de datos (`DROP DATABASE`).

### B. Explorador Jerárquico de Objetos
- **Tablas:** Consulta rápida de primeros 100 registros, visualizador de detalles, diseñador visual y generadores de plantillas SQL (SELECT, INSERT, UPDATE, DELETE).
- **Vistas:** Consulta rápida, visualización de DDL nativo (`SHOW CREATE VIEW`) y eliminación.
- **Procedimientos Almacenados:** Inspección de parámetros y plantilla `CALL \`procedimiento\`()`.
- **Funciones Almacenadas:** Detección de tipos de retorno y plantilla `SELECT \`funcion\`()`.
- **Triggers:** Inspección de tabla asociada, evento (INSERT/UPDATE/DELETE) y timing (BEFORE/AFTER).
- **Eventos:** Listado y DDL de tareas programadas del motor.
- **Filtro de búsqueda instantáneo:** Búsqueda en tiempo real sobre todos los objetos.

### C. Editor SQL Monaco con Autocompletado Contextual
- **Autocompletado de Columnas:** Al escribir `tabla.` o `alias.` (resolviendo alias en cláusulas `FROM` y `JOIN`), sugiere de inmediato los campos de la tabla.
- **Palabras Clave y Funciones:** Sugerencias para sentencias y funciones nativas de MariaDB / MySQL.
- **Atajos y Swap F9/F5:** Tecla F9 o Ctrl+Enter para ejecutar. Botón en la barra de herramientas para alternar entre F9 y F5 (para usuarios provenientes de SQLyog).
- **Ejecución parcial:** Opción de ejecutar únicamente el texto seleccionado o la consulta completa.
- **Límite de filas:** Selector de 100 a 100.000 filas (o sin límite).

### D. Diseñador Visual de Tablas
- Diseñador visual completo para MySQL y MariaDB:
  - Nombre de tabla, motor (`InnoDB`, `MyISAM`, `MEMORY`), charset y collation.
  - Campos con nombre, tipo (`INT`, `BIGINT`, `VARCHAR`, `TEXT`, `DECIMAL`, `DATETIME`, etc.), longitud/valores enum, `Unsigned`, `Null`, `Primary Key (PK)`, `Auto Increment (AI)`, valor predeterminado y comentario.
  - Reordenamiento de columnas (subir/bajar) y eliminación.
  - Vista previa de la sentencia DDL generada (`CREATE TABLE` o sentencias `ALTER TABLE` si es modificación).
  - Ejecución directa con 1 clic o envío al editor SQL para ajustes manuales.

### E. Detalles de Tabla e Índices
- Modal detallado con pestañas para:
  - Columnas (tipo, nulabilidad, clave, default, extra, comentario).
  - Índices (`SHOW INDEX`) con tipo (BTREE, HASH, etc.) y campos involucrados.
  - Claves Foráneas (Foreign Keys) con restricciones `ON UPDATE` y `ON DELETE`.
  - Triggers asociados a la tabla.
  - DDL nativo generado por el motor (`SHOW CREATE TABLE`) con botón de copia rápida.

### F. Herramientas de Volcado e Importación (Dump & Restore)
- **Exportación (mysqldump compatible):**
  - Generación de volcado `.sql` con estructura, datos en lotes `INSERT`, vistas, procedimientos, funciones y triggers.
  - Opciones para deshabilitar chequeos de claves foráneas temporalmente durante la importación.
  - Barra de progreso en tiempo real.
- **Importación en Streaming:**
  - Lector de scripts SQL en streaming con delimitadores (`DELIMITER ;;`).
  - Apto para archivos grandes sin desbordamiento de memoria.
  - Registro de errores línea por línea y opción de continuar o detenerse ante errores.

### G. Persistencia y Espacio de Trabajo
- Memoriza solapas, consultas en borrador, historial y configuraciones de grilla por conexión en `localStorage`.
- Memoriza tamaño, posición y estado maximizado de la ventana en `window-state.json`.
- Auto-reconexión opcional al iniciar la app.
- Selector de idioma en tiempo real (Español 🧉 / Inglés 🇺🇸).

### H. Administrador Gráfico de Usuarios, Permisos y Claves (Adaptado a Versiones)
- **Detección Automática de Motor y Versión:**
  - Identificación precisa entre **MySQL** (5.5, 5.6, 5.7, 8.0, 8.4 LTS, 9.0+) y **MariaDB** (5.5, 10.0 a 10.3, 10.4+, 11.x).
  - Detección de matriz de capacidades: Roles, Bloqueo de cuenta (`ACCOUNT LOCK`), Expiración de contraseña (`PASSWORD EXPIRE`), Privilegios dinámicos (`mysql.global_grants`), plugins de autenticación disponibles (`caching_sha2_password`, `mysql_native_password`, `ed25519`, `unix_socket`), y estructura de tablas (`mysql.user` vs vista sobre `mysql.global_priv` en MariaDB 10.4+).
- **Gestión de Cuentas y Claves:**
  - Creación, modificación y renombrado de usuarios (`'usuario'@'host'`) con atajos (`%`, `localhost`).
  - Asignación de contraseñas con sintaxis adaptada:
    - MySQL 8+: `ALTER USER 'u'@'h' IDENTIFIED WITH plugin BY 'pass';`
    - MySQL 5.7: `ALTER USER 'u'@'h' IDENTIFIED WITH plugin BY 'pass';`
    - MariaDB: `ALTER USER` o `SET PASSWORD FOR 'u'@'h' = PASSWORD('pass');`
    - MySQL 5.5/5.6: `SET PASSWORD FOR 'u'@'h' = PASSWORD('pass');`
  - Generador de contraseñas aleatorias seguras de longitud configurable con un clic.
  - Bloqueo y desbloqueo de cuentas (`ACCOUNT LOCK / UNLOCK`).
  - Políticas de expiración de contraseña (`NEVER`, `IMMEDIATE`, `INTERVAL N DAYS`).
  - Límites de recursos por hora (`MAX_QUERIES_PER_HOUR`, `MAX_UPDATES_PER_HOUR`, `MAX_CONNECTIONS_PER_HOUR`, `MAX_USER_CONNECTIONS`).
  - Opciones de cifrado TLS/SSL (`REQUIRE SSL`, `REQUIRE X509`, `REQUIRE NONE`).
- **Gestión Visual de Privilegios:**
  - **Plantillas rápidas con 1 clic:** DBA / Administrador (`ALL PRIVILEGES` + `WITH GRANT OPTION`), Lectura y Escritura, Solo Lectura, Aplicación / Backend, y Limpiar Todo.
  - Grilla organizada por categorías: Datos (DML: `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `FILE`), Estructura (DDL: `CREATE`, `ALTER`, `INDEX`, `DROP`, `ROUTINE`, `VIEW`, `TRIGGER`, etc.), Administración (`SUPER`, `RELOAD`, `SHUTDOWN`, `PROCESS`, etc.).
  - Privilegios dinámicos de MySQL 8 (`SYSTEM_VARIABLES_ADMIN`, `ROLE_ADMIN`, `BACKUP_ADMIN`, etc.) y específicos de MariaDB 10+.
- **Permisos Específicos por Base de Datos:**
  - Asignación granular de permisos a bases de datos individuales (`\`basedatos\`.*`).
  - Agregar o retirar bases de datos con presets dedicados y soporte para `WITH GRANT OPTION` por esquema.
- **Gestión de Roles (MySQL 8 / MariaDB 10+):**
  - Creación de roles, asignación y revocación a usuarios, y rol por defecto.
- **Herramientas de Productividad DBA:**
  - **Duplicar / Clonar Usuario:** Clona todos los privilegios globales y por esquema de un usuario existente para crear uno nuevo (e.g. clonar de `localhost` a `%`) en un solo paso.
  - **Vista Previa SQL en Tiempo Real:** Visualizador con Monaco Editor que muestra el script exacto antes de aplicarlo.
  - Botón para abrir el script en una pestaña del editor SQL para ejecución o auditoría personalizada.

---

## 3. 📦 Comprobación de Compilación
- **Frontend Vite + React 19:** `npm run build:ui` compila exitosamente en ~180 ms.
- **Backend Electron TypeScript:** `npm run build:electron` compila exitosamente sin errores.
- **Build total:** `npm run build` verificado y funcional.
