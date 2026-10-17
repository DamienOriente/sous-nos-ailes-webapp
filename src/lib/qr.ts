import QRCode from "qrcode";

/** PNG buffer for download routes (partner kit, admin venue page). */
export async function qrCodePng(text: string, size = 512): Promise<Buffer> {
  return QRCode.toBuffer(text, { type: "png", width: size, margin: 2, color: { dark: "#2e4237", light: "#fbf8f3" }, errorCorrectionLevel: "M" });
}

/** Data URL for inline rendering in printable kits. */
export async function qrCodeDataUrl(text: string, size = 320): Promise<string> {
  return QRCode.toDataURL(text, { type: "image/png", width: size, margin: 2, color: { dark: "#2e4237", light: "#fbf8f3" }, errorCorrectionLevel: "M" });
}
