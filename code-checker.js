#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

const jsDir = './js';

// Read all JS files
const files = fs.readdirSync(jsDir).filter(file => file.endsWith('.js'));

console.log('🔍 COMPREHENSIVE CODE ANALYSIS\n');

// 1. Check for duplicate function definitions
console.log('1. CHECKING FOR DUPLICATE FUNCTION DEFINITIONS:');
const allFunctions = new Map();

files.forEach(file => {
    const content = fs.readFileSync(path.join(jsDir, file), 'utf8');
    const lines = content.split('\n');
    
    lines.forEach((line, index) => {
        // Match function declarations and exports
        const functionMatch = line.match(/(?:export\s+)?function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/);
        if (functionMatch) {
            const funcName = functionMatch[1];
            if (allFunctions.has(funcName)) {
                const existing = allFunctions.get(funcName);
                console.log(`❌ DUPLICATE: ${funcName}`);
                console.log(`   - First: ${existing.file}:${existing.line}`);
                console.log(`   - Duplicate: ${file}:${index + 1}`);
            } else {
                allFunctions.set(funcName, { file, line: index + 1 });
            }
        }
    });
});

// 2. Check imports vs exports
console.log('\n2. CHECKING IMPORT/EXPORT CONSISTENCY:');
const exports = new Map();
const imports = new Map();

files.forEach(file => {
    const content = fs.readFileSync(path.join(jsDir, file), 'utf8');
    
    // Find exports
    const exportMatches = content.matchAll(/export\s+(?:function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)|(?:const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)|{([^}]+)})/g);
    for (const match of exportMatches) {
        const exportName = match[1] || match[2] || match[3];
        if (exportName) {
            if (match[3]) {
                // Handle destructured exports
                const names = match[3].split(',').map(n => n.trim());
                names.forEach(name => {
                    if (!exports.has(name)) exports.set(name, []);
                    exports.get(name).push(file);
                });
            } else {
                if (!exports.has(exportName)) exports.set(exportName, []);
                exports.get(exportName).push(file);
            }
        }
    }
    
    // Find imports
    const importMatches = content.matchAll(/import\s+{([^}]+)}\s+from\s+['"]([^'"]+)['"]/g);
    for (const match of importMatches) {
        const importedNames = match[1].split(',').map(n => n.trim());
        const fromFile = match[2];
        importedNames.forEach(name => {
            if (!imports.has(name)) imports.set(name, []);
            imports.get(name).push({ file, from: fromFile });
        });
    }
});

// Check for missing exports
for (const [importName, importers] of imports) {
    if (!exports.has(importName)) {
        console.log(`❌ MISSING EXPORT: ${importName}`);
        importers.forEach(imp => {
            console.log(`   - Imported in: ${imp.file} from ${imp.from}`);
        });
    }
}

// 3. Check for circular dependencies
console.log('\n3. CHECKING FOR CIRCULAR DEPENDENCIES:');
const dependencies = new Map();

files.forEach(file => {
    const content = fs.readFileSync(path.join(jsDir, file), 'utf8');
    const importMatches = content.matchAll(/import\s+.*\s+from\s+['"]\.\/([^'"]+)['"]/g);
    const deps = [];
    for (const match of importMatches) {
        deps.push(match[1] + '.js');
    }
    dependencies.set(file, deps);
});

function findCircularDeps(file, visited = new Set(), path = []) {
    if (path.includes(file)) {
        const cycleStart = path.indexOf(file);
        const cycle = path.slice(cycleStart).concat(file);
        return cycle;
    }
    
    if (visited.has(file)) return null;
    visited.add(file);
    
    const deps = dependencies.get(file) || [];
    for (const dep of deps) {
        const cycle = findCircularDeps(dep, visited, [...path, file]);
        if (cycle) return cycle;
    }
    
    return null;
}

files.forEach(file => {
    const cycle = findCircularDeps(file);
    if (cycle) {
        console.log(`❌ CIRCULAR DEPENDENCY: ${cycle.join(' → ')}`);
    }
});

// 4. Check for undefined variables/functions
console.log('\n4. CHECKING FOR COMMON ISSUES:');
files.forEach(file => {
    const content = fs.readFileSync(path.join(jsDir, file), 'utf8');
    const lines = content.split('\n');
    
    lines.forEach((line, index) => {
        // Check for common issues
        if (line.includes('state.explosionPool =')) {
            console.log(`❌ DIRECT ASSIGNMENT: ${file}:${index + 1} - use setter instead`);
        }
        if (line.includes('state.projectilePool =')) {
            console.log(`❌ DIRECT ASSIGNMENT: ${file}:${index + 1} - use setter instead`);
        }
        // Check for any direct state property assignments
        const directAssignment = line.match(/state\.([a-zA-Z_$][a-zA-Z0-9_$]*)\s*[=]/);
        if (directAssignment && !line.includes('state.keyboardState')) {
            const prop = directAssignment[1];
            console.log(`❌ DIRECT ASSIGNMENT: ${file}:${index + 1} - state.${prop} = ... (use setter instead)`);
        }
        // Check for increment/decrement operations
        const incDecAssignment = line.match(/state\.([a-zA-Z_$][a-zA-Z0-9_$]*)\s*[+]{2}|state\.([a-zA-Z_$][a-zA-Z0-9_$]*)\s*[-]{2}/);
        if (incDecAssignment) {
            const prop = incDecAssignment[1] || incDecAssignment[2];
            console.log(`❌ INC/DEC ASSIGNMENT: ${file}:${index + 1} - state.${prop}++ or state.${prop}-- (use setter instead)`);
        }
    });
});

console.log('\n✅ ANALYSIS COMPLETE\n');