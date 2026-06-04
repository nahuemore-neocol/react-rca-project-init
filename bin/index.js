#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const args = process.argv.slice(2);
const force = args.includes('--force');
const skillsOnly = args.includes('--skills-only');
const help = args.includes('--help') || args.includes('-h');
const positionalArgs = args.filter((arg) => !arg.startsWith('-'));
const targetDir = path.resolve(positionalArgs[0] || process.cwd());
const templateRoot = path.resolve(__dirname, '..', 'templates');
const claudeMarkerStart = '<!-- rca-skills-builder:start -->';
const claudeMarkerEnd = '<!-- rca-skills-builder:end -->';

if (help) {
  printHelp();
  process.exit(0);
}

if (!fs.existsSync(templateRoot)) {
  console.error(`Template directory not found: ${templateRoot}`);
  process.exit(1);
}

fs.mkdirSync(targetDir, { recursive: true });

const results = [];
copyTemplateTree(templateRoot, targetDir, targetDir, results);

for (const result of results) {
  console.log(`${result.status.toUpperCase()} ${result.relativePath}`);
}

const createdCount = results.filter((result) => result.status === 'created').length;
const mergedCount = results.filter((result) => result.status === 'merged').length;
const skippedCount = results.filter((result) => result.status === 'skipped').length;

console.log(`\nScaffold complete in ${targetDir}`);
console.log(`Created: ${createdCount}`);
console.log(`Merged: ${mergedCount}`);
console.log(`Skipped: ${skippedCount}`);

function copyTemplateTree(sourceDir, destinationDir, rootDir, output) {
  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    const sourcePath = path.join(sourceDir, entry.name);
    const destinationPath = path.join(destinationDir, entry.name);

    if (entry.isDirectory()) {
      fs.mkdirSync(destinationPath, { recursive: true });
      copyTemplateTree(sourcePath, destinationPath, rootDir, output);
      continue;
    }

    const relativePath = path.relative(rootDir, destinationPath);
    if (relativePath === 'CLAUDE.md') {
      if (skillsOnly) {
        output.push({ status: 'skipped', relativePath });
        continue;
      }

      mergeClaudeFile(sourcePath, destinationPath, output, relativePath);
      continue;
    }

    if (fs.existsSync(destinationPath) && !force) {
      output.push({ status: 'skipped', relativePath });
      continue;
    }

    fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
    fs.copyFileSync(sourcePath, destinationPath);
    output.push({ status: 'created', relativePath });
  }
}

function mergeClaudeFile(sourcePath, destinationPath, output, relativePath) {
  const templateContent = fs.readFileSync(sourcePath, 'utf8').trim();
  const managedBlock = `${claudeMarkerStart}\n${templateContent}\n${claudeMarkerEnd}\n`;

  if (!fs.existsSync(destinationPath)) {
    fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
    fs.writeFileSync(destinationPath, managedBlock);
    output.push({ status: 'created', relativePath });
    return;
  }

  const existingContent = fs.readFileSync(destinationPath, 'utf8');
  const hasManagedBlock = existingContent.includes(claudeMarkerStart) && existingContent.includes(claudeMarkerEnd);

  if (hasManagedBlock) {
    if (!force) {
      output.push({ status: 'skipped', relativePath });
      return;
    }

    const updatedContent = replaceManagedBlock(existingContent, managedBlock);
    fs.writeFileSync(destinationPath, updatedContent);
    output.push({ status: 'merged', relativePath });
    return;
  }

  const separator = existingContent.endsWith('\n') ? '\n' : '\n\n';
  fs.writeFileSync(destinationPath, `${existingContent}${separator}${managedBlock}`);
  output.push({ status: 'merged', relativePath });
}

function replaceManagedBlock(content, managedBlock) {
  const startIndex = content.indexOf(claudeMarkerStart);
  const endIndex = content.indexOf(claudeMarkerEnd);

  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    return content;
  }

  const blockEnd = endIndex + claudeMarkerEnd.length;
  const before = content.slice(0, startIndex).trimEnd();
  const after = content.slice(blockEnd).trimStart();

  if (!before && !after) {
    return managedBlock;
  }

  if (!before) {
    return `${managedBlock}\n${after}\n`;
  }

  if (!after) {
    return `${before}\n\n${managedBlock}`;
  }

  return `${before}\n\n${managedBlock}\n${after}\n`;
}

function printHelp() {
  console.log('Usage: npx rca-skills-builder [target-directory] [--force] [--skills-only]');
  console.log('');
  console.log('Creates starter .claude/skills files and optionally CLAUDE.md.');
}
