const { app } = require('electron');
console.log('app is:', typeof app);
if (app) {
  console.log('app.whenReady is:', typeof app.whenReady);
}
