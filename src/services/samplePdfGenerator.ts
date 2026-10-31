import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

/**
 * Generates a realistic 3-page vector PDF ("Quarterly Service Agreement & Invoice")
 * using `pdf-lib` so users can immediately test multi-page rendering, existing text
 * extraction & replacement, English & Bengali overlay text, images/signatures,
 * page management, and PDF export.
 */
export async function generateMultiPageSamplePdf(): Promise<{
  name: string;
  bytes: Uint8Array;
}> {
  const doc = await PDFDocument.create();
  const helvetica = await doc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const timesItalic = await doc.embedFont(StandardFonts.TimesRomanItalic);

  // --- PAGE 1: Cover & Executive Summary ---
  const p1 = doc.addPage([595.28, 841.89]);
  p1.drawRectangle({
    x: 0,
    y: 760,
    width: 595.28,
    height: 81.89,
    color: rgb(0.06, 0.09, 0.16),
  });
  p1.drawText('NORTHSTAR ENGINEERING GROUP', {
    x: 48,
    y: 804,
    size: 15,
    font: helveticaBold,
    color: rgb(1, 1, 1),
  });
  p1.drawText('Document Ref: NS-2026-0842  |  Date: October 31, 2026', {
    x: 48,
    y: 782,
    size: 10,
    font: helvetica,
    color: rgb(0.75, 0.82, 0.92),
  });

  p1.drawText('Master Consulting & Delivery Proposal', {
    x: 48,
    y: 705,
    size: 22,
    font: helveticaBold,
    color: rgb(0.06, 0.09, 0.16),
  });
  p1.drawText('Prepared for: Meridian Global Logistics Ltd.', {
    x: 48,
    y: 678,
    size: 13,
    font: helvetica,
    color: rgb(0.28, 0.33, 0.41),
  });

  p1.drawLine({
    start: { x: 48, y: 660 },
    end: { x: 547, y: 660 },
    thickness: 1,
    color: rgb(0.85, 0.88, 0.92),
  });

  p1.drawText('1. Executive Summary', {
    x: 48,
    y: 626,
    size: 14,
    font: helveticaBold,
    color: rgb(0.08, 0.12, 0.2),
  });

  const p1Lines = [
    'This agreement outlines the architecture, deployment milestones, and quality assurance',
    'deliverables for the Regional Supply Chain Portal. All deliverables remain strictly',
    'confidential and are scheduled for completion across three phased sprints.',
    '',
    'Project Lead: Clara Vance, Principal Systems Architect',
    'Estimated Completion Date: December 18, 2026',
    'Contract Valuation: USD 48,500.00',
  ];

  p1Lines.forEach((line, idx) => {
    if (!line) return;
    p1.drawText(line, {
      x: 48,
      y: 598 - idx * 20,
      size: 11,
      font: idx >= 4 ? helveticaBold : helvetica,
      color: rgb(0.15, 0.2, 0.28),
    });
  });

  p1.drawRectangle({
    x: 48,
    y: 350,
    width: 499,
    height: 78,
    color: rgb(0.96, 0.97, 0.99),
    borderColor: rgb(0.82, 0.86, 0.92),
    borderWidth: 1,
  });
  p1.drawText('Key Scope Highlight', {
    x: 64,
    y: 404,
    size: 11,
    font: helveticaBold,
    color: rgb(0.12, 0.25, 0.55),
  });
  p1.drawText('Click any text line in Edit PDF Text mode to replace existing text directly on this page.', {
    x: 64,
    y: 382,
    size: 10.5,
    font: helvetica,
    color: rgb(0.22, 0.27, 0.35),
  });
  p1.drawText('Multilingual notes (English & Bengali) and signatures can be added anywhere.', {
    x: 64,
    y: 364,
    size: 10.5,
    font: timesItalic,
    color: rgb(0.3, 0.35, 0.44),
  });

  p1.drawText('Page 1 of 3', {
    x: 492,
    y: 36,
    size: 9.5,
    font: helvetica,
    color: rgb(0.45, 0.5, 0.58),
  });

  // --- PAGE 2: Milestone & Cost Schedule ---
  const p2 = doc.addPage([595.28, 841.89]);
  p2.drawText('2. Milestone & Fee Schedule', {
    x: 48,
    y: 780,
    size: 16,
    font: helveticaBold,
    color: rgb(0.06, 0.09, 0.16),
  });

  p2.drawRectangle({
    x: 48,
    y: 730,
    width: 499,
    height: 28,
    color: rgb(0.93, 0.95, 0.98),
  });
  p2.drawText('Phase Deliverable', { x: 60, y: 740, size: 10.5, font: helveticaBold, color: rgb(0.1, 0.14, 0.22) });
  p2.drawText('Target Window', { x: 310, y: 740, size: 10.5, font: helveticaBold, color: rgb(0.1, 0.14, 0.22) });
  p2.drawText('Fee (USD)', { x: 465, y: 740, size: 10.5, font: helveticaBold, color: rgb(0.1, 0.14, 0.22) });

  const rows = [
    ['Phase 1: Core Infrastructure Audit', 'Nov 01 - Nov 14', '$14,000.00'],
    ['Phase 2: Bilingual Portal Integration', 'Nov 15 - Dec 04', '$22,500.00'],
    ['Phase 3: Security Hardening & Handover', 'Dec 05 - Dec 18', '$12,000.00'],
  ];

  rows.forEach((r, idx) => {
    const rowY = 702 - idx * 32;
    p2.drawText(r[0], { x: 60, y: rowY, size: 10.5, font: helvetica, color: rgb(0.18, 0.22, 0.3) });
    p2.drawText(r[1], { x: 310, y: rowY, size: 10.5, font: helvetica, color: rgb(0.18, 0.22, 0.3) });
    p2.drawText(r[2], { x: 465, y: rowY, size: 10.5, font: helveticaBold, color: rgb(0.1, 0.14, 0.22) });
    p2.drawLine({
      start: { x: 48, y: rowY - 10 },
      end: { x: 547, y: rowY - 10 },
      thickness: 0.6,
      color: rgb(0.88, 0.9, 0.94),
    });
  });

  p2.drawText('Total Authorized Budget: $48,500.00', {
    x: 345,
    y: 590,
    size: 12,
    font: helveticaBold,
    color: rgb(0.08, 0.12, 0.22),
  });

  p2.drawText('Payment Terms: Net 30 days from milestone sign-off.', {
    x: 48,
    y: 540,
    size: 10.5,
    font: helvetica,
    color: rgb(0.28, 0.33, 0.42),
  });

  p2.drawText('Page 2 of 3', {
    x: 492,
    y: 36,
    size: 9.5,
    font: helvetica,
    color: rgb(0.45, 0.5, 0.58),
  });

  // --- PAGE 3: Authorization & Signature Block ---
  const p3 = doc.addPage([595.28, 841.89]);
  p3.drawText('3. Terms of Acceptance & Sign-Off', {
    x: 48,
    y: 780,
    size: 16,
    font: helveticaBold,
    color: rgb(0.06, 0.09, 0.16),
  });
  p3.drawText(
    'By signing below, both parties authorize commencement of the work described in this document.',
    {
      x: 48,
      y: 748,
      size: 11,
      font: helvetica,
      color: rgb(0.2, 0.25, 0.33),
    }
  );

  // Signature boxes
  p3.drawRectangle({
    x: 48,
    y: 570,
    width: 230,
    height: 110,
    borderColor: rgb(0.75, 0.8, 0.86),
    borderWidth: 1,
    color: rgb(0.99, 0.99, 1),
  });
  p3.drawText('Client Representative Signature:', {
    x: 60,
    y: 660,
    size: 10,
    font: helveticaBold,
    color: rgb(0.3, 0.35, 0.43),
  });
  p3.drawLine({
    start: { x: 60, y: 595 },
    end: { x: 262, y: 595 },
    thickness: 0.8,
    color: rgb(0.65, 0.7, 0.78),
  });

  p3.drawRectangle({
    x: 317,
    y: 570,
    width: 230,
    height: 110,
    borderColor: rgb(0.75, 0.8, 0.86),
    borderWidth: 1,
    color: rgb(0.99, 0.99, 1),
  });
  p3.drawText('Consulting Partner Signature:', {
    x: 329,
    y: 660,
    size: 10,
    font: helveticaBold,
    color: rgb(0.3, 0.35, 0.43),
  });
  p3.drawLine({
    start: { x: 329, y: 595 },
    end: { x: 531, y: 595 },
    thickness: 0.8,
    color: rgb(0.65, 0.7, 0.78),
  });

  p3.drawText('Page 3 of 3', {
    x: 492,
    y: 36,
    size: 9.5,
    font: helvetica,
    color: rgb(0.45, 0.5, 0.58),
  });

  const bytes = await doc.save();
  return {
    name: 'Northstar-Consulting-Proposal.pdf',
    bytes,
  };
}

