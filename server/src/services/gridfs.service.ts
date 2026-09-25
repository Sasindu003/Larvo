import mongoose from 'mongoose';
import { Readable } from 'stream';

let bucket: mongoose.mongo.GridFSBucket | null = null;
let currentDb: any = null;

export const getGridFSBucket = (): mongoose.mongo.GridFSBucket => {
  if (!mongoose.connection.db) {
    throw new Error('Database connection not established for GridFS');
  }
  if (!bucket || currentDb !== mongoose.connection.db) {
    currentDb = mongoose.connection.db;
    bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
      bucketName: 'uploads',
    });
  }
  return bucket;
};

export interface GridFSUploadResult {
  fileId: string;
  filename: string;
  url: string;
}

/**
 * Streams an in-memory buffer into MongoDB GridFS.
 */
export const uploadToGridFS = async (
  buffer: Buffer,
  filename: string,
  contentType: string,
  metadata?: Record<string, any>
): Promise<GridFSUploadResult> => {
  const currentBucket = getGridFSBucket();
  const readable = Readable.from(buffer);
  const uploadStream = currentBucket.openUploadStream(filename, {
    contentType,
    metadata,
  });

  return new Promise((resolve, reject) => {
    readable
      .pipe(uploadStream)
      .on('error', reject)
      .on('finish', () => {
        const fileId = uploadStream.id.toString();
        resolve({
          fileId,
          filename,
          url: `/api/files/${fileId}`,
        });
      });
  });
};

/**
 * Retrieves a file stream and metadata from GridFS by ObjectId or filename.
 */
export const getFileFromGridFS = async (
  fileIdOrFilename: string
): Promise<{ stream: NodeJS.ReadableStream; contentType: string; filename: string } | null> => {
  const currentBucket = getGridFSBucket();
  let file: any = null;

  if (mongoose.Types.ObjectId.isValid(fileIdOrFilename)) {
    const files = await currentBucket
      .find({ _id: new mongoose.Types.ObjectId(fileIdOrFilename) })
      .toArray();
    if (files.length > 0) file = files[0];
  }

  if (!file) {
    const files = await currentBucket
      .find({ filename: fileIdOrFilename })
      .sort({ uploadDate: -1 })
      .toArray();
    if (files.length > 0) file = files[0];
  }

  if (!file) return null;

  const stream = currentBucket.openDownloadStream(file._id);
  return {
    stream,
    contentType: file.contentType || 'application/octet-stream',
    filename: file.filename || 'file',
  };
};
