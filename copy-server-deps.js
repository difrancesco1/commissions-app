const fs = require('fs-extra');
const path = require('path');

const serverDeps = [
    'express', 'cors', 'firebase-admin', 'googleapis', '@google-cloud'
];

async function copyDeps() {
    for (const dep of serverDeps) {
        const src = path.join('node_modules', dep);
        const dest = path.join('resources', 'node_modules', dep);
        console.log(`Copying ${src} to ${dest}`);
        await fs.copy(src, dest);
    }
}

copyDeps().catch(console.error);