#!/usr/bin/env node

/**
 * Script para automatizar el incremento de versión y creación de tags.
 * Uso:
 *   node scripts/bump-and-tag.cjs [patch|minor|major|x.y.z] [--push]
 * Ejemplos:
 *   node scripts/bump-and-tag.cjs patch --push
 *   npm run release:patch
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function run(cmd) {
  console.log(`> ${cmd}`);
  return execSync(cmd, { stdio: 'inherit' });
}

function runOutput(cmd) {
  return execSync(cmd, { encoding: 'utf8' }).trim();
}

const rootDir = path.resolve(__dirname, '..');
const pkgPath = path.join(rootDir, 'package.json');
const manifestPath = path.join(rootDir, '.release-please-manifest.json');

if (!fs.existsSync(pkgPath)) {
  console.error('Error: no se encontró package.json');
  process.exit(1);
}

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const currentVersion = pkg.version;

const args = process.argv.slice(2);
const shouldPush = args.includes('--push');
const typeOrVersion = args.find(a => !a.startsWith('--')) || 'patch';

let newVersion;

if (typeOrVersion === 'patch' || typeOrVersion === 'minor' || typeOrVersion === 'major') {
  const parts = currentVersion.split('.').map(n => parseInt(n, 10));
  if (parts.length !== 3 || parts.some(isNaN)) {
    console.error(`Formato de versión semver inválido en package.json: ${currentVersion}`);
    process.exit(1);
  }
  if (typeOrVersion === 'major') {
    parts[0] += 1;
    parts[1] = 0;
    parts[2] = 0;
  } else if (typeOrVersion === 'minor') {
    parts[1] += 1;
    parts[2] = 0;
  } else {
    parts[2] += 1;
  }
  newVersion = parts.join('.');
} else {
  // Versión explícita especificada por el usuario
  newVersion = typeOrVersion.startsWith('v') ? typeOrVersion.slice(1) : typeOrVersion;
  if (!/^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$/.test(newVersion)) {
    console.error(`Versión inválida: ${newVersion}. Debe seguir semver (ej. 1.2.0)`);
    process.exit(1);
  }
}

console.log(`\n=============================================`);
console.log(`🚀 Incrementando versión: ${currentVersion} -> ${newVersion}`);
console.log(`=============================================\n`);

// 1. Actualizar package.json
pkg.version = newVersion;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
console.log(`✓ Actualizado package.json a ${newVersion}`);

// 2. Actualizar .release-please-manifest.json si existe
if (fs.existsSync(manifestPath)) {
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    manifest['.'] = newVersion;
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
    console.log(`✓ Actualizado .release-please-manifest.json a ${newVersion}`);
  } catch (err) {
    console.warn(`! No se pudo actualizar .release-please-manifest.json:`, err);
  }
}

// 3. Stage de los archivos de versión
run('git add package.json .release-please-manifest.json');

// 4. Commit y creación de tag
const tagName = `v${newVersion}`;
try {
  run(`git commit -m "chore(release): ${tagName}"`);
} catch (e) {
  console.log('Nota: sin cambios pendientes para commitear o ya confirmado.');
}

// Verificar si el tag ya existe antes de crearlo
try {
  run(`git tag -a "${tagName}" -m "Release ${tagName}"`);
  console.log(`✓ Creado tag git: ${tagName}`);
} catch (err) {
  console.error(`! No se pudo crear el tag ${tagName}. Es posible que ya exista.`);
}

console.log(`\n🎉 Versión ${newVersion} preparada y tag ${tagName} listo.`);

// 5. Opcional: Push inmediato a origin
if (shouldPush) {
  console.log(`\n📤 Enviando commit y tags a GitHub (origin/main)...`);
  run('git push origin main --follow-tags');
  console.log(`✓ ¡Push completado exitosamente! GitHub Actions compilará los ejecutables para ${tagName}.`);
} else {
  console.log(`\nPara enviar los cambios y el tag a GitHub ejecuta:\n  git push origin main --follow-tags\n`);
}
