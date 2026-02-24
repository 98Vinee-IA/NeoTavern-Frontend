# Visual Lorebook Backend Implementation Plan

## Overview

Implement backend API endpoints for Visual Lorebook extension. This backend is in a separate repository from NeoTavern frontend.

## Required Endpoints

1. **POST /api/visual-lorebook/upload** - Upload media files
2. **DELETE /api/visual-lorebook/delete** - Delete media files
3. **GET /api/visual-lorebook/media/:filename** - Serve media files
4. **GET /api/visual-lorebook/metadata/:lorebookName** - Get media metadata for a lorebook
5. **POST /api/visual-lorebook/metadata/:lorebookName** - Update media metadata for an entry
6. **DELETE /api/visual-lorebook/metadata/:lorebookName** - Remove media metadata for an entry

## File Structure

```
backend/
├── src/
│   └── endpoints/
│       └── visual-lorebook.js
└── data/
    └── default-user/
        └── visual-lorebook/
            ├── media/              # Media files
            │   ├── fantasy-world-123-1739501234.jpg
            │   ├── fantasy-world-456-1739504567.png
            │   └── my-lorebook-789-1739509876.mp4
            └── fantasy-world.json     # Media metadata files
            ├── my-lorebook.json
            └── another-lorebook.json
```

## Implementation Steps

### Step 1: Create Express Router

**File**: `backend/src/endpoints/visual-lorebook.js`

```javascript
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();
const uploadDir = path.join(process.cwd(), 'backend', 'data', 'default-user', 'visual-lorebook', 'media');
const mediaMetadataDir = path.join(process.cwd(), 'backend', 'data', 'default-user', 'visual-lorebook');

// Ensure directories exist
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
if (!fs.existsSync(mediaMetadataDir)) {
  fs.mkdirSync(mediaMetadataDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename: {lorebook-name}-{entry-uid}-{timestamp}.ext
    const ext = path.extname(file.originalname);
    const lorebookName = req.body.lorebook;
    const entryUid = req.body.entryUid;
    const timestamp = Date.now();
    cb(null, `${lorebookName}-${entryUid}-${timestamp}${ext}`);
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max
  },
  fileFilter: (req, file, cb) => {
    // Allow images and videos
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'image/bmp',
      'image/svg+xml',
      'video/mp4',
      'video/webm',
      'video/quicktime',
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images and videos are allowed.'), false);
    }
  },
});

// POST /api/visual-lorebook/upload - Upload media file
router.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  // Get lorebook name and entry UID from request body
  const { lorebook, entryUid } = req.body;

  res.json({
    filename: req.file.filename,
    lorebook,
    entryUid,
    path: `/backend/data/default-user/visual-lorebook/media/${req.file.filename}`,
    size: req.file.size,
    mimetype: req.file.mimetype,
  });
});

// DELETE /api/visual-lorebook/delete - Delete media file
router.delete('/delete', (req, res) => {
  const { mediaId } = req.body;

  if (!mediaId) {
    return res.status(400).json({ error: 'mediaId is required' });
  }

  const filePath = path.join(uploadDir, mediaId);

  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'File not found' });
  }
});

// GET /api/visual-lorebook/media/:filename - Serve media files
router.get('/media/:filename', (req, res) => {
  const filePath = path.join(uploadDir, req.params.filename);

  if (fs.existsSync(filePath)) {
    // Determine content type
    const ext = path.extname(filePath).toLowerCase();
    const contentTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
      '.gif': 'image/gif',
      '.bmp': 'image/bmp',
      '.svg': 'image/svg+xml',
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.mov': 'video/quicktime',
    };

    res.setHeader('Content-Type', contentTypes[ext] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1 year cache
    res.sendFile(filePath);
  } else {
    res.status(404).json({ error: 'File not found' });
  }
});

// GET /api/visual-lorebook/metadata/:lorebookName - Get media metadata for a lorebook
router.get('/metadata/:lorebookName', (req, res) => {
  const { lorebookName } = req.params;
  const metadataPath = path.join(mediaMetadataDir, `${lorebookName}.json`);

  if (fs.existsSync(metadataPath)) {
    const data = fs.readFileSync(metadataPath, 'utf-8');
    res.json(JSON.parse(data));
  } else {
    res.status(404).json({ error: 'Media metadata not found' });
  }
});

// POST /api/visual-lorebook/metadata/:lorebookName - Update media metadata for an entry
router.post('/metadata/:lorebookName', (req, res) => {
  const { lorebookName } = req.params;
  const { entryUid, mediaData } = req.body;

  if (!entryUid || !mediaData) {
    return res.status(400).json({ error: 'entryUid and mediaData are required' });
  }

  const metadataPath = path.join(mediaMetadataDir, `${lorebookName}.json`);

  let metadata;
  if (fs.existsSync(metadataPath)) {
    metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
  } else {
    metadata = { name: lorebookName, entries: {} };
  }

  // Update the entry's media data
  metadata.entries[entryUid] = mediaData;

  // Write back to file
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

  res.json({ success: true });
});

// DELETE /api/visual-lorebook/metadata/:lorebookName - Remove media metadata for an entry
router.delete('/metadata/:lorebookName', (req, res) => {
  const { lorebookName } = req.params;
  const { entryUid } = req.body;

  if (!entryUid) {
    return res.status(400).json({ error: 'entryUid is required' });
  }

  const metadataPath = path.join(mediaMetadataDir, `${lorebookName}.json`);

  if (!fs.existsSync(metadataPath)) {
    return res.status(404).json({ error: 'Media metadata not found' });
  }

  const data = fs.readFileSync(metadataPath, 'utf-8');
  const metadata = JSON.parse(data);

  // Remove the entry's media data
  delete metadata.entries[entryUid];

  // Clean up empty metadata files
  if (Object.keys(metadata.entries).length === 0) {
    // Optionally: delete the metadata file itself
    // fs.unlinkSync(metadataPath);
  }

  // Write back to file
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
  res.json({ success: true });
});

module.exports = router;
```

### Step 2: Register Router in Main App

**File**: `backend/src/app.js` (or wherever main Express app is configured)

Add the router:

```javascript
const visualLorebookRouter = require('./endpoints/visual-lorebook');
app.use('/api/visual-lorebook', visualLorebookRouter);
```

## Important Notes

1. **No chmod permissions needed** - The backend route serves files directly, so no special folder permissions are required
2. **File naming convention** - Media files are named as `{lorebook-name}-{entry-uid}-{timestamp}.ext`
3. **Parallel JSON files** - Media metadata is stored in separate `{lorebook-name}.json` files
4. **Error handling** - All endpoints return appropriate HTTP status codes and error messages
5. **Clean up** - When all entries are removed from a metadata file, consider deleting the metadata file itself
6. **Storage location** - Media and metadata are stored in `/backend/data/default-user/visual-lorebook/` relative to the base project folder
7. **Route registration required** - After creating `visual-lorebook.js`, you must import and register it in the server startup code (e.g., `backend/src/server-main.js` or `backend/src/server-startup.js`) with `app.use('/api/visual-lorebook', visualLorebookRouter)` for the endpoints to be available

## Testing

1. Test upload with various file types (PNG, JPG, WEBP, GIF, BMP, SVG, MP4, WEBM, MOV)
2. Test file size validation (5MB for images, 50MB for videos)
3. Test media deletion
4. Test metadata retrieval
5. Test metadata update
6. Test metadata removal
7. Test media serving
