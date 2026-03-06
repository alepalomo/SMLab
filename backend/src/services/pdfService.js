const PDFDocument = require('pdfkit');
const archiver = require('archiver');
const path = require('path');
const fs = require('fs');

const ASSETS_PATH = process.env.ASSETS_PATH
  ? path.resolve(process.env.ASSETS_PATH)
  : path.join(__dirname, '../assets');

const HEADER_IMG = path.join(ASSETS_PATH, 'header_spectrummedia.png');
const FIRMA_IMG = path.join(ASSETS_PATH, 'firma.png');

function formatDateEs(d) {
  const meses = ['', 'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const date = new Date(d);
  return `${date.getUTCDate()} de ${meses[date.getUTCMonth() + 1]} de ${date.getUTCFullYear()}`;
}

/**
 * Genera el PDF del Recibo para un host.
 * Devuelve un Buffer con el PDF.
 */
function generateReciboPdf(expense, proveedor, rows) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', margin: 50 });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const receiptId = String(expense.id).padStart(5, '0');
    const pageW = doc.page.width;

    // --- Encabezado ---
    if (fs.existsSync(HEADER_IMG)) {
      doc.image(HEADER_IMG, 0, 0, { width: pageW, height: 90 });
    } else {
      doc.rect(0, 0, pageW, 90).fill('#1a1a2e');
      doc.fontSize(22).fillColor('white').text('SPECTRUM MEDIA LAB', 50, 30);
    }

    // Número de recibo sobre el header
    doc.fontSize(16).fillColor('white').text(`RECIBO #${receiptId}`, 0, 35, { align: 'right' });

    // Fecha y datos del destinatario
    doc.fillColor('black').fontSize(11);
    const yStart = 110;
    const dateStr = new Date(expense.date).toLocaleDateString('es-GT');
    doc.text(`FECHA: ${dateStr}`, 400, yStart);
    doc.text('RECIBO DE: SPECTRUM MEDIA LAB', 50, yStart);
    doc.text(`RECIBO PARA: ${proveedor.name.toUpperCase()}`, 50, yStart + 16);

    // Datos bancarios
    doc.fontSize(10).text(`Banco: ${proveedor.bankName || '—'}`, 50, yStart + 50);
    doc.text(`Nombre: ${proveedor.name}`, 50, yStart + 64);
    doc.text(`Cuenta: ${proveedor.accountNumber || '—'}`, 50, yStart + 78);

    // Tabla de items
    let yTable = yStart + 120;
    doc.fontSize(10).font('Helvetica-Bold');
    doc.text('DESCRIPCION', 50, yTable);
    doc.text('TARIFA', 330, yTable);
    doc.text('DIAS', 410, yTable);
    doc.text('TOTAL', 490, yTable);
    doc.moveTo(50, yTable + 14).lineTo(540, yTable + 14).stroke();

    doc.font('Helvetica');
    let yRow = yTable + 24;
    let totalHost = 0;

    for (const row of rows) {
      const subtotal = (row.rate || 0) * (row.days || 0);
      totalHost += subtotal;
      doc.text(row.desc || '', 50, yRow);
      doc.text(`Q${Number(row.rate).toFixed(2)}`, 330, yRow);
      doc.text(String(row.days || 0), 415, yRow);
      doc.text(`Q${subtotal.toFixed(2)}`, 490, yRow);
      doc.moveTo(50, yRow + 14).lineTo(540, yRow + 14).stroke();
      yRow += 24;
    }

    doc.fontSize(13).font('Helvetica-Bold');
    doc.text('TOTAL PAGADO', 50, yRow + 16);
    doc.text(`Q${totalHost.toFixed(2)}`, 490, yRow + 16);

    // Línea de firma
    const ySign = doc.page.height - 120;
    doc.moveTo(180, ySign).lineTo(400, ySign).stroke();
    doc.fontSize(9).font('Helvetica').text('FIRMA DE CONFORMIDAD', 0, ySign + 6, { align: 'center' });

    doc.end();
  });
}

/**
 * Genera el PDF del Contrato para un host.
 * Devuelve un Buffer con el PDF.
 */
