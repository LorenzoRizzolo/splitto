import QRCode from 'qrcode';

/** QR code as an inline SVG string (generated server-side, no external service). */
export function qrSvg(text: string): Promise<string> {
	return QRCode.toString(text, {
		type: 'svg',
		margin: 1,
		errorCorrectionLevel: 'M',
		color: { dark: '#0f1f1c', light: '#ffffff' }
	});
}
