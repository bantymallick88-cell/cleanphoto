// Exif Parser, Threat Assessor, and Categorizer
import ExifReader from 'exifreader';

export interface GpsLocationInfo {
  hasGps: boolean;
  latitude: number | null;
  longitude: number | null;
  latitudeRef?: string;
  longitudeRef?: string;
  altitude?: string;
  dmsLat?: string;
  dmsLng?: string;
  googleMapsUrl?: string;
  osmUrl?: string;
  riskWarning?: string;
}

export interface HardwareInfo {
  make?: string;
  model?: string;
  lensModel?: string;
  software?: string;
  serialNumber?: string;
  lensSerialNumber?: string;
  hostComputer?: string;
}

export interface ExposureInfo {
  iso?: string;
  fNumber?: string;
  shutterSpeed?: string;
  focalLength?: string;
  dateTimeOriginal?: string;
  dateTimeDigitized?: string;
  modifyDate?: string;
  flash?: string;
  whiteBalance?: string;
  colorSpace?: string;
  dimensions?: string;
}

export interface ThreatAnalysis {
  score: number; // 0 - 100
  level: 'CRITICAL' | 'MEDIUM' | 'SAFE';
  badgeTitle: string;
  badgeClass: string;
  badgeGlow: string;
  reasons: string[];
}

export interface RawTagItem {
  tag: string;
  id?: number | string;
  value: string;
  section?: string;
}

export interface ImageMetadataInspection {
  totalTagsCount: number;
  gps: GpsLocationInfo;
  hardware: HardwareInfo;
  exposure: ExposureInfo;
  threat: ThreatAnalysis;
  rawTags: RawTagItem[];
}

function toDms(deg: number, isLat: boolean): string {
  const absolute = Math.abs(deg);
  const degrees = Math.floor(absolute);
  const minutesNotTruncated = (absolute - degrees) * 60;
  const minutes = Math.floor(minutesNotTruncated);
  const seconds = Math.floor((minutesNotTruncated - minutes) * 60 * 100) / 100;
  const direction = deg >= 0 ? (isLat ? 'N' : 'E') : (isLat ? 'S' : 'W');
  return `${degrees}° ${minutes}' ${seconds.toFixed(2)}" ${direction}`;
}

