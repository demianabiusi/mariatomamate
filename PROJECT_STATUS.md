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

---

## 3. 📦 Comprobación de Compilación
- **Frontend Vite + React 19:** `npm run build:ui` compila exitosamente en ~180 ms.
- **Backend Electron TypeScript:** `npm run build:electron` compila exitosamente sin errores.
- **Build total:** `npm run build` verificado y funcional.
