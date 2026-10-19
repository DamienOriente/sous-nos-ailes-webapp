import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";
import { CANVAS, tableFootprint } from "@/modules/seating/domain/geometry";
import type { SeatingPlan } from "@/modules/seating/application/seating-service";

/** pdf-lib standard fonts are WinAnsi only: strip characters they cannot encode. */
function safe(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\x20-\x7E]/g, "?");
}

const A4_LANDSCAPE: [number, number] = [841.89, 595.28];
const MARGIN = 36;
const SAGE = rgb(0.42, 0.56, 0.44);
const INK = rgb(0.18, 0.2, 0.22);
const RED = rgb(0.75, 0.2, 0.2);
const SAND = rgb(0.96, 0.95, 0.92);

function drawEllipse(page: PDFPage, cx: number, cy: number, rx: number, ry: number, stroke: ReturnType<typeof rgb>) {
  page.drawEllipse({ x: cx, y: cy, xScale: rx, yScale: ry, borderColor: stroke, borderWidth: 1.2, color: SAND });
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const w of words) {
    const candidate = current ? `${current} ${w}` : w;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && current) {
      lines.push(current);
      current = w;
    } else current = candidate;
  }
  if (current) lines.push(current);
  return lines;
}

/** Vector drawing of the plan (page 1) followed by the per-table guest lists. */
export async function renderSeatingPdf(plan: SeatingPlan): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Plan de table : ${plan.eventName}`);
  doc.setProducer("Sous Nos Ailes");
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const page = doc.addPage(A4_LANDSCAPE);
  const [pw, ph] = A4_LANDSCAPE;
  page.drawText(safe(`Plan de table : ${plan.eventName}`), { x: MARGIN, y: ph - MARGIN - 6, size: 16, font: bold, color: INK });
  page.drawText(safe(`${plan.tables.length} tables · ${plan.totalSeats} places · ${plan.totalGuests - plan.unplaced.length}/${plan.totalGuests} invités placés`), { x: MARGIN, y: ph - MARGIN - 24, size: 10, font, color: SAGE });

  const areaW = pw - MARGIN * 2;
  const areaH = ph - MARGIN * 2 - 40;
  const scale = Math.min(areaW / CANVAS.width, areaH / CANVAS.height);
  const ox = MARGIN;
  const oy = MARGIN;
  page.drawRectangle({ x: ox, y: oy, width: CANVAS.width * scale, height: CANVAS.height * scale, borderColor: rgb(0.85, 0.83, 0.78), borderWidth: 0.8 });

  for (const t of plan.tables) {
    const fp = tableFootprint(t.shape, t.capacity);
    const cx = ox + t.x * scale;
    // PDF origin is bottom-left; the canvas origin is top-left.
    const cy = oy + (CANVAS.height - t.y) * scale;
    const w = fp.w * scale;
    const h = fp.h * scale;
    const stroke = t.occupancy.isOver ? RED : SAGE;
    if (t.shape === "round" || t.shape === "oval") drawEllipse(page, cx, cy, w / 2, h / 2, stroke);
    else page.drawRectangle({ x: cx - w / 2, y: cy - h / 2, width: w, height: h, borderColor: stroke, borderWidth: 1.2, color: SAND, rotate: { type: "degrees", angle: 0 } as never });
    const label = safe(t.name);
    const size = 8;
    page.drawText(label, { x: cx - bold.widthOfTextAtSize(label, size) / 2, y: cy + 1, size, font: bold, color: INK });
    const occ = `${t.occupancy.used}/${t.capacity}`;
    page.drawText(occ, { x: cx - font.widthOfTextAtSize(occ, 7) / 2, y: cy - 9, size: 7, font, color: stroke });
  }

  // Lists
  let listPage = doc.addPage(A4_LANDSCAPE);
  let y = ph - MARGIN;
  const colW = (pw - MARGIN * 2 - 24) / 3;
  let col = 0;
  const lineH = 11;
  const ensureSpace = (needed: number) => {
    if (y - needed < MARGIN) {
      col += 1;
      y = ph - MARGIN;
      if (col > 2) {
        listPage = doc.addPage(A4_LANDSCAPE);
        col = 0;
      }
    }
  };
  listPage.drawText(safe("Liste des invités par table"), { x: MARGIN, y: y - 6, size: 14, font: bold, color: INK });
  y -= 28;
  for (const t of plan.tables) {
    ensureSpace(lineH * (t.guests.length + 2));
    const x = MARGIN + col * (colW + 12);
    listPage.drawText(safe(`${t.name} (${t.guests.length}/${t.capacity})`), { x, y, size: 10, font: bold, color: t.occupancy.isOver ? RED : SAGE });
    y -= lineH + 2;
    if (t.guests.length === 0) {
      listPage.drawText("- aucun invite place -", { x: x + 8, y, size: 8.5, font, color: rgb(0.5, 0.5, 0.5) });
      y -= lineH;
    }
    for (const g of t.guests) {
      ensureSpace(lineH);
      const name = safe(`${g.firstName} ${g.lastName}`.trim() + (g.isChild ? " (enfant)" : ""));
      for (const line of wrap(name, font, 8.5, colW - 10)) {
        listPage.drawText(line, { x: x + 8, y, size: 8.5, font, color: INK });
        y -= lineH;
      }
    }
    y -= 6;
  }
  if (plan.unplaced.length > 0) {
    ensureSpace(lineH * (plan.unplaced.length + 2));
    const x = MARGIN + col * (colW + 12);
    listPage.drawText(safe(`Non placés (${plan.unplaced.length})`), { x, y, size: 10, font: bold, color: RED });
    y -= lineH + 2;
    for (const g of plan.unplaced) {
      ensureSpace(lineH);
      listPage.drawText(safe(`${g.firstName} ${g.lastName}`.trim()), { x: x + 8, y, size: 8.5, font, color: INK });
      y -= lineH;
    }
  }
  return doc.save();
}
