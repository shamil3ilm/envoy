import RNFS from 'react-native-fs';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { Platform, Share } from 'react-native';

export interface PdfRenderInput {
  title: string;
  body: string;
  pageColor?: string;
}

/**
 * Renders a document to a US Letter PDF using pdf-lib's built-in Helvetica.
 * Deliberately dead simple — no CSS, no HTML parsing, no rich text. Envoy
 * documents are plain-text with placeholders today; keep the renderer
 * matching that reality until we ship a rich editor.
 */
export async function renderDocumentToPdfBase64(input: PdfRenderInput): Promise<string> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 612; // US Letter
  const pageHeight = 792;
  const margin = 54;
  const usableWidth = pageWidth - margin * 2;
  const titleSize = 20;
  const bodySize = 12;
  const bodyLineHeight = 16;

  const background = parsePageColor(input.pageColor);

  let page = pdf.addPage([pageWidth, pageHeight]);
  if (background) {
    page.drawRectangle({
      x: 0,
      y: 0,
      width: pageWidth,
      height: pageHeight,
      color: background,
    });
  }

  let cursorY = pageHeight - margin;

  if (input.title.trim()) {
    const titleLines = wrapLines(input.title.trim(), boldFont, titleSize, usableWidth);
    for (const line of titleLines) {
      if (cursorY < margin + titleSize) {
        page = pdf.addPage([pageWidth, pageHeight]);
        if (background) {
          page.drawRectangle({
            x: 0,
            y: 0,
            width: pageWidth,
            height: pageHeight,
            color: background,
          });
        }
        cursorY = pageHeight - margin;
      }
      page.drawText(line, {
        x: margin,
        y: cursorY - titleSize,
        size: titleSize,
        font: boldFont,
        color: rgb(0.07, 0.09, 0.15),
      });
      cursorY -= titleSize + 4;
    }
    cursorY -= 12;
  }

  const paragraphs = input.body.split(/\n\n+/);
  for (const paragraph of paragraphs) {
    const inputLines = paragraph.split(/\r?\n/);
    for (const rawLine of inputLines) {
      const lines = wrapLines(rawLine, font, bodySize, usableWidth);
      for (const line of lines.length > 0 ? lines : ['']) {
        if (cursorY < margin + bodyLineHeight) {
          page = pdf.addPage([pageWidth, pageHeight]);
          if (background) {
            page.drawRectangle({
              x: 0,
              y: 0,
              width: pageWidth,
              height: pageHeight,
              color: background,
            });
          }
          cursorY = pageHeight - margin;
        }
        page.drawText(line, {
          x: margin,
          y: cursorY - bodySize,
          size: bodySize,
          font,
          color: rgb(0.1, 0.1, 0.1),
        });
        cursorY -= bodyLineHeight;
      }
    }
    cursorY -= 6; // extra gap between paragraphs
  }

  return pdf.saveAsBase64({ dataUri: false });
}

/**
 * Writes a base64 PDF payload to the app's temporary directory and hands
 * it off via RN's Share sheet. Returns the local path so the caller can
 * surface it in a toast.
 */
export async function savePdfAndShare(base64: string, filename: string): Promise<string> {
  const safeName = filename
    .replace(/[^\w\-\. ]+/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 80);
  const finalName = safeName.endsWith('.pdf') ? safeName : `${safeName}.pdf`;
  const path = `${RNFS.CachesDirectoryPath}/${finalName}`;
  await RNFS.writeFile(path, base64, 'base64');

  const url = Platform.OS === 'android' ? `file://${path}` : path;
  try {
    await Share.share({ url, title: finalName } as any);
  } catch (err) {
    // Non-fatal — the file is written; caller can point the user at the path.
    console.warn('Share sheet failed', err);
  }
  return path;
}

// Greedy word wrap: fits characters onto lines by measuring width with the
// specific font+size, splitting on whitespace when the next word won't fit.
// Falls back to a hard character break when a single word exceeds the line.
function wrapLines(
  text: string,
  font: import('pdf-lib').PDFFont,
  size: number,
  maxWidth: number
): string[] {
  if (!text) return [];
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    const width = font.widthOfTextAtSize(candidate, size);
    if (width <= maxWidth) {
      current = candidate;
      continue;
    }
    if (current) {
      lines.push(current);
      current = '';
    }
    if (font.widthOfTextAtSize(word, size) <= maxWidth) {
      current = word;
    } else {
      // Word too long even alone — hard break by character.
      let acc = '';
      for (const ch of word) {
        const next = acc + ch;
        if (font.widthOfTextAtSize(next, size) > maxWidth) {
          if (acc) lines.push(acc);
          acc = ch;
        } else {
          acc = next;
        }
      }
      if (acc) current = acc;
    }
  }
  if (current) lines.push(current);
  return lines;
}

const HEX_COLOR = /^#([0-9a-fA-F]{6})$/;

function parsePageColor(color?: string): ReturnType<typeof rgb> | null {
  if (!color) return null;
  const match = HEX_COLOR.exec(color);
  if (!match) return null;
  const hex = match[1];
  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;
  // Skip the fill if it's essentially white — no need to burn ink.
  if (r > 0.98 && g > 0.98 && b > 0.98) return null;
  return rgb(r, g, b);
}