export async function inspectImageFile(fileOrBuffer: File | ArrayBuffer): Promise<ImageMetadataInspection> {
  let tags: Record<string, any> = {};
  
  try {
    if (fileOrBuffer instanceof File) {
      const buffer = await fileOrBuffer.arrayBuffer();
      tags = ExifReader.load(buffer, { expanded: true }) as any;
    } else {
      tags = ExifReader.load(fileOrBuffer, { expanded: true }) as any;
    }
  } catch (e) {
    console.warn("No EXIF metadata or failed to read header:", e);
    tags = {};
  }

  // Handle flat or expanded ExifReader structures
  const flatTags: Record<string, any> = {};
  if (tags && typeof tags === 'object') {
    if (tags.exif || tags.gps || tags.xmp || tags.iptc || tags.file) {
      // Expanded mode
      Object.assign(flatTags, tags.exif || {}, tags.gps || {}, tags.xmp || {}, tags.iptc || {}, tags.file || {});
    } else {
      Object.assign(flatTags, tags);
    }
  }

  const tagKeys = Object.keys(flatTags);
  const rawTags: RawTagItem[] = [];

  for (const key of tagKeys) {
    const item = flatTags[key];
    if (item && item.description !== undefined) {
      rawTags.push({
        tag: key,
        id: item.id,
        value: String(item.description),
        section: item.section || 'General'
      });
    }
  }

  // 1. GPS Information
  let lat: number | null = null;
  let lng: number | null = null;
  let latRef = flatTags['GPSLatitudeRef']?.description || 'N';
  let lngRef = flatTags['GPSLongitudeRef']?.description || 'W';

  if (flatTags['GPSLatitude'] && flatTags['GPSLongitude']) {
    const latDesc = flatTags['GPSLatitude'].description;
    const lngDesc = flatTags['GPSLongitude'].description;
    
    if (typeof latDesc === 'number' && !isNaN(latDesc)) {
      lat = latDesc;
    } else if (typeof latDesc === 'string') {
      const parsed = parseFloat(latDesc);
      if (!isNaN(parsed)) lat = parsed;
    }

    if (typeof lngDesc === 'number' && !isNaN(lngDesc)) {
      lng = lngDesc;
    } else if (typeof lngDesc === 'string') {
      const parsed = parseFloat(lngDesc);
      if (!isNaN(parsed)) lng = parsed;
    }

    // Apply ref sign if needed
    if (lat !== null && (latRef === 'S' || latRef === 'South') && lat > 0) lat = -lat;
    if (lng !== null && (lngRef === 'W' || lngRef === 'West') && lng > 0) lng = -lng;
  }

  const hasGps = lat !== null && lng !== null;
  const gps: GpsLocationInfo = {
    hasGps,
    latitude: lat,
    longitude: lng,
    latitudeRef: latRef,
    longitudeRef: lngRef,
    altitude: flatTags['GPSAltitude']?.description,
    dmsLat: lat !== null ? toDms(lat, true) : undefined,
    dmsLng: lng !== null ? toDms(lng, false) : undefined,
    googleMapsUrl: hasGps ? `https://www.google.com/maps?q=${lat},${lng}` : undefined,
    osmUrl: hasGps ? `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}` : undefined,
    riskWarning: hasGps ? "Coordinates pinpoint exact location within ~3-5 meters! High physical security hazard." : undefined
  };

  // 2. Hardware Information
  const hardware: HardwareInfo = {
    make: flatTags['Make']?.description,
    model: flatTags['Model']?.description,
    lensModel: flatTags['LensModel']?.description || flatTags['Lens']?.description,
    software: flatTags['Software']?.description || flatTags['ProcessingSoftware']?.description,
    serialNumber: flatTags['BodySerialNumber']?.description || flatTags['SerialNumber']?.description || flatTags['InternalSerialNumber']?.description,
    lensSerialNumber: flatTags['LensSerialNumber']?.description,
    hostComputer: flatTags['HostComputer']?.description,
  };

  // 3. Exposure Information
  const exposure: ExposureInfo = {
    iso: flatTags['ISOSpeedRatings']?.description || flatTags['ISO']?.description,
    fNumber: flatTags['FNumber']?.description,
    shutterSpeed: flatTags['ExposureTime']?.description || flatTags['ShutterSpeedValue']?.description,
    focalLength: flatTags['FocalLength']?.description,
    dateTimeOriginal: flatTags['DateTimeOriginal']?.description || flatTags['DateTime']?.description,
    dateTimeDigitized: flatTags['DateTimeDigitized']?.description,
    modifyDate: flatTags['ModifyDate']?.description,
    flash: flatTags['Flash']?.description,
    whiteBalance: flatTags['WhiteBalance']?.description,
    colorSpace: flatTags['ColorSpace']?.description,
    dimensions: (flatTags['Image Width']?.description && flatTags['Image Height']?.description)
      ? `${flatTags['Image Width'].description} × ${flatTags['Image Height'].description} px`
      : undefined
  };

  // 4. Dynamic Privacy Threat Score Engine
  const hasHardwareSpecs = Boolean(hardware.make || hardware.model || hardware.serialNumber || hardware.lensModel);
  const hasTimestamps = Boolean(exposure.dateTimeOriginal || exposure.dateTimeDigitized);
  const hasActualLeaks = hasGps || hasHardwareSpecs || hasTimestamps;

  let score = 0;
  const reasons: string[] = [];

  if (hasActualLeaks) {
    if (hasGps) {
      score += 55;
      reasons.push("Embedded GPS Coordinates (Physical Location Leak)");
    }
    if (hardware.serialNumber) {
      score += 25;
      reasons.push(`Device Serial ID Tag (${hardware.serialNumber})`);
    }
    if (hardware.model || hardware.make) {
      score += 20;
      reasons.push(`Hardware Device Signature: ${hardware.make || ''} ${hardware.model || ''}`.trim());
    }
    if (hasTimestamps) {
      score += 15;
      reasons.push(`Creation Timestamp (${exposure.dateTimeOriginal || exposure.dateTimeDigitized})`);
    }
    // Guaranteed > 50/100 if actual leaks are present
    score = Math.max(65, Math.min(100, score));
  } else {
    // If GPS coordinates, device serials, and timestamps are ALL "None/Empty", set Risk Score = 0/100
    score = 0;
  }

  let level: 'CRITICAL' | 'MEDIUM' | 'SAFE' = 'SAFE';
  let badgeTitle = "🟢 SAFE PHOTO: Zero EXIF / GPS Tags Found";
  let badgeClass = "bg-emerald-950/40 border-emerald-500/30 text-emerald-300";
  let badgeGlow = "shadow-[0_0_15px_rgba(16,185,129,0.2)]";

  if (hasActualLeaks) {
    level = 'CRITICAL';
    badgeTitle = "🔴 HIGH PRIVACY LEAK: GPS / Device Info Detected";
    badgeClass = "bg-rose-950/80 border-rose-500/70 text-rose-200";
    badgeGlow = "shadow-[0_0_25px_rgba(244,63,94,0.6)]";
  }

  return {
    totalTagsCount: rawTags.length,
    gps,
    hardware,
    exposure,
    threat: {
      score,
      level,
      badgeTitle,
      badgeClass,
      badgeGlow,
      reasons
    },
    rawTags
  };
}

