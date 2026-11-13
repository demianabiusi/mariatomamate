# Changelog

## [1.4.0](https://github.com/demianabiusi/mariatomamate/compare/maria-toma-mate-v1.3.2...maria-toma-mate-v1.4.0) (2026-11-13)


### ✨ Features

* add dependency-aware object list filter and topological SQL sync to Schema Diff ([4ebac45](https://github.com/demianabiusi/mariatomamate/commit/4ebac456486f54a98b78cb4332a718cb04aa4d91))
* add PHP HTTP/HTTPS tunnel bridge with built-in mtm_tunnel.php generator ([e152900](https://github.com/demianabiusi/mariatomamate/commit/e152900b5787e89d8b4dc0519e92d53f19a2c5f7))
* desplegar tablas y vistas para ver campos y tipos de datos en el explorador de objetos ([8d80873](https://github.com/demianabiusi/mariatomamate/commit/8d8087397b7e510fe9b2d2f1984c4849b7b92a21))
* **grid:** replace insert row modal with inline editable table row ([ecac96b](https://github.com/demianabiusi/mariatomamate/commit/ecac96bcbf5dd58c7c071829baa59c46d2e80d5f))
* **grid:** support NOW(), CURRENT_DATE and temporal SQL functions in inline edit and insert ([f9305cd](https://github.com/demianabiusi/mariatomamate/commit/f9305cdb916847e49ff77b4dd7da6e11de28ab6d))
* incremento automatico de version al marcar tags y visualizacion de fecha de compilacion en pantalla ([1d9e084](https://github.com/demianabiusi/mariatomamate/commit/1d9e084bf11230e2f47b3b34e2b8d006419661ec))
* initial commit for Maria Toma Mate v1.0.0 ([34dc29e](https://github.com/demianabiusi/mariatomamate/commit/34dc29e2e3a384f8f52503a705aa704b65740f91))
* manejador grafico de usuarios, permisos y claves adaptado a versiones de MySQL y MariaDB ([0a6127b](https://github.com/demianabiusi/mariatomamate/commit/0a6127be3d28a1c3acf20ced7567d6b5e4b3baec))
* persist and restore active database on reconnect and startup ([3cfa396](https://github.com/demianabiusi/mariatomamate/commit/3cfa39693c6d96930ce59a08f85223342971e991))
* persistent query history with search, favorites and connection filters ([9fc1df3](https://github.com/demianabiusi/mariatomamate/commit/9fc1df30cffb5927068633369683a0297a4fb1b6))
* real-time server variables & status monitor with KPIs, filters and SET GLOBAL ([9c4e918](https://github.com/demianabiusi/mariatomamate/commit/9c4e9186d2cce1384d5e7ba1e5bb3dbdd76106d3))
* **schema-diff:** add optional ignore comments for routines, views, triggers, tables and columns ([b0ddc71](https://github.com/demianabiusi/mariatomamate/commit/b0ddc71a7e5b20b142b92f9c31f6c55a962593ba))
* soporte para icono en AppImage y autenticacion mysql_old_password ([678b61a](https://github.com/demianabiusi/mariatomamate/commit/678b61a870961ce25584da207feec0eff03215ea))
* soporte para insertar y borrar filas en grilla y generacion de instalador Windows, portable y AppImage en CI/CD ([698a178](https://github.com/demianabiusi/mariatomamate/commit/698a178de2f89a2023c02cd5b9610a4e8d28cd90))
* SQL formatter, Excel export and 6 visual themes ([3d08d1f](https://github.com/demianabiusi/mariatomamate/commit/3d08d1fb5684f789d068e2e982a286278c144ed5))
* VS Code style command palette (Ctrl+P / Ctrl+K) with instant navigation ([7ac6cf3](https://github.com/demianabiusi/mariatomamate/commit/7ac6cf3a6d973809801ee736e04073074e39d72e))


### 🐛 Bug Fixes

* bundle monaco-editor locally to fix 'Loading ...' hang in offline/electron environment ([173b087](https://github.com/demianabiusi/mariatomamate/commit/173b0873a8f5e3d35382b624679c07dda1f1c3db))
* **ci:** stage package-lock.json and check only staged changes in version sync ([2a66542](https://github.com/demianabiusi/mariatomamate/commit/2a66542e578a6197d7a14be11fcb20653e418350))
* corregir atajo F9 para ejecutar consulta activa sin abrir modal de conexión ([25a47bf](https://github.com/demianabiusi/mariatomamate/commit/25a47bfa336fc1d7475fcfdbede3da4b24dad153))
* corregir estructura de linux.desktop en package.json para empaquetado AppImage ([2637cef](https://github.com/demianabiusi/mariatomamate/commit/2637cefb5974798af60430d6da437a246c3866f3))
* open routine source code on click/edit and support DELIMITER execution ([80aaa65](https://github.com/demianabiusi/mariatomamate/commit/80aaa6559498efdc1d0ec62e2aacdb6a08862a30))
* replace false 'no connection' warning with skeleton loader in sidebar ([b8dca02](https://github.com/demianabiusi/mariatomamate/commit/b8dca02ab32edf4d5ef49c84296303779fb4cc0b))
* **schema-diff:** fix DependencyAnalysisResult property access in SchemaDiffModal ([8f77f6c](https://github.com/demianabiusi/mariatomamate/commit/8f77f6c26ca96acbf3a88444904836da09937fbc))
* solucionar salto de cursor y mejorar autocompletado en editor SQL ([45c8e57](https://github.com/demianabiusi/mariatomamate/commit/45c8e5730a006d5ac6af3837efaddddf461aa632))


### 💄 UI & Styles

* redesign app icon with warm leather calabaza, chrome virola, and solid database pedestal ([e03c81f](https://github.com/demianabiusi/mariatomamate/commit/e03c81fceb414a218feca4568d9ceaa855ac9a86))

## [1.1.0](https://github.com/demianabiusi/mariatomamate/compare/maria-toma-mate-v1.0.0...maria-toma-mate-v1.1.0) (2026-09-16)


### ✨ Features

* initial commit for Maria Toma Mate v1.0.0 ([34dc29e](https://github.com/demianabiusi/mariatomamate/commit/34dc29e2e3a384f8f52503a705aa704b65740f91))
* persist and restore active database on reconnect and startup ([3cfa396](https://github.com/demianabiusi/mariatomamate/commit/3cfa39693c6d96930ce59a08f85223342971e991))


### 🐛 Bug Fixes

* bundle monaco-editor locally to fix 'Loading ...' hang in offline/electron environment ([173b087](https://github.com/demianabiusi/mariatomamate/commit/173b0873a8f5e3d35382b624679c07dda1f1c3db))
* corregir atajo F9 para ejecutar consulta activa sin abrir modal de conexión ([25a47bf](https://github.com/demianabiusi/mariatomamate/commit/25a47bfa336fc1d7475fcfdbede3da4b24dad153))
* open routine source code on click/edit and support DELIMITER execution ([80aaa65](https://github.com/demianabiusi/mariatomamate/commit/80aaa6559498efdc1d0ec62e2aacdb6a08862a30))


### 💄 UI & Styles

* redesign app icon with warm leather calabaza, chrome virola, and solid database pedestal ([e03c81f](https://github.com/demianabiusi/mariatomamate/commit/e03c81fceb414a218feca4568d9ceaa855ac9a86))
