require('dotenv').config();

const mongoose = require('mongoose');
const { connectDatabase } = require('../src/config/database');

async function fixCreditTransactionIndex() {
  await connectDatabase();
  const collection = mongoose.connection.collection('credittransactions');
  const indexes = await collection.indexes();
  const legacy = indexes.find((index) => index.name === 'user_1_reference_1');
  if (legacy && !legacy.partialFilterExpression) {
    await collection.dropIndex(legacy.name);
  }
  const current = (await collection.indexes()).find((index) => index.name === 'user_1_reference_1');
  if (!current) {
    await collection.createIndex(
      { user: 1, reference: 1 },
      {
        name: 'user_1_reference_1',
        unique: true,
        partialFilterExpression: { reference: { $type: 'string' } },
      },
    );
  }
  console.log('Credit transaction index is up to date.');
}

fixCreditTransactionIndex()
  .catch((error) => {
    console.error(`Could not update credit transaction index: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
