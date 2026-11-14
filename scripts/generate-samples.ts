/**
 * Generates the three sample PDFs in public/samples/.
 *
 * These are plain, realistic one-page contractor documents. They contain
 * deliberately planted problems (a duplicate charge, a line-math error, a vague
 * line, labor with no scope, aggressive payment terms, a silent date change, a
 * missing signature) so the demo can show every flag type. The app must find
 * them through the real pipeline — nothing here is referenced by app code.
 *
 * Run: npx tsx scripts/generate-samples.ts
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

const OUT_DIR = path.join(process.cwd(), "public", "samples");

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 54;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const BLACK = rgb(0.1, 0.1, 0.1);
const GRAY = rgb(0.45, 0.45, 0.45);
const RULE = rgb(0.8, 0.8, 0.8);

/** Column x positions for the line-item table. */
const COL_NO = MARGIN;
const COL_DESC = MARGIN + 24;
const COL_QTY = MARGIN + 322;
const COL_UNIT_PRICE = MARGIN + 390;
const COL_AMOUNT_RIGHT = PAGE_WIDTH - MARGIN;
const DESC_WIDTH = COL_QTY - COL_DESC - 12;

type Fonts = { regular: PDFFont; bold: PDFFont };

type LineItem = {
  description: string;
  qty: string;
  unitPrice: string;
  amount: string;
};

type Doc = {
  fileName: string;
  title: string;
  reference: string;
  date: string;
  intro?: string;
  items: LineItem[];
  total: string;
  notes: string[];
  signatures: { label: string; value: string }[];
};

