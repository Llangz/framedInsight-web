const fs = require('fs');
const path = require('path');

const toDelete = [
  'app/{api,dashboard,plots,auth}',
  'components/{ui,features}',
  'middleware.ts'
];

toDelete.forEach(p => {
  const fullPath = path.join(__dirname, p);
  if (fs.existsSync(fullPath)) {
    fs.rmSync(fullPath, { recursive: true, force: true });
    console.log(`Deleted: ${fullPath}`);
  }
});
