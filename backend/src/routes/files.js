import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { addFile, findFileById } from '../db/index.js';

const router = express.Router();

const uploadDir = './uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, uuidv4() + ext);
  },
});

const upload = multer({ storage, limits: { fileSize: 100 * 1024 * 1024 } });

router.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file provided' });
  }

  const { sessionId, uploaderName } = req.body;
  if (!sessionId) {
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: 'sessionId required' });
  }

  const fileRecord = addFile(
    sessionId,
    req.file.originalname,
    req.file.filename,
    req.file.mimetype,
    req.file.size,
    uploaderName || 'Unknown'
  );

  res.status(201).json(fileRecord);
});

router.get('/:id', (req, res) => {
  const file = findFileById(req.params.id);
  if (!file) {
    return res.status(404).json({ error: 'File not found' });
  }

  const filePath = path.join(uploadDir, file.stored_name);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found on disk' });
  }

  res.download(filePath, file.original_name);
});

export default router;