function generateContratoPdf(expense, proveedor, contractDesc, rows) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', margin: 50 });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageW = doc.page.width;
    const totalHost = rows.reduce((s, r) => s + (r.rate || 0) * (r.days || 0), 0);
    const fechaStr = formatDateEs(expense.date);

    // --- Encabezado ---
    if (fs.existsSync(HEADER_IMG)) {
      doc.image(HEADER_IMG, 0, 0, { width: pageW, height: 90 });
    } else {
      doc.rect(0, 0, pageW, 90).fill('#1a1a2e');
      doc.fontSize(22).fillColor('white').text('SPECTRUM MEDIA LAB', 50, 30);
    }

    // Asunto y fecha (alineado a la derecha)
    doc.fillColor('black').fontSize(10);
    const yAfterHeader = 110;
    doc.font('Helvetica-Bold').text('Asunto: Brand Activation Ambassador', 50, yAfterHeader, { align: 'right', width: pageW - 100 });
    doc.font('Helvetica').text(`En la fecha: ${fechaStr}.`, 50, yAfterHeader + 16, { align: 'right', width: pageW - 100 });

    // Cuerpo del contrato
    const opts = { align: 'justify', width: pageW - 100 };
    let yCurrent = yAfterHeader + 60;

    const cui = proveedor.cui || 'N/A';
    const paragraphs = [
      `Yo, ${proveedor.name} me identifico con el Documento Personal de Identificación (DPI) con Código Único de Identificación (CUI) No. ${cui}, por medio de la presente acuerdo prestar servicios como BRAND ACTIVATION AMBASSADOR - ${(contractDesc || '').toUpperCase()} para SPECTRUM MEDIA prestando un servicio y realizando actividades relacionadas con promoción de producto, eventos o generación de contenido, según lo asignado.`,
      `Como compensación por estos servicios, se entregará un pago único de Q.${totalHost.toFixed(2)}, el día y lugar que me ha sido notificado previamente.`,
      `En consecuencia, ambas partes reconocen expresamente que:\n• No existe entre ellas relación laboral de ningún tipo, conforme a la legislación laboral vigente.\n• No se genera ninguna obligación de carácter laboral, tales como pago de salarios, prestaciones laborales, indemnizaciones, o cualquier otro derecho laboral que derive de una relación de trabajo subordinado.\n• Cada parte actúa de forma autónoma, sin que exista dependencia, ni vínculo permanente más allá del objeto del contrato de servicios.`,
      `La presente notificación tiene como finalidad reiterar la naturaleza de la prestación de servicios, y dejar claro que no se establece, ni se presumirá, ningún tipo de vínculo laboral entre Spectrum Media y ${proveedor.name}.`,
    ];

    for (const p of paragraphs) {
      doc.font('Helvetica').fontSize(10).text(p, 50, yCurrent, opts);
      yCurrent = doc.y + 14;
    }

    // Zona de firmas
    const centerX = pageW / 2;
    const ySig1 = yCurrent + 30;

    // Línea y texto del talento
    doc.moveTo(centerX - 120, ySig1).lineTo(centerX + 120, ySig1).stroke();
    doc.fontSize(9).font('Helvetica-Bold').text('Firma del Brand Ambassador', centerX - 120, ySig1 + 4, { width: 240, align: 'center' });
    doc.font('Helvetica').text(proveedor.name, centerX - 120, ySig1 + 16, { width: 240, align: 'center' });

    // Imagen de la firma de la empresa
    const ySig2 = ySig1 + 90;
    if (fs.existsSync(FIRMA_IMG)) {
      doc.image(FIRMA_IMG, centerX - 65, ySig2 - 55, { width: 130, height: 50 });
    }

    // Línea y texto de la empresa
    doc.moveTo(centerX - 120, ySig2).lineTo(centerX + 120, ySig2).stroke();
    doc.fontSize(9).font('Helvetica-Bold').text('Firma del responsable de la empresa:', centerX - 120, ySig2 + 4, { width: 240, align: 'center' });
    doc.font('Helvetica').text('Maria Jose Aguilar, Product Executive', centerX - 120, ySig2 + 16, { width: 240, align: 'center' });

    doc.end();
  });
}

/**
 * Genera el ZIP con recibo + contrato y devuelve un Buffer.
 */
async function generateHostZip(expense, proveedor, contractDesc, rows) {
  const receiptId = String(expense.id).padStart(5, '0');
  const [reciboBuf, contratoBuf] = await Promise.all([
    generateReciboPdf(expense, proveedor, rows),
    generateContratoPdf(expense, proveedor, contractDesc, rows),
  ]);

  return new Promise((resolve, reject) => {
    const chunks = [];
    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('data', c => chunks.push(c));
    archive.on('end', () => resolve(Buffer.concat(chunks)));
    archive.on('error', reject);

    archive.append(reciboBuf, { name: `Recibo_${receiptId}.pdf` });
    archive.append(contratoBuf, { name: `Contrato_${receiptId}.pdf` });
    archive.finalize();
  });
}

module.exports = { generateHostZip };
