"""Invoice export helpers for Universal Invest Strategy style invoices.

Matches the exact PDF facture design (Facture №62 reference):
  - Logo top-left, company name+info top-right (italic blue Helvetica)
  - Date underlined italic + "Facture №XX" large blue bold italic on the left
  - DESTINATAIRE block underlined italic on the right
  - Orange header row table with white bold centred column labels
  - Empty spacer row after header (visual spacing inside table)
  - Each item row separated by thin orange border lines
  - HT / TVA / TTC summary block bottom-right, TTC with orange box border
  - "Arrêter la présente…" bold underlined legal line
  - Footer bar with orange-tinted background, centred, two lines of legal info

PLACEMENT:
  Put this file at: <your_project_root>/utils/invoice_generator.py

LOGO:
  The logo image must be at: <your_project_root>/assets/ui_logo.jpeg

USAGE:
  from utils.invoice_generator import generate_invoice_pdf
  pdf_path = generate_invoice_pdf(invoice)
"""

from pathlib import Path
import re
from html import escape

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image,
    HRFlowable,
)
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT

# ── Output directory & logo path ─────────────────────────────────────────────
EXPORT_DIR = Path("uploads/invoices")
LOGO_PATH  = Path(__file__).resolve().parents[1] / "assets" / "ui_logo.jpeg"

# ── Brand colours ─────────────────────────────────────────────────────────────
BLUE         = colors.HexColor("#173B57")   # dark navy blue for titles
ORANGE       = colors.HexColor("#F28C28")   # orange for table header / TTC border
LGREY        = colors.HexColor("#F5F5F5")   # light grey for HT/TVA/TTC rows
BORDER       = colors.HexColor("#E8A96A")   # orange-tinted border for item rows
BORDER_GREY  = colors.HexColor("#D0D0D0")   # grey border for summary block
ORANGE_LIGHT = colors.HexColor("#FAD9B5")   # footer background tint
WHITE        = colors.white

# ── Fixed company information ─────────────────────────────────────────────────
COMPANY = {
    "name":           "Universal Invest Strategy.SARL",
    "address":        "RUE EL AARAR ET BD LALLA YACOUT",
    "phone":          "212522273011",
    "email":          "contact@uivstrategy.ma",
    "footer_address": "Angle Rue al AARAR et av Lalla Yacout 3eme étage Appartement 8",
    "ice":            "002752348000050",
    "rc":             "496151",
    "patente":        "34102034",
    "if_number":      "50137892",
    "cnss":           "2507310",
    "mobile":         "0707040170",
}


# ── Helpers ───────────────────────────────────────────────────────────────────

def ensure_export_dir():
    EXPORT_DIR.mkdir(parents=True, exist_ok=True)
    return EXPORT_DIR


def money(v):
    """
    Format Moroccan style: 1 500,00  (narrow-space thousands, comma decimal)
    Matches exactly the invoice: "750,00" and "1 500,00"
    """
    try:
        fv = float(v or 0)
    except (TypeError, ValueError):
        return str(v)
    # Format with standard comma as thousands sep, then swap
    formatted = f"{fv:,.2f}"          # "1,500.00"
    # Replace thousands comma with narrow no-break space, decimal dot with comma
    formatted = formatted.replace(",", "\u202f").replace(".", ",")
    return formatted


def profile(invoice):
    return invoice.client.profile if getattr(invoice, "client", None) else None


def client_display(invoice):
    p = profile(invoice)
    if not p:
        return "CLIENT"
    return (
        getattr(p, "company_name", None)
        or f"{getattr(p, 'first_name', '')} {getattr(p, 'last_name', '')}".strip()
        or getattr(invoice.client, "email", "CLIENT")
    )


def client_ice(invoice):
    p = profile(invoice)
    return getattr(p, "company_ice", None) or ""


def client_rc(invoice):
    p = profile(invoice)
    return getattr(p, "company_rc", None) or ""


def client_if(invoice):
    p = profile(invoice)
    return getattr(p, "company_if", None) or ""


def client_address(invoice):
    p = profile(invoice)
    return getattr(p, "address", None) or ""


def client_phone(invoice):
    p = profile(invoice)
    return getattr(p, "phone", None) or ""


def client_email(invoice):
    p = profile(invoice)
    if p:
        return getattr(p, "email", None) or ""
    return getattr(invoice.client, "email", "") if getattr(invoice, "client", None) else ""


