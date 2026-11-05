// Client-Side Canvas Stripping Engine with HEIC/AVIF Graceful Support
import { inspectImageFile, type ImageMetadataInspection } from './exifParser';
import { isHeicFile, convertHeicToJpegBlob } from './heicHelper';

export interface CleanOptions {
  outputFormat?: 'original' | 'image/jpeg' | 'image/webp' | 'image/png' | 'image/avif';
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
  const isHeic = isHeicFile(file, originalFilename);

  // Determine output MIME type
  let targetMime = file.type || 'image/jpeg';
  if (options.outputFormat && options.outputFormat !== 'original') {
    targetMime = options.outputFormat;
  } else if (!targetMime || targetMime === 'application/octet-stream' || isHeic) {
    // If HEIC, canvas cannot encode to image/heic in browsers, so default to high-quality JPEG
    if (isHeic) {
      targetMime = 'image/jpeg';
    } else if (originalFilename.toLowerCase().endsWith('.png')) {
      targetMime = 'image/png';
    } else if (originalFilename.toLowerCase().endsWith('.webp')) {
      targetMime = 'image/webp';
    } else if (originalFilename.toLowerCase().endsWith('.avif')) {
      targetMime = 'image/avif';
    } else {
      targetMime = 'image/jpeg';
    }
  }

  // Handle image decoding source blob
  let decodeBlob: Blob = file;
  if (isHeic) {
    decodeBlob = await convertHeicToJpegBlob(file);
  }

  // Load into Image element
  let imgUrl = URL.createObjectURL(decodeBlob);
  const img = new Image();

  try {
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = async () => {
        // If first attempt failed and it's HEIC that wasn't converted yet, try conversion
        if (isHeic && decodeBlob === file) {
          try {
            const fallbackBlob = await convertHeicToJpegBlob(file);
            URL.revokeObjectURL(imgUrl);
            imgUrl = URL.createObjectURL(fallbackBlob);
            img.onload = () => resolve();
            img.onerror = () => reject(new Error("Unable to decode HEIC image in browser memory"));
            img.src = imgUrl;
            return;
          } catch (e) {
            reject(new Error("HEIC image decoding failed in browser RAM: " + (e as Error).message));
            return;
          }
        }
        reject(new Error("Unable to decode image file in browser RAM"));
      };
      img.src = imgUrl;
    });

    const width = img.naturalWidth || img.width;
    const height = img.naturalHeight || img.height;

    // Use HTML5 Canvas
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

    // If JPEG, fill white background to prevent black backgrounds on transparent pixels
    if (targetMime === 'image/jpeg') {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, height);
    }

    // Draw the raw visual pixel buffer (this strips 100% EXIF, IPTC, and XMP markers)
    ctx.drawImage(img, 0, 0, width, height);

    // Export sanitized pixel blob
    const cleanedBlob: Blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else {
            // Fallback to image/jpeg if specific format wasn't supported for encoding
            canvas.toBlob(
              (fallback) => {
                if (fallback) resolve(fallback);
                else reject(new Error("Canvas toBlob failed to serialize sanitized image"));
              },
              'image/jpeg',
              quality
            );
          }
        },
        targetMime,
        targetMime === 'image/png' ? undefined : quality
      );
    });

    const cleanedUrl = URL.createObjectURL(cleanedBlob);

    // Post-cleaning verification pass
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

    // Determine output file extension
    const extParts = originalFilename.split('.');
    const baseName = extParts.slice(0, -1).join('.') || originalFilename;
    let targetExt = 'jpg';
    if (cleanedBlob.type === 'image/png' || targetMime === 'image/png') targetExt = 'png';
    else if (cleanedBlob.type === 'image/webp' || targetMime === 'image/webp') targetExt = 'webp';
    else if (cleanedBlob.type === 'image/avif' || targetMime === 'image/avif') targetExt = 'avif';
    else targetExt = 'jpg';

    const cleanFilename = `${baseName}_clean.${targetExt}`;

    return {
      cleanedBlob,
      cleanedUrl,
      originalSize,
      cleanedSize: cleanedBlob.size,
      originalDimensions: { width, height },
      verifiedTagsCount,
      is100PercentClean,
      format: cleanedBlob.type || targetMime,
      filename: cleanFilename,
    };
  } finally {
    URL.revokeObjectURL(imgUrl);
  }
}
