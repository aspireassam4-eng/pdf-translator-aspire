import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
} from "docx";

export interface ExportOptions {
  originalPages: string[];
  translatedPages: string[];
  language: "Assamese" | "Bodo";
  fileName: string;
  mode: "translated-only" | "side-by-side" | "alternating";
}

export async function exportToDocx({
  originalPages,
  translatedPages,
  language,
  fileName,
  mode,
}: ExportOptions): Promise<Blob> {
  const sections: any[] = [];

  // Define simple border styling
  const cellBorder = {
    top: { style: BorderStyle.SINGLE, size: 4, color: "D1D5DB" },
    bottom: { style: BorderStyle.SINGLE, size: 4, color: "D1D5DB" },
    left: { style: BorderStyle.SINGLE, size: 4, color: "D1D5DB" },
    right: { style: BorderStyle.SINGLE, size: 4, color: "D1D5DB" },
  };

  const pageHeaderParagraphs = [
    new Paragraph({
      text: `${language} Document Translation Report`,
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({ text: "Source File: ", bold: true }),
        new TextRun({ text: fileName }),
      ],
      spacing: { after: 60 },
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({ text: "Target Language: ", bold: true }),
        new TextRun({ text: language }),
        new TextRun({ text: "   |   Date: ", bold: true }),
        new TextRun({ text: new Date().toLocaleDateString() }),
      ],
      spacing: { after: 240 },
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: "Disclaimer: Numerical values and digits are kept in their original English format to maintain absolute accuracy.",
          italics: true,
          size: 18,
          color: "6B7280",
        }),
      ],
      spacing: { after: 400 },
    }),
  ];

  if (mode === "side-by-side") {
    // Generate side-by-side table rows for each page
    const tableRows: TableRow[] = [
      // Header row
      new TableRow({
        tableHeader: true,
        children: [
          new TableCell({
            shading: { fill: "F3F4F6" },
            borders: cellBorder,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: "Original English Content", bold: true, color: "111827" }),
                ],
                spacing: { before: 100, after: 100 },
              }),
            ],
            width: { size: 50, type: WidthType.PERCENTAGE },
          }),
          new TableCell({
            shading: { fill: "F3F4F6" },
            borders: cellBorder,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: `Translated (${language})`, bold: true, color: "111827" }),
                ],
                spacing: { before: 100, after: 100 },
              }),
            ],
            width: { size: 50, type: WidthType.PERCENTAGE },
          }),
        ],
      }),
    ];

    // For each page, create a row with the page content
    for (let i = 0; i < originalPages.length; i++) {
      const originalText = originalPages[i] || "";
      const translatedText = translatedPages[i] || "";

      // Break page contents by paragraph to structure cleanly inside cells
      const origParagraphs = originalText.split("\n").map(
        (p) =>
          new Paragraph({
            children: [new TextRun({ text: p, size: 22 })],
            spacing: { after: 100 },
          })
      );

      const transParagraphs = translatedText.split("\n").map(
        (p) =>
          new Paragraph({
            children: [new TextRun({ text: p, size: 22 })],
            spacing: { after: 100 },
          })
      );

      tableRows.push(
        new TableRow({
          children: [
            new TableCell({
              borders: cellBorder,
              children: [
                new Paragraph({
                  children: [new TextRun({ text: `Page ${i + 1}`, bold: true, size: 20, color: "4B5563" })],
                  spacing: { before: 100, after: 100 },
                }),
                ...origParagraphs,
              ],
              width: { size: 50, type: WidthType.PERCENTAGE },
            }),
            new TableCell({
              borders: cellBorder,
              children: [
                new Paragraph({
                  children: [new TextRun({ text: `Page ${i + 1} (${language})`, bold: true, size: 20, color: "4B5563" })],
                  spacing: { before: 100, after: 100 },
                }),
                ...transParagraphs,
              ],
              width: { size: 50, type: WidthType.PERCENTAGE },
            }),
          ],
        })
      );
    }

    const docTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: tableRows,
    });

    sections.push({
      properties: {},
      children: [...pageHeaderParagraphs, docTable],
    });
  } else {
    // Other modes: translated-only or alternating
    const children: Paragraph[] = [...pageHeaderParagraphs];

    for (let i = 0; i < originalPages.length; i++) {
      const origText = originalPages[i] || "";
      const transText = translatedPages[i] || "";

      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `Page ${i + 1}`,
              bold: true,
              size: 24,
              color: "1F2937",
            }),
          ],
          spacing: { before: 240, after: 120 },
        })
      );

      if (mode === "translated-only") {
        const paragraphs = transText.split("\n");
        for (const p of paragraphs) {
          if (p.trim()) {
            children.push(
              new Paragraph({
                children: [new TextRun({ text: p, size: 22 })],
                spacing: { after: 120 },
              })
            );
          }
        }
      } else {
        // alternating
        const origLines = origText.split("\n");
        const transLines = transText.split("\n");
        const maxLines = Math.max(origLines.length, transLines.length);

        for (let j = 0; j < maxLines; j++) {
          const origLine = origLines[j];
          const transLine = transLines[j];

          if (origLine && origLine.trim()) {
            children.push(
              new Paragraph({
                children: [
                  new TextRun({ text: "[English]: ", bold: true, size: 18, color: "4B5563" }),
                  new TextRun({ text: origLine, size: 20, color: "4B5563", italics: true }),
                ],
                spacing: { after: 60 },
              })
            );
          }

          if (transLine && transLine.trim()) {
            children.push(
              new Paragraph({
                children: [
                  new TextRun({ text: `[${language}]: `, bold: true, size: 20, color: "111827" }),
                  new TextRun({ text: transLine, size: 22, color: "111827" }),
                ],
                spacing: { after: 180 },
              })
            );
          }
        }
      }
    }

    sections.push({
      properties: {},
      children: children,
    });
  }

  const doc = new Document({
    sections: sections,
  });

  return await Packer.toBlob(doc);
}
