const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const test = require('node:test');
const { filePath, removeFiles, saveFiles } = require('../src/services/verification-files');

test('stores and removes a genuine PDF privately', async () => {
  const content = Buffer.from('%PDF-1.4\n%%EOF');
  const files = await saveFiles([{ originalname: 'qualification.pdf', size: content.length, buffer: content }]);
  try {
    assert.equal(files[0].mimeType, 'application/pdf');
    assert.deepEqual(await fs.readFile(filePath(files[0].id)), content);
  } finally {
    await removeFiles(files);
  }
  await assert.rejects(fs.access(filePath(files[0].id)));
});

test('rejects a fake PDF based on its content', async () => {
  const content = Buffer.from('not really a PDF');
  await assert.rejects(saveFiles([{ originalname: 'fake.pdf', size: content.length, buffer: content }]), /Only PDF, PNG, or JPEG/);
});

test('does not accept unsafe file identifiers', () => {
  assert.equal(filePath('../outside'), null);
});
