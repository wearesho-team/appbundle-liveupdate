import archiver from 'archiver';

export const zipFolder = async (sourceFolder: string) => {
  return new Promise((resolve, reject) => {
    const archive: archiver.Archiver = archiver('zip', { zlib: { level: 9 } });
    const buffers: any[] = [];

    archive.on('data', (data) => buffers.push(data));
    archive.on('error', (err) => reject(err));
    archive.on('end', () => resolve(Buffer.concat(buffers)));

    archive.directory(sourceFolder, '', {});

    archive.finalize();
  });
};

export const isZipped = (path: string) => {
  return path.endsWith('.zip');
}
