const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');

const directory = path.resolve(__dirname, '../../private_uploads/verification');

function detectedMime(buffer) {
  if (buffer.subarray(0, 5).toString() === '%PDF-') return 'application/pdf';
  if (buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png';
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  return null;
}

function filePath(id) {
  if (!/^[a-f0-9-]{36}$/.test(id)) return null;
  return path.join(directory, id);
}

async function saveFiles(files) {
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  const saved = [];
  try {
    for (const file of files) {
      const mimeType = detectedMime(file.buffer);
      if (!mimeType || file.size < 8) throw Object.assign(new Error('Only PDF, PNG, or JPEG documents are allowed.'), { status: 400 });
      const id = crypto.randomUUID();
      const name = path.basename(file.originalname).replace(/[\r\n\\/]/g, '').slice(0, 180);
      if (name.length < 2) throw Object.assign(new Error('Invalid document name.'), { status: 400 });
      await fs.writeFile(filePath(id), file.buffer, { flag: 'wx', mode: 0o600 });
      saved.push({ id, name, mimeType, size: file.size });
    }
    return saved;
  } catch (error) {
    await removeFiles(saved);
    throw error;
  }
}

async function removeFiles(files) {
  await Promise.all(files.map((file) => fs.unlink(filePath(file.id)).catch(() => null)));
}

module.exports = { filePath, saveFiles, removeFiles };