const usd = (cents: number) =>
  `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

/** A cursor that draws top-down and tracks the current y position. */
class Cursor {
  y: number;
  constructor(
    private page: PDFPage,
    private fonts: Fonts,
    startY: number,
  ) {
    this.y = startY;
  }

  text(
    value: string,
    options: {
      x?: number;
      size?: number;
      bold?: boolean;
      color?: ReturnType<typeof rgb>;
      rightAlignTo?: number;
    } = {},
  ) {
    const size = options.size ?? 10;
    const font = options.bold ? this.fonts.bold : this.fonts.regular;
    const x =
      options.rightAlignTo !== undefined
        ? options.rightAlignTo - font.widthOfTextAtSize(value, size)
        : (options.x ?? MARGIN);
    this.page.drawText(value, {
      x,
      y: this.y,
      size,
      font,
      color: options.color ?? BLACK,
    });
  }

  down(amount: number) {
    this.y -= amount;
  }

  rule() {
    this.page.drawLine({
      start: { x: MARGIN, y: this.y },
      end: { x: PAGE_WIDTH - MARGIN, y: this.y },
      thickness: 0.75,
      color: RULE,
    });
  }
}

/** Greedy word wrap against the real glyph widths of the font. */
function wrap(value: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = value.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

async function buildPdf(doc: Doc): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(doc.title);
  pdf.setAuthor("Summit Home Renovations LLC");
  const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const fonts: Fonts = {
    regular: await pdf.embedFont(StandardFonts.Helvetica),
    bold: await pdf.embedFont(StandardFonts.HelveticaBold),
  };
  const c = new Cursor(page, fonts, PAGE_HEIGHT - MARGIN);

  // Contractor letterhead.
  c.text("Summit Home Renovations LLC", { size: 15, bold: true });
  c.down(14);
  c.text("1480 Polaris Parkway, Columbus, OH 43240", { size: 9, color: GRAY });
  c.down(11);
  c.text("(614) 555-0118  ·  office@summithomereno.example  ·  OH Lic. #HR-48213", {
    size: 9,
    color: GRAY,
  });
  c.down(26);
  c.rule();
  c.down(22);

  // Document heading.
  c.text(doc.title, { size: 13, bold: true });
  c.down(16);
  c.text(doc.reference, { size: 10, color: GRAY });
  c.down(13);
  c.text(`Date: ${doc.date}`, { size: 10, color: GRAY });
  c.down(20);

  // Client block.
  c.text("Prepared for", { size: 9, bold: true, color: GRAY });
  c.down(13);
  c.text("Maya Thompson", { size: 10 });
  c.down(12);
  c.text("2217 Ashbrook Lane, Columbus, OH 43221", { size: 10, color: GRAY });
  c.down(12);
  c.text("Project: Hall bathroom remodel", { size: 10, color: GRAY });
  c.down(22);

  if (doc.intro) {
    for (const line of wrap(doc.intro, fonts.regular, 10, CONTENT_WIDTH)) {
      c.text(line, { size: 10 });
      c.down(13);
    }
    c.down(8);
  }

  // Line-item table.
  c.text("#", { x: COL_NO, size: 9, bold: true, color: GRAY });
  c.text("Description", { x: COL_DESC, size: 9, bold: true, color: GRAY });
  c.text("Qty", { x: COL_QTY, size: 9, bold: true, color: GRAY });
  c.text("Unit price", { x: COL_UNIT_PRICE, size: 9, bold: true, color: GRAY });
  c.text("Amount", { size: 9, bold: true, color: GRAY, rightAlignTo: COL_AMOUNT_RIGHT });
  c.down(7);
  c.rule();
  c.down(16);

  doc.items.forEach((item, index) => {
    const lines = wrap(item.description, fonts.regular, 10, DESC_WIDTH);
    c.text(String(index + 1), { x: COL_NO, size: 10, color: GRAY });
    c.text(lines[0] ?? "", { x: COL_DESC, size: 10 });
    if (item.qty) c.text(item.qty, { x: COL_QTY, size: 10 });
    if (item.unitPrice) c.text(item.unitPrice, { x: COL_UNIT_PRICE, size: 10 });
    c.text(item.amount, { size: 10, rightAlignTo: COL_AMOUNT_RIGHT });
    for (const extra of lines.slice(1)) {
      c.down(13);
      c.text(extra, { x: COL_DESC, size: 10 });
    }
    c.down(18);
  });

  c.down(2);
  c.rule();
  c.down(18);
  c.text("Total", { x: COL_UNIT_PRICE, size: 11, bold: true });
  c.text(doc.total, { size: 11, bold: true, rightAlignTo: COL_AMOUNT_RIGHT });
  c.down(28);

  for (const note of doc.notes) {
    for (const line of wrap(note, fonts.regular, 10, CONTENT_WIDTH)) {
      c.text(line, { size: 10 });
      c.down(13);
    }
    c.down(7);
  }

  c.down(14);
  c.rule();
  c.down(20);
  for (const signature of doc.signatures) {
    c.text(`${signature.label}:`, { size: 10, color: GRAY });
    c.text(signature.value, { x: MARGIN + 160, size: 10 });
    c.down(20);
  }

  return pdf.save();
}

const quote: Doc = {
  fileName: "quote-bathroom.pdf",
  title: "Estimate",
  reference: "Estimate #1042",
  date: "10/01/2026",
  intro:
    "Fixed-price estimate for the hall bathroom remodel described below. Scheduled start 10/20/2026, scheduled completion 11/21/2026.",
  items: [
    {
      description: "Demolition and haul-away of existing tub, tile and vanity",
      qty: "1 lot",
      unitPrice: usd(90000),
      amount: usd(90000),
    },
    {
      description: "Plumbing rough-in, relocate shower valve and drain",
      qty: "1 lot",
      unitPrice: usd(140000),
      amount: usd(140000),
    },
    {
      description:
        "Shower pan, cement board and waterproofing membrane (walls and floor)",
      qty: "1 lot",
      unitPrice: usd(65000),
      amount: usd(65000),
    },
    {
      description: "Tile installation labor (floor and shower walls)",
      qty: "160 sq ft",
      unitPrice: usd(1000),
      amount: usd(160000),
    },
    {
      description: "Tile material ALLOWANCE (owner selection)",
      qty: "1 lot",
      unitPrice: usd(150000),
      amount: usd(150000),
    },
    {
      description: "Vanity, toilet and fixtures ALLOWANCE (owner selection)",
      qty: "1 lot",
      unitPrice: usd(120000),
      amount: usd(120000),
    },
    {
      description: "Electrical, exhaust fan and GFCI outlets",
      qty: "1 lot",
      unitPrice: usd(45000),
      amount: usd(45000),
    },
    {
      description: "Permit and inspection fees",
      qty: "1 lot",
      unitPrice: usd(30000),
      amount: usd(30000),
    },
  ],
  total: usd(800000),
  notes: [
    "Payment schedule: 30% deposit of $2,400.00 due at signing; 40% of $3,200.00 due at rough-in inspection; 30% of $2,400.00 due at completion.",
    "Allowance amounts cover owner-selected materials up to the stated figure. Selections above the allowance are billed by change order.",
    "This estimate is valid for 30 days. Any change to the scope of work will be documented in a written change order.",
  ],
  signatures: [
    { label: "Contractor signature", value: "David Reyes, Summit Home Renovations LLC — 10/01/2026" },
    { label: "Client signature", value: "Maya Thompson — 10/03/2026" },
  ],
};

const changeOrderOne: Doc = {
  fileName: "change-order-1.pdf",
  title: "Change Order #1",
  reference: "Change Order #1 to Estimate #1042",
  date: "11/03/2026",
  intro:
    "The following additional work and material costs apply to the hall bathroom remodel under Estimate #1042.",
  items: [
    {
      description:
        "Tile upgrade over allowance (selected porcelain $2,100.00 vs $1,500.00 allowance)",
      qty: "1 lot",
      unitPrice: usd(60000),
      amount: usd(60000),
    },
    {
      description: "Waterproofing membrane for shower walls",
      qty: "1 lot",
      unitPrice: usd(45000),
      amount: usd(45000),
    },
    {
      description: "Additional labor",
      qty: "8 hrs",
      unitPrice: usd(8500),
      amount: usd(68000),
    },
    {
      description: "Recessed niche shelves",
      qty: "3",
      unitPrice: usd(18000),
      amount: usd(64000),
    },
    {
      description: "Misc. additional work",
      qty: "1 lot",
      unitPrice: usd(13000),
      amount: usd(13000),
    },
  ],
  total: usd(250000),
  notes: [
    "Revised completion date: 11/30/2026.",
    "Change order amount due in full upon signing.",
  ],
  signatures: [
    { label: "Contractor signature", value: "David Reyes, Summit Home Renovations LLC — 11/03/2026" },
    { label: "Client signature", value: "____________________________" },
  ],
};

const changeOrderTwo: Doc = {
  fileName: "change-order-2.pdf",
  title: "Change Order #2",
  reference: "Change Order #2 to Estimate #1042",
  date: "11/12/2026",
  intro:
    "The following additional work applies to the hall bathroom remodel under Estimate #1042.",
  items: [
    {
      description: "Upgrade exhaust fan to humidity-sensing model",
      qty: "1 lot",
      unitPrice: usd(18000),
      amount: usd(18000),
    },
    {
      description: "Additional GFCI outlet by vanity",
      qty: "1 lot",
      unitPrice: usd(9500),
      amount: usd(9500),
    },
    {
      description: "Haul-away fee for old materials",
      qty: "1 lot",
      unitPrice: usd(25000),
      amount: usd(25000),
    },
  ],
  total: usd(52500),
  notes: ["Balance due with the final completion invoice."],
  signatures: [
    { label: "Contractor signature", value: "David Reyes, Summit Home Renovations LLC — 11/12/2026" },
    { label: "Client signature", value: "____________________________" },
  ],
};

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  for (const doc of [quote, changeOrderOne, changeOrderTwo]) {
    const bytes = await buildPdf(doc);
    const target = path.join(OUT_DIR, doc.fileName);
    await writeFile(target, bytes);
    console.log(`wrote ${path.relative(process.cwd(), target)} (${bytes.length} bytes)`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
