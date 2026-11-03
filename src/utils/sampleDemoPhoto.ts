// Utility to generate a realistic demo JPEG with embedded EXIF (GPS, Hardware, Exposure, Serial)

export function generateSampleDemoJpeg(): Uint8Array {
  const tiff: number[] = [];
  const p16 = (v: number) => tiff.push(v & 0xff, (v >> 8) & 0xff);
  const p32 = (v: number) => tiff.push(v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >> 24) & 0xff);

  p16(0x4949); // II (little endian)
  p16(0x002a); // 42
  p32(8);      // IFD0 offset

  const strMake = "Apple\0";
  const strModel = "iPhone 15 Pro Max\0";
  const strSoftware = "iOS 18.2 (22C152)\0";
  const strDate = "2026:10:14 15:32:18\0";
  const strLens = "iPhone 15 Pro Max back triple camera 6.86mm f/1.78\0";
  const strSerial = "DN6L4980P0K5\0";

  let dataOffset = 256;

  function storeData(bytes: number[]) {
    const off = dataOffset;
    dataOffset += bytes.length;
    if (dataOffset % 2 !== 0) dataOffset++;
    return { offset: off, data: bytes };
  }

  function strBytes(s: string) {
    const arr: number[] = [];
    for (let i = 0; i < s.length; i++) arr.push(s.charCodeAt(i));
    return arr;
  }

  const dMake = storeData(strBytes(strMake));
  const dModel = storeData(strBytes(strModel));
  const dSoftware = storeData(strBytes(strSoftware));
  const dDate = storeData(strBytes(strDate));
  const dLens = storeData(strBytes(strLens));
  const dSerial = storeData(strBytes(strSerial));

  // GPS Coordinates: 37° 46' 29.80" N, 122° 25' 9.84" W (San Francisco, CA)
  const dLat = storeData([
    37, 0, 0, 0, 1, 0, 0, 0,
    46, 0, 0, 0, 1, 0, 0, 0,
    164, 11, 0, 0, 100, 0, 0, 0
  ]);
  const dLong = storeData([
    122, 0, 0, 0, 1, 0, 0, 0,
    25, 0, 0, 0, 1, 0, 0, 0,
    216, 3, 0, 0, 100, 0, 0, 0
  ]);
  const dAlt = storeData([15, 0, 0, 0, 1, 0, 0, 0]);

  // Exposure info
  const dExpTime = storeData([1, 0, 0, 0, 120, 0, 0, 0]); // 1/120s
  const dFNum = storeData([178, 0, 0, 0, 100, 0, 0, 0]);    // f/1.78
  const dFocal = storeData([174, 2, 0, 0, 100, 0, 0, 0]);   // 6.86mm

  const buf = new Uint8Array(dataOffset + 128);
  const view = new DataView(buf.buffer);

  // TIFF Header
  view.setUint16(0, 0x4949, true);
  view.setUint16(2, 0x002a, true);
  view.setUint32(4, 8, true);

  // IFD0 (offset 8)
  let p = 8;
  view.setUint16(p, 6, true); p += 2;
  // Make
  view.setUint16(p, 0x010F, true); view.setUint16(p+2, 2, true); view.setUint32(p+4, strMake.length, true); view.setUint32(p+8, dMake.offset, true); p += 12;
  // Model
  view.setUint16(p, 0x0110, true); view.setUint16(p+2, 2, true); view.setUint32(p+4, strModel.length, true); view.setUint32(p+8, dModel.offset, true); p += 12;
  // Software
  view.setUint16(p, 0x0131, true); view.setUint16(p+2, 2, true); view.setUint32(p+4, strSoftware.length, true); view.setUint32(p+8, dSoftware.offset, true); p += 12;
  // DateTime
  view.setUint16(p, 0x0132, true); view.setUint16(p+2, 2, true); view.setUint32(p+4, strDate.length, true); view.setUint32(p+8, dDate.offset, true); p += 12;
  // ExifIFD
  view.setUint16(p, 0x8769, true); view.setUint16(p+2, 4, true); view.setUint32(p+4, 1, true); view.setUint32(p+8, 86, true); p += 12;
  // GPSIFD (at 164)
  view.setUint16(p, 0x8825, true); view.setUint16(p+2, 4, true); view.setUint32(p+4, 1, true); view.setUint32(p+8, 164, true); p += 12;
  view.setUint32(p, 0, true); p += 4; // p = 86

  // ExifIFD (offset 86)
  view.setUint16(p, 6, true); p += 2;
  // ExposureTime
  view.setUint16(p, 0x829A, true); view.setUint16(p+2, 5, true); view.setUint32(p+4, 1, true); view.setUint32(p+8, dExpTime.offset, true); p += 12;
  // FNumber
  view.setUint16(p, 0x829D, true); view.setUint16(p+2, 5, true); view.setUint32(p+4, 1, true); view.setUint32(p+8, dFNum.offset, true); p += 12;
  // ISO
  view.setUint16(p, 0x8827, true); view.setUint16(p+2, 3, true); view.setUint32(p+4, 1, true); view.setUint16(p+8, 64, true); p += 12;
  // DateTimeOriginal
  view.setUint16(p, 0x9003, true); view.setUint16(p+2, 2, true); view.setUint32(p+4, strDate.length, true); view.setUint32(p+8, dDate.offset, true); p += 12;
  // LensModel
  view.setUint16(p, 0xA434, true); view.setUint16(p+2, 2, true); view.setUint32(p+4, strLens.length, true); view.setUint32(p+8, dLens.offset, true); p += 12;
  // BodySerialNumber
  view.setUint16(p, 0xA431, true); view.setUint16(p+2, 2, true); view.setUint32(p+4, strSerial.length, true); view.setUint32(p+8, dSerial.offset, true); p += 12;
  view.setUint32(p, 0, true);

  // GPSIFD (offset 164)
  p = 164;
  view.setUint16(p, 5, true); p += 2;
  // GPSVersionID
  view.setUint16(p, 0x0000, true); view.setUint16(p+2, 1, true); view.setUint32(p+4, 4, true);
  buf[p+8] = 2; buf[p+9] = 3; buf[p+10] = 0; buf[p+11] = 0; p += 12;
  // GPSLatitudeRef
  view.setUint16(p, 0x0001, true); view.setUint16(p+2, 2, true); view.setUint32(p+4, 2, true);
  buf[p+8] = 78; buf[p+9] = 0; p += 12;
  // GPSLatitude
  view.setUint16(p, 0x0002, true); view.setUint16(p+2, 5, true); view.setUint32(p+4, 3, true); view.setUint32(p+8, dLat.offset, true); p += 12;
  // GPSLongitudeRef
  view.setUint16(p, 0x0003, true); view.setUint16(p+2, 2, true); view.setUint32(p+4, 2, true);
  buf[p+8] = 87; buf[p+9] = 0; p += 12;
  // GPSLongitude
  view.setUint16(p, 0x0004, true); view.setUint16(p+2, 5, true); view.setUint32(p+4, 3, true); view.setUint32(p+8, dLong.offset, true); p += 12;
  view.setUint32(p, 0, true);

  const allData = [dMake, dModel, dSoftware, dDate, dLens, dSerial, dLat, dLong, dAlt, dExpTime, dFNum, dFocal];
  for (const item of allData) {
    buf.set(item.data, item.offset);
  }

  const tiffSize = dataOffset;
  const app1PayloadLen = 2 + 6 + tiffSize;
  const app1Header = [
    0xFF, 0xE1,
    (app1PayloadLen >> 8) & 0xff, app1PayloadLen & 0xff,
    0x45, 0x78, 0x69, 0x66, 0x00, 0x00
  ];

  // Minimal JPEG image tail
  const minimalJpegRest = [
    0xFF, 0xDB, 0x00, 0x43, 0x00,
    16, 11, 10, 16, 24, 40, 51, 61, 12, 12, 14, 19, 26, 58, 60, 55,
    14, 13, 16, 24, 40, 57, 69, 56, 14, 17, 22, 29, 51, 87, 80, 62,
    18, 22, 37, 56, 68, 109, 103, 77, 24, 35, 55, 64, 81, 104, 113, 92,
    49, 64, 78, 87, 103, 121, 120, 101, 72, 92, 95, 98, 112, 100, 103, 99,
    0xFF, 0xC0, 0x00, 0x0B, 0x08, 0x00, 0x01, 0x00, 0x01, 0x01, 0x01, 0x11, 0x00,
    0xFF, 0xC4, 0x00, 0x1F, 0x00, 0x00, 0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0A, 0x0B,
    0xFF, 0xDA, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3F, 0x00,
    0xBF, 0x00,
    0xFF, 0xD9
  ];

  const totalLen = 2 + app1Header.length + tiffSize + minimalJpegRest.length;
  const fullJpeg = new Uint8Array(totalLen);
  let cur = 0;
  fullJpeg[cur++] = 0xFF; fullJpeg[cur++] = 0xD8;
  fullJpeg.set(app1Header, cur); cur += app1Header.length;
  fullJpeg.set(buf.subarray(0, tiffSize), cur); cur += tiffSize;
  fullJpeg.set(minimalJpegRest, cur);

  return fullJpeg;
}

export function createDemoPhotoFile(): File {
  const bytes = generateSampleDemoJpeg();
  return new File([bytes.buffer as ArrayBuffer], "sample_iphone15_gps_leak.jpg", {
    type: "image/jpeg",
    lastModified: 1728919938000
  });
}

