# Maria Toma Mate 🧉

[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg)](https://opensource.org/licenses/MIT)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20Linux-blue.svg)]()
[![MariaDB & MySQL](https://img.shields.io/badge/MariaDB%20%7C%20MySQL-100%25%20Compatible-teal.svg)](https://mariadb.org/)

**Maria Toma Mate** es un cliente de escritorio moderno, ágil y liviano para **MariaDB y MySQL**, desarrollado con **Electron**, **React 19**, **TypeScript**, **Tailwind CSS v4** y **Monaco Editor**.

Nació para ofrecer una experiencia rápida, productiva y placentera, combinando la ligereza y flujo de trabajo ágil de **SQLyog** con una estética contemporánea, atajos intuitivos y la potencia del editor de código de **VS Code**.

---

## 🧉 ¿Por qué Maria Toma Mate?

En el día a día con MariaDB y MySQL, los desarrolladores suelen enfrentarse a:
- **DBeaver:** Muy potente pero extremadamente pesado (Java/Eclipse), consume cientos de megabytes y tarda valiosos segundos en abrir para una consulta puntual.
- **MySQL Workbench:** Pesado, propenso a cuelgues repentinos y visualmente tosco.
- **phpMyAdmin:** Requiere servidor web local / Apache / PHP activo, limitado en fluidez de teclado.
- **SQLyog:** Rápido y querido, pero de interfaz añeja, propietario y orientado exclusivamente a Windows.

**Maria Toma Mate** se concibió como esa herramienta que abrís al instante mientras te cebás un buen mate:
- Inicia en menos de 1 segundo.
- No congela la máquina.
- Posee autocompletado inteligente de tablas y columnas (IntelliSense).
- Recuerda tus solapas, consultas y credenciales por conexión.

---

## ✨ Características Principales

### 🧠 Editor SQL Inteligente (Monaco Editor)
- **Autocompletado de Columnas por Tabla:** Escribí `usuarios.` o `u.` (resolviendo alias de `FROM` y `JOIN`) para desplegar de inmediato la lista de campos de esa tabla.
- **Palabras Clave y Funciones de MariaDB/MySQL:** Sugiere y resalta sentencias (`SELECT`, `INSERT`, `UPDATE`, `LIMIT`, `GROUP_CONCAT`, `COALESCE`, `JSON_EXTRACT`, etc.).
- **Atajos y Swap F9 / F5:** Ejecutá consultas con `F9` o `Ctrl + Enter`. Incluye botón para intercambiar **F9 / F5** (ideal para usuarios habituados a SQLyog donde F5 ejecuta).
- **Ejecución de Selección:** Ejecutá únicamente el fragmento seleccionado o el script completo.
- **Múltiples Solapas:** Creá, renombrá y cerrá solapas independientes de consulta.

### 🗄️ Árbol de Objetos y Navegación Multi-Base de Datos
- **Selector rápido de bases de datos:** Cambiá de esquema con un clic desde el dropdown superior o mediante `USE \`bd\``.
- **Explorador completo de objetos:**
  - 📋 **Tablas:** Conteo, menú contextual para consultar primeros 100 registros, ver detalles o diseñar tabla.
  - 👁️ **Vistas:** Consulta rápida, edición de DDL (`SHOW CREATE VIEW`) y eliminación.
  - ⚙️ **Procedimientos Almacenados:** Inspección de parámetros y generación de plantilla `CALL \`procedimiento\`()`.
  - ⚡ **Funciones Almacenadas:** Inspección y plantilla `SELECT \`funcion\`()`.
  - 🔔 **Triggers:** Disparadores asociados a tablas con timing y evento.
  - ⏱️ **Eventos Programados:** Tareas programadas del motor.
- **Filtro de Búsqueda en Tiempo Real:** Filtrá tablas y rutinas al instante.

### 🛠️ Diseñador Visual de Tablas
- Creá y modificá tablas sin memorizar la sintaxis DDL.
- Soporte para tipos de datos de MySQL/MariaDB: `INT`, `BIGINT`, `VARCHAR`, `TEXT`, `DECIMAL`, `DATETIME`, `JSON`, `ENUM`, etc.
- Configuración de flags: `Unsigned`, `Nullable`, `Primary Key (PK)`, `Auto Increment (AI)`, valores por defecto y comentarios.
- Motores de almacenamiento: `InnoDB`, `MyISAM`, `MEMORY`.
- Pestaña de **Vista Previa SQL** con opción de ejecutar directamente o transferir el script al editor.

### 📊 Grilla de Resultados de Alto Rendimiento
- Grilla virtualizada y paginada capaz de manejar miles de filas sin ralentizarse.
- **Filtro y ordenamiento:** Búsqueda en tiempo real sobre los resultados y orden ascendente/descendente por columna.
- **Copia rápida al portapapeles:** Copiá valores de celda con un solo clic.
- **Inspección de Celdas:** Visor emergente para campos extensos, documentos JSON o datos binarios/BLOB.
- **Exportación Flexible:** Exportá a **CSV**, **JSON** o sentencias **SQL INSERT**.

### 💾 Herramientas de Volcado e Importación (Dump & Restore)
- **Exportar Dump (mysqldump compatible):** Generá volcados `.sql` con estructura (DDL), datos en bloques `INSERT`, vistas, rutinas y triggers con cheques de foreign keys.
- **Importador SQL en Streaming:** Importá scripts y respaldos SQL de cualquier tamaño (cientos de megabytes) con barra de progreso en tiempo real y opción de detenerse o continuar ante errores.

### 🔒 Persistencia y Espacio de Trabajo
- **Espacio de trabajo por conexión:** Cada perfil recuerda sus solapas abiertas, consultas escritas, historial y límite de filas en `localStorage`.
- **Persistencia de Ventana:** Recuerda tamaño, posición en pantalla y si estaba maximizada.
- **Auto-reconexión al iniciar:** Reconecta automáticamente a la última conexión activa al iniciar la app.

### 🔐 Conexiones Seguras con Túnel SSH (Bastion / Jump Host)
- **Túneles SSH Integrados:** Conectate a bases de datos alojadas en servidores privados (VPC, AWS RDS, DigitalOcean, VPS) a través de un servidor intermedio SSH.
- **Autenticación SSH Flexible:** Soporta autenticación por contraseña o archivo de clave privada (`.pem`, `.id_rsa`, `.key`, OpenSSH, Ed25519) con frase de paso (passphrase) opcional y selector de archivos nativo.
- **Prueba Independiente de Túnel:** Botón dedicado para probar la conexión SSH y medir la latencia antes de intentar conectar la base de datos.
- **Guardado Automático:** Los parámetros del túnel SSH quedan guardados en cada perfil de conexión.

---

## 🛠️ Desarrollo y Compilación

### Requisitos
- [Node.js](https://nodejs.org/) v18+ (recomendado v20 o v22)
- [npm](https://www.npmjs.com/) v9+

### Instalación
```bash
git clone https://github.com/demianabiusi/mariatomamate.git
cd mariatomamate
npm install
```

### Ejecutar en Desarrollo
```bash
npm run dev
```

### Compilar Proyecto
```bash
# Compilar UI y proceso Electron
npm run build

# Generar ejecutable portable para Windows (.exe)
npm run package:win

# Generar instalador NSIS para Windows
npm run package:win:nsis

# Generar AppImage para Linux
npm run package:linux
```

---

## 📄 Licencia

Este proyecto está bajo la Licencia **MIT** - consulta el archivo [LICENSE](LICENSE) para más detalles. Desarrollado con 🧉 por Demian Abiusi.
