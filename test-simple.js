console.log('Running in Electron:', process.versions.electron ? 'Yes' : 'No');
console.log('Process type:', process.type);
const electron = require('electron');
console.log('electron module type:', typeof electron);
console.log('electron keys:', Object.keys(electron || {}));