def amount_in_words(total) -> str:
    """French words for the legal bottom line."""
    try:
        from num2words import num2words
        words = num2words(int(float(total or 0)), lang="fr").capitalize()
        return f"Arrêter la présente facture a la somme de {words} Dirhams ,00 dhs"
    except Exception:
        return f"Arrêter la présente facture a la somme de {money(total)} DHS ,00 dhs"


def quantity_display(q):
    """
    Preserve string quantities like '1 an', '1 ans', '1Mois'.
    For plain numeric values, append ' Mois' for 1-12.
    """
    if isinstance(q, str):
        return q.strip()
    try:
        fq = float(q)
        qi = int(fq) if fq == int(fq) else fq
        return f"{qi} Mois"
    except Exception:
        return str(q)


# ── Style sheet ───────────────────────────────────────────────────────────────

def _styles():
    base = getSampleStyleSheet()

    # The reference PDF uses a sans-serif font (Helvetica family in ReportLab)
    # for body text and Times-BoldItalic only for the big Facture title and
    # company name. We match this exactly.

    return {
        # ── Company header (top-right) ────────────────────────────────────────
        # "Universal Invest Strategy.SARL" — italic, navy blue, ~15pt
        "co_name": ParagraphStyle(
            "co_name",
            fontName="Times-BoldItalic",
            fontSize=15,
            textColor=BLUE,
            leading=19,
            alignment=TA_RIGHT,
        ),
        # Address / phone / email lines under company name
        "co_sub": ParagraphStyle(
            "co_sub",
            fontName="Helvetica",
            fontSize=8.5,
            textColor=colors.black,
            leading=11,
            alignment=TA_RIGHT,
        ),

        # ── Date line (italic underlined) ─────────────────────────────────────
        "date_lbl": ParagraphStyle(
            "date_lbl",
            fontName="Helvetica-Oblique",
            fontSize=8.5,
            textColor=colors.black,
            leading=11,
        ),

        # ── "Facture №62" big blue bold italic ───────────────────────────────
        "inv_title": ParagraphStyle(
            "inv_title",
            fontName="Times-BoldItalic",
            fontSize=28,
            textColor=BLUE,
            leading=30,
        ),

        # ── DESTINATAIRE block ────────────────────────────────────────────────
        "dest_label": ParagraphStyle(
            "dest_label",
            fontName="Helvetica-Oblique",
            fontSize=8.5,
            textColor=colors.black,
            leading=11,
            alignment=TA_RIGHT,
        ),
        "dest_value": ParagraphStyle(
            "dest_value",
            fontName="Helvetica-Bold",
            fontSize=9.5,
            textColor=colors.black,
            leading=12,
            alignment=TA_RIGHT,
        ),
        "dest_sub": ParagraphStyle(
            "dest_sub",
            fontName="Helvetica",
            fontSize=8.5,
            textColor=colors.black,
            leading=11,
            alignment=TA_RIGHT,
        ),

        # ── Items table ───────────────────────────────────────────────────────
        "table_hdr": ParagraphStyle(
            "table_hdr",
            fontName="Helvetica-Bold",
            fontSize=10,
            textColor=WHITE,
            alignment=TA_CENTER,
            leading=12,
        ),
        # Description column — left aligned
        "cell": ParagraphStyle(
            "cell",
            fontName="Helvetica",
            fontSize=9,
            leading=11,
            alignment=TA_CENTER,   # description is centred in the PDF
        ),
        # Quantity — centred
        "cell_c": ParagraphStyle(
            "cell_c",
            fontName="Helvetica",
            fontSize=9,
            leading=11,
            alignment=TA_CENTER,
        ),
        # Price / Total — right aligned
        "cell_r": ParagraphStyle(
            "cell_r",
            fontName="Helvetica",
            fontSize=9,
            leading=11,
            alignment=TA_RIGHT,
        ),

        # ── Summary rows (TOTAL HT / TVA / TTC) ──────────────────────────────
        "total_lbl": ParagraphStyle(
            "total_lbl",
            fontName="Helvetica-Bold",
            fontSize=9.5,
            leading=11.5,
            alignment=TA_RIGHT,
        ),
        "total_val": ParagraphStyle(
            "total_val",
            fontName="Helvetica-Bold",
            fontSize=9.5,
            leading=11.5,
            alignment=TA_RIGHT,
        ),
        # TTC row is slightly larger / bolder
        "ttc_lbl": ParagraphStyle(
            "ttc_lbl",
            fontName="Helvetica-Bold",
            fontSize=10,
            leading=12,
            alignment=TA_RIGHT,
        ),
        "ttc_val": ParagraphStyle(
            "ttc_val",
            fontName="Helvetica-Bold",
            fontSize=10,
            leading=12,
            alignment=TA_RIGHT,
        ),

        # ── "Arrêter la présente…" legal line ────────────────────────────────
        "arreter": ParagraphStyle(
            "arreter",
            fontName="Helvetica-Bold",
            fontSize=9,
            leading=11,
            alignment=TA_CENTER,
        ),

        # ── Footer bar ────────────────────────────────────────────────────────
        "footer": ParagraphStyle(
            "footer",
            fontName="Helvetica",
            fontSize=7.5,
            alignment=TA_CENTER,
            leading=9.5,
            textColor=colors.black,
        ),
    }


