// HEIC/HEIF Conversion Helper for cross-browser decoding

export function isHeicFile(file: File | Blob, filename?: string): boolean {
  const type = file.type?.toLowerCase() || '';
  const name = filename || (file instanceof File ? file.name : '') || '';
  return (
    type === 'image/heic' ||
    type === 'image/heif' ||
    type === 'image/heic-sequence' ||
    type === 'image/heif-sequence' ||
    name.toLowerCase().endsWith('.heic') ||
    name.toLowerCase().endsWith('.heif')
  );
}

export async function convertHeicToJpegBlob(file: File | Blob): Promise<Blob> {
  try {
    // Dynamic import to keep SSR safe
    const heic2anyModule = await import('heic2any');
    const heic2any = heic2anyModule.default || heic2anyModule;
    
    const converted = await heic2any({
      blob: file,
      toType: 'image/jpeg',
      quality: 0.95
    });

    if (Array.isArray(converted)) {
      return converted[0];
    }
    return converted as Blob;
  } catch (error) {
    console.warn("heic2any conversion fallback warning:", error);
    // If conversion fails, return original file so browser can attempt native decode
    return file;
  }
}

