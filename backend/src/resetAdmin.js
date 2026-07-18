const mongoose = require('mongoose');
const config = require('./config');
const User = require('./models/User');

async function resetAdminUser() {
  await mongoose.connect(config.MONGODB_URI);
  const result = await User.deleteOne({ username: 'admin' });
  if (result.deletedCount > 0) {
    console.log('Deleted existing admin user. It will be recreated with default credentials (admin / dog8homework) on next server start.');
  } else {
    console.log('No admin user found to delete.');
  }
  await mongoose.disconnect();
}

resetAdminUser()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Failed to reset admin user:', err);
    process.exit(1);
  });
