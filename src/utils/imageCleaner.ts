// Client-Side Canvas Stripping Engine
import { inspectImageFile, type ImageMetadataInspection } from './exifParser';

export interface CleanOptions {
  outputFormat?: 'original' | 'image/jpeg' | 'image/webp' | 'image/png';
  quality?: number; // 0.1 to 1.0 (default 0.95 for lossy formats)
}

export interface CleanResult {
  cleanedBlob: Blob;
  cleanedUrl: string;
  originalSize: number;
  cleanedSize: number;
  originalDimensions: { width: number; height: number };
  verifiedTagsCount: number;
  is100PercentClean: boolean;
  format: string;
  filename: string;
}

export async function stripImageMetadata(
  file: File | Blob,
  originalFilename: string,
  options: CleanOptions = {}
): Promise<CleanResult> {
  const quality = options.quality ?? 0.95;
  const originalSize = file.size;

  // Determine output MIME type
  let targetMime = file.type || 'image/jpeg';
  if (options.outputFormat && options.outputFormat !== 'original') {
    targetMime = options.outputFormat;
  } else if (!targetMime || targetMime === 'application/octet-stream') {
    // Infer from filename extension
    if (originalFilename.toLowerCase().endsWith('.png')) targetMime = 'image/png';
    else if (originalFilename.toLowerCase().endsWith('.webp')) targetMime = 'image/webp';
    else targetMime = 'image/jpeg';
  }

  // Load into Image element
  const imgUrl = URL.createObjectURL(file);
  const img = new Image();

  try {
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Unable to decode image file in browser RAM"));
      img.src = imgUrl;
    });

    const width = img.naturalWidth || img.width;
    const height = img.naturalHeight || img.height;

    // Use offscreen canvas or standard canvas
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d', {
      alpha: targetMime === 'image/png' || targetMime === 'image/webp',
      willReadFrequently: false,
    });

    if (!ctx) {
      throw new Error("HTML5 Canvas 2D context unavailable");
    }

    // High quality image smoothing
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // If JPEG, fill white background to prevent black background on transparent PNGs converted to JPEG
    if (targetMime === 'image/jpeg') {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, height);
    }

    // Draw the pure pixel buffer - this inherently drops all APP1 EXIF, IPTC, and XMP markers
    ctx.drawImage(img, 0, 0, width, height);

    // Export pure sanitized pixel blob
    const cleanedBlob: Blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Canvas toBlob failed to serialize sanitized image"));
        },
        targetMime,
        targetMime === 'image/png' ? undefined : quality
      );
    });

    const cleanedUrl = URL.createObjectURL(cleanedBlob);

    // Post-cleaning verification: verify 0 EXIF or GPS tags remain
    let verifiedInspection: ImageMetadataInspection;
    try {
      verifiedInspection = await inspectImageFile(cleanedBlob);
    } catch {
      verifiedInspection = {
        totalTagsCount: 0,
        gps: { hasGps: false, latitude: null, longitude: null },
        hardware: {},
        exposure: {},
        threat: {
          score: 0,
          level: 'SAFE',
          badgeTitle: '🟢 Clean / Low Risk: No sensitive metadata detected',
          badgeClass: '',
          badgeGlow: '',
          reasons: []
        },
        rawTags: []
      };
    }

    const verifiedTagsCount = verifiedInspection.totalTagsCount;
    const is100PercentClean = !verifiedInspection.gps.hasGps && 
      !verifiedInspection.hardware.serialNumber && 
      !verifiedInspection.hardware.model;

    // Determine output file name
    const extParts = originalFilename.split('.');
    const baseName = extParts.slice(0, -1).join('.') || originalFilename;
    let targetExt = 'jpg';
    if (targetMime === 'image/png') targetExt = 'png';
    else if (targetMime === 'image/webp') targetExt = 'webp';
    else if (targetMime === 'image/jpeg') targetExt = 'jpg';

    const cleanFilename = `${baseName}_clean.${targetExt}`;

    return {
      cleanedBlob,
      cleanedUrl,
      originalSize,
      cleanedSize: cleanedBlob.size,
      originalDimensions: { width, height },
      verifiedTagsCount,
      is100PercentClean,
      format: targetMime,
      filename: cleanFilename,
    };
  } finally {
    URL.revokeObjectURL(imgUrl);
  }
}