# ── Main PDF generator ────────────────────────────────────────────────────────

def generate_invoice_pdf(invoice) -> str:
    """
    Generate a PDF invoice matching the Universal Invest Strategy design.

    Parameters
    ----------
    invoice : object
        Must expose:
          .invoice_number  (str)
          .issue_date      (date | None)
          .subtotal        (Decimal/float)
          .tax_rate        (float, e.g. 20)
          .tax_amount      (Decimal/float)
          .total           (Decimal/float)
          .items           (iterable with .description, .quantity, .unit_price, .total)
          .client          (object with .profile, optional)
        Optional:
          .due_date
          .notes
          .service_start_date / .service_end_date / .duration_months

    Returns
    -------
    str – absolute path to the generated PDF file.
    """
    export_dir = ensure_export_dir()
    safe_number = re.sub(
        r"[^A-Za-z0-9_.-]+", "_",
        str(getattr(invoice, "invoice_number", "invoice"))
    )
    path = export_dir / f"{safe_number}.pdf"

    PAGE_W, PAGE_H = A4              # 595.27 × 841.89 pt
    L_MARGIN = R_MARGIN = 28         # ~1 cm margins left/right
    CONTENT_W = PAGE_W - L_MARGIN - R_MARGIN   # ≈ 539 pt

    # ── Footer content ───────────────────────────────────────────────────────
    footer_line1 = (
        f"{COMPANY['footer_address']}  ICE:{COMPANY['ice']}"
    )
    footer_line2 = (
        f"Télé:{COMPANY['mobile']}-Email: {COMPANY['email']}  "
        f"RC: {COMPANY['rc']}-patente: {COMPANY['patente']}"
        f"-IF: {COMPANY['if_number']}-CNSS:{COMPANY['cnss']}"
    )
    footer_html = f"{footer_line1}<br/>{footer_line2}"

    doc = SimpleDocTemplate(
        str(path), pagesize=A4,
        leftMargin=L_MARGIN, rightMargin=R_MARGIN,
        topMargin=18, bottomMargin=82,
    )
    ST = _styles()
    story = []

    # ─────────────────────────────────────────────────────────────────────────
    # 1. TOP HEADER: logo left | company name + info right
    # ─────────────────────────────────────────────────────────────────────────
    logo_cell: list = []
    if LOGO_PATH.exists():
        logo_cell.append(Image(str(LOGO_PATH), width=115, height=75))
    else:
        # Placeholder when logo not found
        logo_cell.append(Spacer(1, 75))

    co_cell = [
        Paragraph(
            '<font name="Times-BoldItalic" size="15" color="#173B57">'
            'Universal Invest Strategy.<i>SARL</i></font>',
            ST["co_name"],
        ),
        Paragraph(escape(COMPANY["address"]), ST["co_sub"]),
        Paragraph(COMPANY["phone"],           ST["co_sub"]),
        Paragraph(COMPANY["email"],           ST["co_sub"]),
    ]

    header_tbl = Table(
        [[logo_cell, co_cell]],
        colWidths=[CONTENT_W * 0.48, CONTENT_W * 0.52],
    )
    header_tbl.setStyle(TableStyle([
        ("VALIGN",        (0, 0), (-1, -1), "TOP"),
        ("ALIGN",         (1, 0), (1,  0),  "RIGHT"),
        ("LEFTPADDING",   (0, 0), (-1, -1), 0),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 0),
        ("TOPPADDING",    (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    story.append(header_tbl)
    story.append(Spacer(1, 16))

    # ─────────────────────────────────────────────────────────────────────────
    # 2. DATE / INVOICE NUMBER (left) | DESTINATAIRE (right)
    # ─────────────────────────────────────────────────────────────────────────
    raw_number = str(getattr(invoice, "invoice_number", ""))
    # Extract trailing numeric part: "FAC-2026-062" → "62"
    inv_num = raw_number.split("-")[-1].lstrip("0") or raw_number

    date_str = (
        invoice.issue_date.strftime("%d/%m/%Y")
        if getattr(invoice, "issue_date", None)
        else "__/__/____"
    )
    left_block = [
        Paragraph(f"<u><i>Date de facture: {date_str}</i></u>", ST["date_lbl"]),
    ]
    left_block += [
        Spacer(1, 10),
        Paragraph(f"Facture N°{inv_num}", ST["inv_title"]),
    ]

    # DESTINATAIRE block — same structure as reference:
    # only client company + ICE are variable.
    client_name = (client_display(invoice) or "CLIENT").upper()
    dest_lines = [
        Paragraph("<u><i>DESTINATAIRE:</i></u>", ST["dest_label"]),
        Spacer(1, 5),
        Paragraph(f"<b>{escape(client_name)}</b>", ST["dest_value"]),
    ]
    ice = client_ice(invoice)
    dest_lines.append(Paragraph(f"<b>ICE: {escape(ice or '')}</b>", ST["dest_value"]))

    mid_tbl = Table(
        [[left_block, dest_lines]],
        colWidths=[CONTENT_W * 0.5, CONTENT_W * 0.5],
    )
    mid_tbl.setStyle(TableStyle([
        ("VALIGN",        (0, 0), (-1, -1), "TOP"),
        ("ALIGN",         (1, 0), (1,  0),  "RIGHT"),
        ("LEFTPADDING",   (0, 0), (-1, -1), 0),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 0),
        ("TOPPADDING",    (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    story.append(mid_tbl)
    story.append(Spacer(1, 14))

    # ─────────────────────────────────────────────────────────────────────────
    # 3. ITEMS TABLE
    # ─────────────────────────────────────────────────────────────────────────
    COL_DESC  = CONTENT_W * 0.53
    COL_QTY   = CONTENT_W * 0.13
    COL_PRIX  = CONTENT_W * 0.17
    COL_TOTAL = CONTENT_W * 0.17

    # Header row
    hdr = [
        Paragraph("DÉSIGNATION", ST["table_hdr"]),
        Paragraph("QUANTITÉ",    ST["table_hdr"]),
        Paragraph("PRIX",        ST["table_hdr"]),
        Paragraph("TOTAL",       ST["table_hdr"]),
    ]

    # Row 0 = orange header
    # Row 1 = empty visual spacer row (matches the original PDF gap after header)
    data = [hdr, ["", "", "", ""]]

    items = list(getattr(invoice, "items", []) or [])
    if not items:
        items = [
            type("InvoiceLine", (), {
                "description": "Prestation de service",
                "quantity":    1,
                "unit_price":  getattr(invoice, "subtotal", 0) or 0,
                "total":       getattr(invoice, "subtotal", 0) or 0,
            })()
        ]

    for item in items:
        desc = escape(str(getattr(item, "description", "")))
        data.append([
            Paragraph(desc,                               ST["cell"]),
            Paragraph(quantity_display(item.quantity),    ST["cell_c"]),
            Paragraph(money(item.unit_price),             ST["cell_r"]),
            Paragraph(money(item.total),                  ST["cell_r"]),
        ])

    # Row index bookkeeping
    n_items      = len(items)
    spacer_top_r = 1
    first_item_r = 2
    last_item_r  = first_item_r + n_items - 1
    spacer_bot_r = last_item_r + 1
    ht_r         = spacer_bot_r + 1
    tva_r        = spacer_bot_r + 2
    ttc_r        = spacer_bot_r + 3

    data.append(["", "", "", ""])   # bottom spacer row

    tax_rate = getattr(invoice, "tax_rate", 20)

    data.append([
        "", "",
        Paragraph("TOTAL HT",                     ST["total_lbl"]),
        Paragraph(money(invoice.subtotal),          ST["total_val"]),
    ])
    data.append([
        "", "",
        Paragraph(f"TVA {tax_rate:g}%",            ST["total_lbl"]),
        Paragraph(money(invoice.tax_amount),        ST["total_val"]),
    ])
    data.append([
        "", "",
        Paragraph("Total TTC",                     ST["ttc_lbl"]),
        Paragraph(money(invoice.total),             ST["ttc_val"]),
    ])

    # Row heights — spacer rows are short, item rows taller
    row_heights = (
        [22, 6]                           # header + top spacer
        + [None] * n_items                # item rows (auto)
        + [6, None, None, None]           # bottom spacer + HT + TVA + TTC
    )

    items_tbl = Table(
        data,
        colWidths=[COL_DESC, COL_QTY, COL_PRIX, COL_TOTAL],
        rowHeights=row_heights,
    )

    items_tbl.setStyle(TableStyle([
        # ── Header row ──────────────────────────────────────────────────────
        ("BACKGROUND",    (0, 0),            (-1, 0),            ORANGE),
        ("FONTNAME",      (0, 0),            (-1, 0),            "Helvetica-Bold"),
        ("ALIGN",         (0, 0),            (-1, 0),            "CENTER"),
        ("TEXTCOLOR",     (0, 0),            (-1, 0),            WHITE),
        ("TOPPADDING",    (0, 0),            (-1, 0),            5),
        ("BOTTOMPADDING", (0, 0),            (-1, 0),            5),

        # ── Top spacer row — white, no borders ──────────────────────────────
        ("BACKGROUND",    (0, spacer_top_r), (-1, spacer_top_r), WHITE),
        ("LINEBELOW",     (0, spacer_top_r), (-1, spacer_top_r), 0, WHITE),
        ("LINEABOVE",     (0, spacer_top_r), (-1, spacer_top_r), 0, WHITE),

        # ── Item rows — thin orange border grid, white background ────────────
        ("BACKGROUND",    (0, first_item_r), (-1, last_item_r),  WHITE),
        ("GRID",          (0, first_item_r), (-1, last_item_r),  0.5, BORDER),
        ("TOPPADDING",    (0, first_item_r), (-1, last_item_r),  8),
        ("BOTTOMPADDING", (0, first_item_r), (-1, last_item_r),  8),
        ("LEFTPADDING",   (0, first_item_r), (-1, last_item_r),  8),
        ("RIGHTPADDING",  (0, first_item_r), (-1, last_item_r),  8),

        # ── Bottom spacer row — white ────────────────────────────────────────
        ("BACKGROUND",    (0, spacer_bot_r), (-1, spacer_bot_r), WHITE),
        ("LINEABOVE",     (0, spacer_bot_r), (-1, spacer_bot_r), 0.5, BORDER),
        ("LINEBELOW",     (0, spacer_bot_r), (-1, spacer_bot_r), 0, WHITE),

        # ── TOTAL HT row — light grey background, thin grey grid ────────────
        ("BACKGROUND",    (2, ht_r),         (-1, ht_r),         LGREY),
        ("GRID",          (2, ht_r),         (-1, ht_r),         0.4, BORDER_GREY),
        ("TOPPADDING",    (2, ht_r),         (-1, ht_r),         6),
        ("BOTTOMPADDING", (2, ht_r),         (-1, ht_r),         6),
        ("RIGHTPADDING",  (2, ht_r),         (-1, ht_r),         8),
        ("LEFTPADDING",   (2, ht_r),         (-1, ht_r),         8),

        # ── TVA row ─────────────────────────────────────────────────────────
        ("BACKGROUND",    (2, tva_r),        (-1, tva_r),        LGREY),
        ("GRID",          (2, tva_r),        (-1, tva_r),        0.4, BORDER_GREY),
        ("TOPPADDING",    (2, tva_r),        (-1, tva_r),        6),
        ("BOTTOMPADDING", (2, tva_r),        (-1, tva_r),        6),
        ("RIGHTPADDING",  (2, tva_r),        (-1, tva_r),        8),
        ("LEFTPADDING",   (2, tva_r),        (-1, tva_r),        8),

        # ── TTC row — light grey + bold orange box border ────────────────────
        ("BACKGROUND",    (2, ttc_r),        (-1, ttc_r),        LGREY),
        ("BOX",           (2, ttc_r),        (-1, ttc_r),        1.8, ORANGE),
        ("FONTNAME",      (2, ttc_r),        (-1, ttc_r),        "Helvetica-Bold"),
        ("TOPPADDING",    (2, ttc_r),        (-1, ttc_r),        7),
        ("BOTTOMPADDING", (2, ttc_r),        (-1, ttc_r),        7),
        ("RIGHTPADDING",  (2, ttc_r),        (-1, ttc_r),        8),
        ("LEFTPADDING",   (2, ttc_r),        (-1, ttc_r),        8),

        # ── Global alignment ─────────────────────────────────────────────────
        ("VALIGN",        (0, 0),            (-1, -1),           "MIDDLE"),
        ("ALIGN",         (0, 0),            (0, -1),            "LEFT"),
        ("ALIGN",         (1, first_item_r), (1, last_item_r),   "CENTER"),
        ("ALIGN",         (2, first_item_r), (-1, -1),           "RIGHT"),

        # ── Clear padding for empty cells (spacer rows, HT/TVA left cols) ────
        ("TOPPADDING",    (0, spacer_top_r), (-1, spacer_top_r), 0),
        ("BOTTOMPADDING", (0, spacer_top_r), (-1, spacer_top_r), 0),
        ("TOPPADDING",    (0, spacer_bot_r), (-1, spacer_bot_r), 0),
        ("BOTTOMPADDING", (0, spacer_bot_r), (-1, spacer_bot_r), 0),
    ]))

    story.append(items_tbl)
    story.append(Spacer(1, 18))

    # ─────────────────────────────────────────────────────────────────────────
    # 4. LEGAL AMOUNT LINE
    # ─────────────────────────────────────────────────────────────────────────
    story.append(Paragraph(
        f"<u><b>{escape(amount_in_words(invoice.total))}</b></u>",
        ST["arreter"],
    ))

    story.append(Spacer(1, 40))

    # ─────────────────────────────────────────────────────────────────────────
    # 5. FOOTER  (drawn on canvas so it's always pinned to page bottom)
    # ─────────────────────────────────────────────────────────────────────────
    footer_data = [[Paragraph(footer_html, ST["footer"])]]
    footer_tbl  = Table(footer_data, colWidths=[CONTENT_W])
    footer_tbl.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, -1), ORANGE_LIGHT),
        ("BOX",           (0, 0), (-1, -1), 0.5, BORDER),
        ("TOPPADDING",    (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING",   (0, 0), (-1, -1), 8),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 8),
    ]))

    def _draw_fixed_footer(canvas, _doc):
        canvas.saveState()
        fw, fh = footer_tbl.wrap(CONTENT_W, 60)
        footer_tbl.drawOn(canvas, L_MARGIN, 18)
        canvas.restoreState()

    doc.build(story, onFirstPage=_draw_fixed_footer, onLaterPages=_draw_fixed_footer)
    return str(path)


# ── Quick test / standalone demo ─────────────────────────────────────────────
if __name__ == "__main__":
    """
    Run:  python invoice_exports_v2.py
    Generates uploads/invoices/FAC-DEMO-2026-062.pdf using dummy data
    that exactly mirrors the original Facture №62 structure.
    """
    from datetime import date

    class FakeLine:
        def __init__(self, desc, qty, unit, total):
            self.description = desc
            self.quantity    = qty
            self.unit_price  = unit
            self.total       = total

    class FakeProfile:
        company_name = "NEPTUNE LOGISTIQUE SCE SARL AU"
        company_ice  = "003605260000002"
        company_rc   = ""
        company_if   = ""
        address      = ""
        phone        = ""
        email        = ""
        first_name   = ""
        last_name    = ""

    class FakeClient:
        profile = FakeProfile()
        email   = ""

    class FakeInvoice:
        invoice_number = "FAC-DEMO-2026-062"
        issue_date     = date(2025, 9, 4)
        due_date       = None
        subtotal       = 3750.00
        tax_rate       = 20
        tax_amount     = 750.00
        total          = 4500.00
        notes          = None
        client         = FakeClient()
        items          = [
            FakeLine("Déclaration TVA Mensuel 4ème Trimestre 2024", 1,       750.00,  750.00),
            FakeLine("Déclaration TVA Mensuel 1ère Trimestre 2025", "1Mois", 750.00,  750.00),
            FakeLine("Préstation Bilan",                            "1 ans", 1500.00, 1500.00),
            FakeLine("Etat 9421",                                   "1 an",  750.00,  750.00),
        ]
        service_start_date = None
        service_end_date   = None
        duration_months    = None

    out = generate_invoice_pdf(FakeInvoice())
    print(f"✅  PDF generated → {out}")