/**
 * Generates a real scanned-image PDF page (containing zero PDF text operators,
 * only an embedded raster scan image) so users can test scanned-document detection
 * and Tesseract.js OCR recognition end-to-end.
 */
export async function generateScannedSamplePdf(): Promise<{
  name: string;
  bytes: Uint8Array;
}> {
  const canvas = document.createElement('canvas');
  canvas.width = 1190;
  canvas.height = 1684;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas unavailable for scanned sample generation.');
  }

  // Subtle off-white archival scan paper background
  ctx.fillStyle = '#FCFBF7';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Subtle scan border
  ctx.strokeStyle = '#D6D3C9';
  ctx.lineWidth = 3;
  ctx.strokeRect(64, 64, canvas.width - 128, canvas.height - 128);

  ctx.fillStyle = '#111827';
  ctx.font = 'bold 42px Arial, sans-serif';
  ctx.fillText('ARCHIVAL DISPATCH NOTICE', 120, 190);

  ctx.font = '28px Arial, sans-serif';
  ctx.fillStyle = '#1F2937';
  ctx.fillText('Reference Code: SCAN-2026-991', 120, 265);
  ctx.fillText('Issued By: Central Records Office', 120, 315);

  ctx.fillText('This page was captured from a flat-bed optical scanner.', 120, 415);
  ctx.fillText('Run OCR from the banner above to convert this raster image', 120, 465);
  ctx.fillText('into editable and exportable text regions.', 120, 515);

  ctx.font = '32px "Noto Sans Bengali", sans-serif';
  ctx.fillText('বাংলা নথি স্ক্যান পরীক্ষা ২০২৬', 120, 620);

  const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.9);
  const base64 = jpegDataUrl.split(',')[1];
  const binary = atob(base64);
  const jpgBytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    jpgBytes[i] = binary.charCodeAt(i);
  }

  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]);
  const jpgImg = await doc.embedJpg(jpgBytes);
  page.drawImage(jpgImg, {
    x: 0,
    y: 0,
    width: 595.28,
    height: 841.89,
  });

  const bytes = await doc.save();
  return {
    name: 'Scanned-Archival-Notice-OCR.pdf',
    bytes,
  };
}
