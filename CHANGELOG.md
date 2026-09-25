# Changelog

## [1.2.0](https://github.com/demianabiusi/mariatomamate/compare/maria-toma-mate-v1.1.0...maria-toma-mate-v1.2.0) (2026-09-25)


### ✨ Features

* manejador grafico de usuarios, permisos y claves adaptado a versiones de MySQL y MariaDB ([0a6127b](https://github.com/demianabiusi/mariatomamate/commit/0a6127be3d28a1c3acf20ced7567d6b5e4b3baec))
* persistent query history with search, favorites and connection filters ([9fc1df3](https://github.com/demianabiusi/mariatomamate/commit/9fc1df30cffb5927068633369683a0297a4fb1b6))
* real-time server variables & status monitor with KPIs, filters and SET GLOBAL ([9c4e918](https://github.com/demianabiusi/mariatomamate/commit/9c4e9186d2cce1384d5e7ba1e5bb3dbdd76106d3))
* soporte para icono en AppImage y autenticacion mysql_old_password ([678b61a](https://github.com/demianabiusi/mariatomamate/commit/678b61a870961ce25584da207feec0eff03215ea))
* SQL formatter, Excel export and 6 visual themes ([3d08d1f](https://github.com/demianabiusi/mariatomamate/commit/3d08d1fb5684f789d068e2e982a286278c144ed5))
* VS Code style command palette (Ctrl+P / Ctrl+K) with instant navigation ([7ac6cf3](https://github.com/demianabiusi/mariatomamate/commit/7ac6cf3a6d973809801ee736e04073074e39d72e))


### 🐛 Bug Fixes

* corregir estructura de linux.desktop en package.json para empaquetado AppImage ([2637cef](https://github.com/demianabiusi/mariatomamate/commit/2637cefb5974798af60430d6da437a246c3866f3))
* replace false 'no connection' warning with skeleton loader in sidebar ([b8dca02](https://github.com/demianabiusi/mariatomamate/commit/b8dca02ab32edf4d5ef49c84296303779fb4cc0b))
* solucionar salto de cursor y mejorar autocompletado en editor SQL ([45c8e57](https://github.com/demianabiusi/mariatomamate/commit/45c8e5730a006d5ac6af3837efaddddf461aa632))

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
