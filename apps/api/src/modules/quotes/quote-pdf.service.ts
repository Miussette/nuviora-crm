import { Injectable } from "@nestjs/common";
import PDFDocument from "pdfkit";
import { formatClp } from "@nuviora/domain";
import {
  CustomerSnapshot,
  IssuerSnapshot,
  QuoteStore,
  StoredQuote,
} from "./quote.store";
@Injectable()
export class QuotePdfService {
  constructor(private readonly store: QuoteStore) {}
  async generate(
    organizationId: string,
    id: string,
  ): Promise<{ number: string; buffer: Buffer }> {
    const row = await this.store.db.$transaction(async (tx) =>
      this.store.expire(tx, await this.store.lock(tx, organizationId, id)),
    );
    return { number: row.number, buffer: await this.render(row) };
  }
  render(row: StoredQuote): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const issuer = row.issuerSnapshot as unknown as IssuerSnapshot;
      const customer = row.customerSnapshot as unknown as CustomerSnapshot;
      const doc = new PDFDocument({
        size: "A4",
        margins: { top: 44, bottom: 80, left: 44, right: 44 },
        bufferPages: true,
        info: {
          Title: `Cotización ${row.number}`,
          Author: issuer.name,
          Subject: "Cotización comercial. No es factura electrónica del SII.",
          CreationDate: row.sentAt ?? row.createdAt,
        },
      });
      const buffers: Buffer[] = [];
      doc.on("data", (chunk: Buffer) => buffers.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.on("error", reject);
      const left = 44,
        width = doc.page.width - 88,
        accent = issuer.accentColor;
      let y = 44;
      const bottom = () => doc.page.height - 92;
      const formatDate = (value: Date) =>
        new Intl.DateTimeFormat("es-CL", {
          dateStyle: "medium",
          timeZone: "UTC",
        }).format(value);
      const wrapped = (
        text: string,
        size: number,
        columnWidth: number,
      ): string[] => {
        doc.font("Helvetica").fontSize(size);
        const lines: string[] = [];
        for (const paragraph of text.replace(/\r/g, "").split("\n")) {
          let line = "";
          for (const word of paragraph.split(/\s+/).filter(Boolean)) {
            const candidate = line ? `${line} ${word}` : word;
            if (doc.widthOfString(candidate) <= columnWidth) {
              line = candidate;
              continue;
            }
            if (line) {
              lines.push(line);
              line = "";
            }
            for (const char of word) {
              if (line && doc.widthOfString(line + char) > columnWidth) {
                lines.push(line);
                line = "";
              }
              line += char;
            }
          }
          lines.push(line);
        }
        return lines;
      };
      const columns = [190, 43, 76, 48, 45, width - 402];
      const tableHeader = () => {
        doc.rect(left, y, width, 28).fill("#EEE8F5");
        let x = left;
        [
          "Concepto / unidad",
          "Cant.",
          "P. unitario",
          "Dto. %",
          "IVA %",
          "Total CLP",
        ].forEach((label, i) => {
          doc
            .fillColor("#292633")
            .font("Helvetica-Bold")
            .fontSize(8)
            .text(label, x + 5, y + 9, {
              width: columns[i]! - 10,
              lineBreak: false,
            });
          x += columns[i]!;
        });
        y += 28;
      };
      const newPage = (table = false) => {
        doc.addPage();
        doc
          .font("Helvetica-Bold")
          .fontSize(10)
          .fillColor(accent)
          .text(row.number, left, 35, { width: 160 });
        doc
          .font("Helvetica")
          .fontSize(8)
          .fillColor("#686173")
          .text(issuer.name, 220, 36, {
            width: width - 176,
            align: "right",
            height: 22,
            ellipsis: true,
          });
        y = 76;
        if (table) tableHeader();
      };
      const ensure = (height: number, table = false) => {
        if (y + height > bottom()) newPage(table);
      };
      const block = (label: string, text: string) => {
        const lines = wrapped(text, 9, width);
        const height = 22 + lines.length * 13 + 12;
        ensure(Math.min(height, bottom() - 76));
        doc
          .font("Helvetica-Bold")
          .fontSize(10)
          .fillColor(accent)
          .text(label, left, y, { width });
        y += 22;
        for (const line of lines) {
          if (y + 13 > bottom()) {
            newPage();
            doc
              .font("Helvetica-Bold")
              .fontSize(9)
              .fillColor(accent)
              .text(`${label} (continuación)`, left, y, { width });
            y += 22;
          }
          doc
            .font("Helvetica")
            .fontSize(9)
            .fillColor("#292633")
            .text(line, left, y, { width, lineBreak: false });
          y += 13;
        }
        y += 12;
      };
      if (issuer.logoDataUrl) {
        doc.image(
          Buffer.from(issuer.logoDataUrl.split(",")[1]!, "base64"),
          left,
          y,
          { fit: [150, 52] },
        );
        y += 56;
      }
      doc
        .font("Helvetica-Bold")
        .fontSize(18)
        .fillColor(accent)
        .text(issuer.name, left, y, { width: 300 });
      y = doc.y + 10;
      const issuerDetails = [
        issuer.legalName,
        issuer.rut ? `RUT: ${issuer.rut}` : null,
        issuer.email,
        issuer.phone,
      ]
        .filter((value): value is string => !!value)
        .join("\n");
      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor("#686173")
        .text(issuerDetails, left, y, { width: 300, lineGap: 2 });
      y = Math.max(doc.y + 18, 174);
      doc
        .font("Helvetica-Bold")
        .fontSize(15)
        .fillColor(accent)
        .text("COTIZACIÓN", 365, 44, { width: 186, align: "right" });
      doc
        .fontSize(13)
        .text(row.number, 365, 68, { width: 186, align: "right" });
      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor("#292633")
        .text(
          `Emisión: ${formatDate(row.issueDate)}\nVencimiento: ${formatDate(row.expiryDate)}\nMoneda: CLP\nVersión: ${row.documentVersion}`,
          365,
          96,
          { width: 186, align: "right", lineGap: 4 },
        );
      if (row.status === "DRAFT")
        doc
          .font("Helvetica-Bold")
          .fontSize(10)
          .fillColor("#805B1C")
          .text("BORRADOR / VISTA PREVIA", 330, 164, {
            width: 221,
            align: "right",
          });
      block(
        "Preparada para",
        [
          customer.name,
          customer.rut ? `RUT: ${customer.rut}` : "",
          customer.email,
          customer.phone,
          [
            customer.address,
            customer.commune,
            customer.region,
            customer.country,
          ]
            .filter(Boolean)
            .join(", "),
        ]
          .filter(Boolean)
          .join("\n"),
      );
      if (row.reference) block("Referencia", row.reference);
      ensure(64);
      tableHeader();
      row.items.forEach((item, index) => {
        const values = [
          `${item.name}${item.description ? "\n" + item.description : ""}\nUnidad: ${item.unit}`,
          item.quantity.toString(),
          formatClp(item.unitPrice.toFixed(2)),
          item.discount.toString(),
          item.taxRate.toString(),
          formatClp(item.lineTotal.toFixed(2)),
        ];
        const cells = values.map((value, i) =>
          wrapped(value, 8.5, columns[i]! - 10),
        );
        const lines = Math.max(...cells.map((cell) => cell.length));
        const fullHeight = lines * 12 + 16;
        if (fullHeight < 580) ensure(fullHeight, true);
        let offset = 0;
        while (offset < lines) {
          if (bottom() - y < 40) newPage(true);
          const count = Math.max(
            1,
            Math.min(lines - offset, Math.floor((bottom() - y - 16) / 12)),
          );
          const height = count * 12 + 16;
          if (index % 2 === 0) doc.rect(left, y, width, height).fill("#F7F5FA");
          let x = left;
          cells.forEach((cell, i) => {
            doc.font("Helvetica").fontSize(8.5).fillColor("#292633");
            cell.slice(offset, offset + count).forEach((line, lineIndex) =>
              doc.text(line, x + 5, y + 8 + lineIndex * 12, {
                width: columns[i]! - 10,
                lineBreak: false,
              }),
            );
            x += columns[i]!;
          });
          y += height;
          doc
            .moveTo(left, y)
            .lineTo(left + width, y)
            .strokeColor("#DED8E7")
            .lineWidth(0.5)
            .stroke();
          offset += count;
          if (offset < lines) newPage(true);
        }
      });
      if (!row.items.length) {
        doc
          .fontSize(10)
          .fillColor("#686173")
          .text("Este borrador todavía no tiene ítems.", left + 6, y + 14, {
            width,
          });
        y += 48;
      }
      y += 16;
      const totals = [
        ["Subtotal", formatClp(row.subtotal.toFixed(2))],
        ["Descuentos", `-${formatClp(row.discountTotal.toFixed(2))}`],
        ["Base imponible", formatClp(row.taxableBase.toFixed(2))],
        ["Monto exento", formatClp(row.exemptBase.toFixed(2))],
        ["IVA 19%", formatClp(row.taxTotal.toFixed(2))],
        ["TOTAL CLP", formatClp(row.total.toFixed(2))],
      ];
      ensure(140);
      for (const [label, value] of totals) {
        const total = label === "TOTAL CLP";
        const size = total ? 12 : 9;
        doc.font(total ? "Helvetica-Bold" : "Helvetica").fontSize(size);
        const height = Math.max(
          total ? 28 : 19,
          doc.heightOfString(value!, { width: 162 }) + 7,
        );
        ensure(height);
        if (total) doc.rect(270, y - 4, 281, height + 3).fill("#EEE8F5");
        doc
          .fillColor(total ? accent : "#292633")
          .text(label!, 282, y + 3, { width: 95 });
        doc.text(value!, 379, y + 3, { width: 162, align: "right" });
        y += height;
      }
      y += 18;
      const terms = [
        ["Plazo de entrega", row.deliveryTerms],
        ["Condiciones de pago", row.paymentTerms],
        ["Vigencia", row.validityTerms],
        ["Notas para el cliente", row.customerNotes],
      ].filter((entry): entry is [string, string] => !!entry[1]);
      const columnWidth = (width - 36) / 2;
      const noteLines = row.notes ? wrapped(row.notes, 9, width - 24) : [];
      const termRows: { label: string; lines: string[] }[][] = [];
      for (let i = 0; i < terms.length; i += 2) {
        termRows.push(
          terms
            .slice(i, i + 2)
            .map(([label, text]) => ({
              label,
              lines: wrapped(text, 9, columnWidth),
            })),
        );
      }
      const noteHeight = noteLines.length ? 15 + noteLines.length * 12 + 8 : 0;
      const rowHeights = termRows.map(
        (cells) =>
          15 + Math.max(...cells.map((cell) => cell.lines.length)) * 12 + 8,
      );
      const sectionHeight =
        40 + noteHeight + rowHeights.reduce((sum, height) => sum + height, 0);
      if (row.notes || terms.length) {
        if (sectionHeight <= bottom() - 76) {
          // Keep ordinary conditions together; long documents continue below without truncation.
          ensure(sectionHeight);
          doc.roundedRect(left, y, width, sectionHeight, 6).fill("#F7F5FA");
          doc
            .font("Helvetica-Bold")
            .fontSize(10)
            .fillColor(accent)
            .text("Condiciones comerciales", left + 12, y + 12, {
              width: width - 24,
            });
          y += 34;
          const cell = (
            label: string,
            lines: string[],
            x: number,
            cellWidth: number,
          ) => {
            doc
              .font("Helvetica-Bold")
              .fontSize(9)
              .fillColor("#292633")
              .text(label, x, y, { width: cellWidth, lineBreak: false });
            lines.forEach((line, index) =>
              doc
                .font("Helvetica")
                .fontSize(9)
                .fillColor("#686173")
                .text(line, x, y + 15 + index * 12, {
                  width: cellWidth,
                  lineBreak: false,
                }),
            );
          };
          if (noteLines.length) {
            cell("Observaciones", noteLines, left + 12, width - 24);
            y += noteHeight;
          }
          termRows.forEach((cells, index) => {
            cells.forEach((entry, column) =>
              cell(
                entry.label,
                entry.lines,
                left + 12 + column * (columnWidth + 12),
                columnWidth,
              ),
            );
            y += rowHeights[index]!;
          });
          y += 6;
        } else {
          if (row.notes) block("Observaciones", row.notes);
          for (const [label, text] of terms) block(label, text);
        }
      }
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        const previousBottom = doc.page.margins.bottom;
        doc.page.margins.bottom = 10;
        const footerY = doc.page.height - 70;
        doc
          .moveTo(left, footerY - 10)
          .lineTo(left + width, footerY - 10)
          .strokeColor("#DED8E7")
          .stroke();
        doc.font("Helvetica").fontSize(7).fillColor("#686173");
        if (issuer.footer)
          doc.text(issuer.footer.replace(/\s+/g, " "), left, footerY, {
            width,
            height: 22,
          });
        doc.text(
          "Cotización comercial. No constituye factura electrónica del SII.",
          left,
          doc.page.height - 40,
          { width: width - 80, lineBreak: false },
        );
        doc.text(
          `${i + 1} / ${range.count}`,
          left + width - 65,
          doc.page.height - 40,
          { width: 65, align: "right", lineBreak: false },
        );
        if (row.documentHash)
          doc
            .fontSize(6)
            .text(
              `Versión ${row.documentVersion} | SHA-256 ${row.documentHash}`,
              left,
              doc.page.height - 25,
              { width, lineBreak: false },
            );
        doc.page.margins.bottom = previousBottom;
      }
      doc.end();
    });
  }
}
