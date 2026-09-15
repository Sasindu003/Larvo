import { Router, Request, Response } from 'express';
import { getFileFromGridFS } from '../services/gridfs.service';

const router = Router();

const handleFileStream = async (fileIdentifier: string, res: Response): Promise<void> => {
  try {
    const fileData = await getFileFromGridFS(fileIdentifier);

    if (!fileData) {
      res.status(404).json({
        success: false,
        message: 'File not found in MongoDB storage',
      });
      return;
    }

    res.setHeader('Content-Type', fileData.contentType);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(fileData.filename)}"`
    );

    fileData.stream.on('error', (_err) => {
      if (!res.headersSent) {
        res.status(500).json({ success: false, message: 'Error streaming file' });
      }
    });

    fileData.stream.pipe(res);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error?.message || 'Failed to retrieve file',
    });
  }
};

/**
 * @desc    Stream file from MongoDB GridFS by ID or filename
 * @route   GET /api/files/:id
 * @access  Public
 */
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  await handleFileStream(req.params.id, res);
});

router.get('/payment-slips/:id', async (req: Request, res: Response): Promise<void> => {
  await handleFileStream(req.params.id, res);
});

export default router;
