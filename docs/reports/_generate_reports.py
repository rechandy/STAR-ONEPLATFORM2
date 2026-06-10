# -*- coding: utf-8 -*-
"""
Generates three executive PDF deliverables for taking the STAR OnePlatform
PROTOTYPE to a deployable, production MVP covering four capability areas:
  (1) Teacher Onboarding & Setup  (2) Planning & Orchestration
  (3) Assignment & Progress       (4) Admin & Leadership View

  1. Task Plan (prototype -> production MVP)
  2. Budget Estimate (ROM)
  3. Production Readiness Assessment (board level)

Team baseline: Tech Lead (you) + 3 developers + 1 QA analyst (5 people).
Basis: build telemetry through commit 7af2303.
"""
import os
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.lib.colors import HexColor
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak,
    HRFlowable, KeepTogether, Flowable,
)

OUT = os.path.dirname(os.path.abspath(__file__))
DATE = "June 10, 2026"
BASIS = "Build telemetry through commit 7af2303"

BRAND = HexColor("#0b5cab"); INK = HexColor("#0a2540"); MUTED = HexColor("#5b6b7b")
LIGHT = HexColor("#f1f5fa"); LINE = HexColor("#d7e0ea"); ZEBRA = HexColor("#f7fafc"); WHITE = colors.white
G_FG, G_BG = HexColor("#1a7f37"), HexColor("#e3f5e9")
A_FG, A_BG = HexColor("#9a6400"), HexColor("#fff4e0")
R_FG, R_BG = HexColor("#b00020"), HexColor("#fdeaea")
B_BG2 = HexColor("#cdddf7")

ss = getSampleStyleSheet()
def style(name, **kw):
    kw.setdefault("parent", ss["Normal"]); return ParagraphStyle(name, **kw)

H1 = style("H1", fontName="Helvetica-Bold", fontSize=15, textColor=BRAND, spaceBefore=15, spaceAfter=6, leading=18)
H2 = style("H2", fontName="Helvetica-Bold", fontSize=11, textColor=INK, spaceBefore=10, spaceAfter=4, leading=14)
BODY = style("Body", fontName="Helvetica", fontSize=9.3, textColor=INK, leading=13.5, spaceAfter=6)
SMALL = style("Small", fontName="Helvetica", fontSize=8, textColor=MUTED, leading=10.5)
BULLET = style("Bullet", parent=BODY, leftIndent=12, spaceAfter=3)
TH = style("TH", fontName="Helvetica-Bold", fontSize=8.3, textColor=WHITE, leading=10.5)
TD = style("TD", fontName="Helvetica", fontSize=8.2, textColor=INK, leading=10.8)
TDB = style("TDB", fontName="Helvetica-Bold", fontSize=8.2, textColor=INK, leading=10.8)
TDM = style("TDM", fontName="Helvetica", fontSize=7.7, textColor=MUTED, leading=9.8)
TDC = style("TDC", parent=TD, alignment=TA_CENTER)
TDR = style("TDR", parent=TD, alignment=TA_RIGHT)
TDRB = style("TDRB", parent=TDB, alignment=TA_RIGHT)
COVTITLE = style("CovTitle", fontName="Helvetica-Bold", fontSize=27, textColor=INK, leading=31)
COVSUB = style("CovSub", fontName="Helvetica", fontSize=12.5, textColor=MUTED, leading=17)

def esc(t): return str(t).replace("&","&amp;").replace("<","&lt;").replace(">","&gt;")
def P(t, s=BODY): return Paragraph(esc(t), s)
def Praw(t, s=BODY): return Paragraph(t, s)
def bullets(items, s=BULLET): return [Paragraph("•  " + esc(x), s) for x in items]
def rule(c=LINE, w=0.7, sb=2, sa=6): return HRFlowable(width="100%", thickness=w, color=c, spaceBefore=sb, spaceAfter=sa)

def status_cell(label, kind):
    fg = {"G": G_FG, "A": A_FG, "R": R_FG}[kind]
    return Paragraph(f'<b>{esc(label)}</b>', style("st", fontName="Helvetica-Bold", fontSize=7.4, textColor=fg, alignment=TA_CENTER, leading=9))

class CoverBand(Flowable):
    def __init__(self, width, height=70): super().__init__(); self.width=width; self.height=height
    def draw(self):
        c=self.canv; c.setFillColor(BRAND); c.rect(0,0,self.width,self.height,fill=1,stroke=0)
        c.setFillColor(WHITE); c.setFont("Helvetica-Bold",30); c.drawString(8,22,"★")
        c.setFont("Helvetica-Bold",16); c.drawString(44,26,"STAR OnePlatform")
        c.setFont("Helvetica",9.5); c.drawString(44,11,"Unified Curriculum & Assessment Platform")

def make_footer(short):
    def footer(canvas, doc):
        canvas.saveState(); pn=canvas.getPageNumber()
        if pn>1:
            canvas.setStrokeColor(LINE); canvas.setLineWidth(0.6)
            canvas.line(0.8*inch,0.62*inch,letter[0]-0.8*inch,0.62*inch)
            canvas.setFont("Helvetica",7.5); canvas.setFillColor(MUTED)
            canvas.drawString(0.8*inch,0.46*inch,"STAR OnePlatform  ·  "+short)
            canvas.drawRightString(letter[0]-0.8*inch,0.46*inch,"Confidential  ·  Page %d"%pn)
        canvas.restoreState()
    return footer

def cover(title_lines, subtitle, meta_rows):
    el=[Spacer(1,6), CoverBand(letter[0]-1.6*inch), Spacer(1,70)]
    for ln in title_lines: el.append(Paragraph(esc(ln), COVTITLE))
    el.append(Spacer(1,12)); el.append(Paragraph(esc(subtitle), COVSUB)); el.append(Spacer(1,28))
    data=[[Paragraph(f"<b>{esc(k)}</b>", style("mk",fontName="Helvetica-Bold",fontSize=9,textColor=BRAND)),
           Paragraph(esc(v), style("mv",fontName="Helvetica",fontSize=9,textColor=INK))] for k,v in meta_rows]
    t=Table(data,colWidths=[1.7*inch,4.2*inch])
    t.setStyle(TableStyle([("VALIGN",(0,0),(-1,-1),"TOP"),("TOPPADDING",(0,0),(-1,-1),4),
        ("BOTTOMPADDING",(0,0),(-1,-1),4),("LINEBELOW",(0,0),(-1,-2),0.4,LINE),("LEFTPADDING",(0,0),(-1,-1),0)]))
    el.append(t); el.append(Spacer(1,24)); el.append(HRFlowable(width="100%",thickness=2,color=BRAND)); el.append(Spacer(1,6))
    el.append(Paragraph("CONFIDENTIAL — Prepared for internal planning &amp; deployment approval. "
        "Estimates are rough-order-of-magnitude planning figures, not commitments.",
        style("cf",fontName="Helvetica-Oblique",fontSize=8,textColor=MUTED)))
    el.append(PageBreak()); return el

def make_table(header, rows, col_widths, font=TD, align=None, zebra=True, header_bg=BRAND):
    data=[[Paragraph(f'<b>{esc(h)}</b>', TH) for h in header]]
    for r in rows:
        data.append([c if isinstance(c,Paragraph) else Paragraph(esc(c),font) for c in r])
    t=Table(data,colWidths=col_widths,repeatRows=1)
    cmds=[("BACKGROUND",(0,0),(-1,0),header_bg),("VALIGN",(0,0),(-1,-1),"MIDDLE"),
        ("TOPPADDING",(0,0),(-1,-1),5),("BOTTOMPADDING",(0,0),(-1,-1),5),
        ("LEFTPADDING",(0,0),(-1,-1),6),("RIGHTPADDING",(0,0),(-1,-1),6),
        ("LINEBELOW",(0,0),(-1,-1),0.4,LINE),("LINEAFTER",(0,0),(-2,-1),0.3,LINE),("BOX",(0,0),(-1,-1),0.6,LINE)]
    if zebra:
        for i in range(1,len(data)):
            if i%2==0: cmds.append(("BACKGROUND",(0,i),(-1,i),ZEBRA))
    if align:
        for col,a in align.items(): cmds.append(("ALIGN",(col,1),(col,-1),a))
    t.setStyle(TableStyle(cmds)); return t

def build(filename, short, story, subject):
    doc=SimpleDocTemplate(os.path.join(OUT,filename),pagesize=letter,leftMargin=0.8*inch,rightMargin=0.8*inch,
        topMargin=0.7*inch,bottomMargin=0.8*inch,title=short,author="STAR OnePlatform",subject=subject)
    f=make_footer(short); doc.build(story,onFirstPage=f,onLaterPages=f); print("wrote",filename)

CW = letter[0]-1.6*inch

# MVP capability scope (shared) -----------------------------------------------
def mvp_table():
    rows=[
        [Paragraph("<b>1 · Teacher Onboarding &amp; Setup</b>",TDB), Paragraph(esc("Sign-in, roster sync, classroom context, initial setup"),TD),
         status_cell("PARTIAL","A"), Paragraph(esc("Real IAM/SSO, live Clever/ClassLink sync + dedup, MFA, setup flows"),TDM)],
        [Paragraph("<b>2 · Planning &amp; Orchestration</b>",TDB), Paragraph(esc("Identify needs, surface next-best actions, suggest schedule"),TD),
         status_cell("NET-NEW","R"), Paragraph(esc("New orchestration service: needs engine + scheduling over progress data"),TDM)],
        [Paragraph("<b>3 · Assignment &amp; Progress</b>",TDB), Paragraph(esc("Assign activities, view student progress, connect data to platform"),TD),
         status_cell("VALIDATED","G"), Paragraph(esc("Harden & scale the proven teacher loop; broaden activity types"),TDM)],
        [Paragraph("<b>4 · Admin &amp; Leadership View</b>",TDB), Paragraph(esc("Usage visibility, operational dashboard, reporting"),TD),
         status_cell("PARTIAL","A"), Paragraph(esc("New reporting/analytics service + usage telemetry + dashboards"),TDM)],
    ]
    return make_table(["MVP capability","Scope","Status","Production gap"],rows,
                      [1.45*inch,1.7*inch,0.95*inch,2.0*inch])

# ===========================================================================
# DOC 1 — TASK PLAN
# ===========================================================================
def doc_tasks():
    s=[]
    s+=cover(["Task Plan", "Prototype → Production MVP"],
        "How to take the validated STAR OnePlatform prototype to a deployable, "
        "production MVP across four teacher- and leadership-facing capabilities.",
        [("Document","1 of 3 — Task Plan"),("Date",DATE),("Basis",BASIS),
         ("Team","Tech Lead (you) + 3 developers + 1 QA analyst"),
         ("Target","Deployable production MVP (4 capability areas)"),
         ("Estimated timeline","~8 months (range 7–9)")])

    s.append(P("1. Executive summary",H1)); s.append(rule(BRAND,1.2))
    s.append(P("The prototype has already retired the hardest technical risk: a working, event-driven "
        "teacher loop in which an offline-captured assessment session syncs, flows over a Kafka event "
        "backbone, and automatically advances curriculum in a separate service — verified live and in a "
        "real browser. This plan takes that prototype to a deployable production MVP covering four "
        "capabilities, with a five-person team, in approximately eight months."))
    s.append(P("The MVP is deliberately scoped. One capability (Assignment & Progress) is essentially proven "
        "and needs hardening; two (Onboarding & Setup, Admin & Leadership View) are partially built and need "
        "production identity, roster sync, and a reporting surface; one (Planning & Orchestration) is net-new "
        "but bounded to rules-and-heuristics for the MVP. Surrounding all four is the production-readiness work "
        "— cloud platform, security, FERPA compliance, CI/CD, and monitoring — detailed in Document 3."))
    s.append(P("MVP capability scope:",H2)); s.append(mvp_table())
    s.append(Spacer(1,3))
    s.append(Praw('<font size=7.5 color="#5b6b7b">'
        '<font color="#1a7f37"><b>VALIDATED</b></font> proven in the prototype · '
        '<font color="#9a6400"><b>PARTIAL</b></font> partly built · '
        '<font color="#b00020"><b>NET-NEW</b></font> to be built.</font>', SMALL))

    s.append(PageBreak())
    s.append(P("2. Major workstreams",H1)); s.append(rule(BRAND,1.2))
    rows=[
        ["WS-A","Production platform foundation","Terraform landing zone, EKS, CI/CD, observability, secrets/security baseline","Tech Lead + Dev 1"],
        ["WS-B","Onboarding & identity (Cap 1)","IAM/SSO (Cognito, Clever/ClassLink, SAML/LTI), roster sync + dedup, setup flows","Dev 1 + Dev 2"],
        ["WS-C","Assignment & progress (Cap 3)","Productionize the teacher loop; scale events; activity types; offline sync gateway","Dev 2 + Dev 3"],
        ["WS-D","Planning & orchestration (Cap 2)","Needs-identification + next-best-action (rules) + schedule suggestions","Dev 2 + Tech Lead"],
        ["WS-E","Admin & leadership view (Cap 4)","Usage telemetry, operational dashboards, reporting service & exports","Dev 3"],
        ["WS-F","Security, privacy & FERPA","Encryption, authz, secrets, FERPA controls, pen test, SOC 2 readiness","Tech Lead (cross-cutting)"],
        ["WS-G","Quality, accessibility & UAT","Test automation, e2e/contract, WCAG, load testing, pilot UAT","QA Analyst + all"],
    ]
    s.append(make_table(["ID","Workstream","Scope","Primary owners"],rows,
        [0.45*inch,1.75*inch,2.85*inch,1.35*inch]))

    s.append(P("3. Sequencing & timeline",H1)); s.append(rule(BRAND,1.2))
    s.append(P("Eight-month plan for the five-person team. Foundation and identity lead; the proven "
        "Assignment/Progress loop is hardened early to free capacity for the net-new Planning/Orchestration "
        "and Admin work; security, FERPA and QA run continuously and gate launch.",BODY))
    s.append(KeepTogether([gantt_mvp(), Spacer(1,5),
        Praw('<font size=7.5 color="#5b6b7b"><font color="#0b5cab">■</font> primary build  ·  '
             '<font color="#cdddf7">■</font> continuous / ramp  ·  MVP production deploy at end of M8.</font>', SMALL)]))

    s.append(P("4. Role allocation",H1)); s.append(rule(BRAND,1.2))
    rows=[
        ["Tech Lead / Principal Eng (you)","Architecture, cloud platform & infra, security & FERPA, IAM design, orchestration logic, code review, release owner"],
        ["Developer 1 — Backend / Data","Roster sync connectors, data-engine hardening, DB-per-service split, event backbone, service APIs"],
        ["Developer 2 — Full-stack","Onboarding/setup flows, Assignment/Progress hardening, Planning/Orchestration engine"],
        ["Developer 3 — Frontend / Full-stack","Web shell, Admin/Leadership dashboards & reporting UI, offline/PWA, accessibility implementation"],
        ["QA Analyst","Test strategy & automation, e2e/contract tests, accessibility (axe), load-test coordination, UAT"],
    ]
    s.append(make_table(["Role","Responsibilities"],rows,[2.0*inch,4.4*inch]))

    s.append(PageBreak())
    s.append(P("5. Milestones",H1)); s.append(rule(BRAND,1.2))
    rows=[
        ["M1","Production foundation live","CI/CD commit→prod, IaC landing zone, observability + secrets baseline"],
        ["M2","Identity + first live roster","Real SSO; a pilot district roster syncs from Clever/ClassLink into the graph (Cap 1 alpha)"],
        ["M3","Hardened teacher loop","Assignment/Progress productionized in staging under load (Cap 3)"],
        ["M4","Planning/Orchestration alpha","Next-best-action + schedule suggestions over progress data (Cap 2)"],
        ["M5","Admin/Leadership dashboards","Usage + operational reporting feature-complete (Cap 4)"],
        ["M6","Security & compliance gate","FERPA controls, encryption/secrets, pen test & WCAG audit passed"],
        ["M7","Pilot UAT","One district end-to-end on production infra; defect burn-down"],
        ["M8","Production MVP deploy","Go-live to initial cohort; on-call, runbooks, status page in place"],
    ]
    s.append(make_table(["#","Milestone","Exit criteria"],rows,[0.4*inch,1.85*inch,4.15*inch]))

    s.append(P("6. Key assumptions",H1)); s.append(rule(BRAND,1.2))
    s+=bullets([
        "The validated event backbone and teacher loop are reused as-is — no architectural redesign.",
        "Clever/ClassLink sandbox access and signed data-sharing agreements (DPAs) are available by week 2.",
        "A committed pilot district with a known roster source is identified before M2.",
        "“Next-best-action” for the MVP is rules/heuristics over existing progress data — not a trained ML model.",
        "Brand and accessibility design tokens are delivered early in the engagement.",
        "MVP launches to a pilot cohort first, then ramps toward the 2,500-district / 25,000-teacher initial target.",
    ])
    s.append(P("7. Key risks",H1)); s.append(rule(BRAND,1.2))
    rows=[
        ["Lean team vs. four capabilities + hardening","High","Strict scope discipline; reuse the proven loop; defer non-MVP activity types; consider fractional security/design help"],
        ["Planning/Orchestration is net-new","Med","Constrain to rules/heuristics; ship thin, iterate; timebox the needs engine"],
        ["FERPA / pen test timing gates launch","High","Start compliance week 1; engage privacy counsel & pen-test vendor early"],
        ["Roster connector / identity dedup complexity","Med","Confidence-scored matching + admin review queue; pilot with one clean source first"],
        ["Accessibility treated as polish","High","Design a11y-in; axe gates in CI; audit before launch (special-education audience)"],
        ["Key-person risk on the lead","Med","Document decisions (ADRs); pair on critical paths; cross-train developers"],
    ]
    s.append(make_table(["Risk","Sev.","Mitigation"],rows,[2.0*inch,0.55*inch,3.85*inch]))
    build("STAR-OnePlatform-01-Task-Plan.pdf","Task Plan — Prototype to Production MVP",s,"Prototype-to-production MVP plan")

def gantt_mvp():
    months=["M1","M2","M3","M4","M5","M6","M7","M8"]
    plan=[
        ("WS-A · Platform foundation",      [1,1,2,0,0,0,0,0]),
        ("WS-B · Onboarding & identity (C1)",[2,1,1,1,0,0,0,0]),
        ("WS-C · Assignment & progress (C3)",[0,1,1,1,0,0,0,0]),
        ("WS-D · Planning/orchestr. (C2)",  [0,0,1,1,1,0,0,0]),
        ("WS-E · Admin & leadership (C4)",   [0,0,0,1,1,1,0,0]),
        ("WS-F · Security / FERPA",          [2,2,2,2,1,1,1,0]),
        ("WS-G · QA, a11y & UAT",            [0,2,2,2,2,1,1,1]),
        ("Pilot UAT → production deploy",    [0,0,0,0,0,0,2,1]),
    ]
    data=[[Paragraph(f'<b>{esc(h)}</b>',TH) for h in ["Workstream"]+months]]
    for name,cells in plan: data.append([Paragraph(esc(name),TD)]+[""]*len(cells))
    label_w=2.0*inch; mcol=(CW-label_w)/8.0
    t=Table(data,colWidths=[label_w]+[mcol]*8,repeatRows=1)
    cmds=[("BACKGROUND",(0,0),(-1,0),BRAND),("VALIGN",(0,0),(-1,-1),"MIDDLE"),("ALIGN",(1,0),(-1,-1),"CENTER"),
        ("TOPPADDING",(0,0),(-1,-1),5),("BOTTOMPADDING",(0,0),(-1,-1),5),("LEFTPADDING",(0,0),(-1,-1),6),
        ("BOX",(0,0),(-1,-1),0.6,LINE),("INNERGRID",(0,0),(-1,-1),0.4,LINE)]
    for r,(_,cells) in enumerate(plan,start=1):
        for c,v in enumerate(cells,start=1):
            if v==1: cmds.append(("BACKGROUND",(c,r),(c,r),BRAND))
            elif v==2: cmds.append(("BACKGROUND",(c,r),(c,r),B_BG2))
    t.setStyle(TableStyle(cmds)); return t

# ===========================================================================
# DOC 2 — BUDGET (ROM)
# ===========================================================================
def money(n): return "$"+format(int(round(n)),",")

def doc_budget():
    s=[]
    s+=cover(["Budget Estimate","Prototype → Production MVP"],
        "A rough-order-of-magnitude (ROM) budget to deliver the production MVP "
        "with a five-person team, plus the steady-state run-rate at initial scale.",
        [("Document","2 of 3 — Budget Estimate (ROM)"),("Date",DATE),("Basis",BASIS),
         ("Team","5 people: Tech Lead + 3 developers + 1 QA"),
         ("Duration","~8 months to deployable MVP"),
         ("ROM build cost","~$1.2M (±25%)"),
         ("Steady-state run-rate","~$1.85M / yr at initial scale")])

    s.append(P("1. Summary",H1)); s.append(rule(BRAND,1.2))
    s.append(P("This is a rough-order-of-magnitude estimate (±25%) to take the prototype to a deployable "
        "production MVP, followed by the annual cost to operate it at the initial target scale of 2,500 "
        "districts / 25,000 teachers. Personnel dominates the build; infrastructure and compliance are the "
        "next largest lines. All figures are 2026 USD."))
    rows=[
        ["Build-to-MVP (ROM, ~8 months)", money(1240000), "One-time program cost to first production deploy"],
        ["Steady-state run-rate (per year)", money(1850000)+" / yr", "Ongoing team + production operations at initial scale"],
        ["Production infrastructure (initial scale)", money(360000)+" / yr", money(30000)+"/mo; scales with usage"],
        ["Blended loaded labor rate", "~"+money(108)+" / hr", money(225000)+"/yr per head, 5-person team"],
        ["Unit economics — all-in / teacher", "~"+money(74)+" / yr", "Run-rate ÷ 25,000 teachers"],
    ]
    s.append(make_table(["Headline","Amount","Notes"],rows,[2.5*inch,1.5*inch,2.4*inch],align={1:"RIGHT"}))
    s.append(Spacer(1,3))
    s.append(Praw('<font size=8 color="#9a6400"><b>ROM basis:</b> intended for budget approval and sizing, '
        'not a fixed bid. Largest sensitivities: roster-connector complexity, Planning/Orchestration scope, '
        'and compliance timing.</font>', SMALL))

    s.append(P("2. Assumptions",H1)); s.append(rule(BRAND,1.2))
    s+=bullets([
        "Five-person core team for ~8 months; US-based; fully-loaded cost = base × 1.4 (benefits, taxes, overhead, tooling).",
        "MVP scope = the four capability areas; reuse of the validated event backbone and teacher loop.",
        "AWS, single US region, multi-AZ; production sized for initial scale, ramping in the final ~3 months of the build.",
        "Compliance scope for launch: FERPA/COPPA controls, SOC 2 readiness, penetration test, WCAG 2.1 AA audit.",
        "Excludes sales, marketing, G&A, customer support org, and curriculum/media content production.",
    ])

    s.append(P("3. Personnel",H1)); s.append(rule(BRAND,1.2))
    rows=[
        ["Tech Lead / Principal Engineer (you)","1",money(205000),money(287000),money(191000)],
        ["Senior Developer","3",money(160000),money(224000),money(448000)],
        ["QA Analyst","1",money(115000),money(161000),money(107000)],
    ]
    rows.append([Paragraph("<b>Team total</b>",TDB),Paragraph("<b>5</b>",TDB),
        Paragraph("<b>blended "+money(108)+"/hr</b>",TDB),Paragraph("<b>"+money(1120000)+" / yr</b>",TDRB),
        Paragraph("<b>"+money(746000)+"</b>",TDRB)])
    s.append(make_table(["Role","FTE","Base","Loaded / yr","8-mo cost"],rows,
        [2.25*inch,0.45*inch,0.95*inch,1.15*inch,1.05*inch],align={1:"CENTER",2:"RIGHT",3:"RIGHT",4:"RIGHT"}))
    s.append(Spacer(1,3))
    s.append(Praw('<font size=8 color="#5b6b7b">Blended loaded rate = total annual loaded cost (' +
        money(1120000) + ') ÷ 5 ÷ 2,080 hrs ≈ ' + money(108) + '/hr.</font>', SMALL))

    s.append(P("4. Infrastructure & tooling (build phase)",H1)); s.append(rule(BRAND,1.2))
    rows=[
        ["Dev + staging + CI cloud (8 mo)",money(40000),"~"+money(5000)+"/mo"],
        ["Production environment ramp (final ~3 mo)",money(45000),"Pre-launch prod stand-up"],
        ["Developer & ops tooling (GitHub, IDEs, etc.)",money(18000),"Per-seat SaaS"],
        ["Observability & error tracking (build)",money(14000),"APM, logging, Sentry"],
    ]
    rows.append([Paragraph("<b>Subtotal</b>",TDB),Paragraph("<b>"+money(117000)+"</b>",TDRB),""])
    s.append(make_table(["Item","Cost","Notes"],rows,[3.0*inch,1.1*inch,1.9*inch],align={1:"RIGHT"}))

    s.append(P("5. Third-party services & licenses (build phase)",H1)); s.append(rule(BRAND,1.2))
    rows=[
        ["Clever / ClassLink certification & partnership",money(20000),"Roster SSO + sync"],
        ["Email / SMS (SES / SNS)",money(6000),"Notifications"],
        ["MDM (Jamf) for managed iPad Web Clip",money(8000),"Device distribution"],
        ["Productivity & design SaaS (Figma, etc.)",money(8000),"Team tooling"],
        ["Security tooling (SBOM, dep/secret scanning)",money(12000),"Supply-chain"],
    ]
    rows.append([Paragraph("<b>Subtotal</b>",TDB),Paragraph("<b>"+money(54000)+"</b>",TDRB),""])
    s.append(make_table(["Service / license","Cost","Purpose"],rows,[3.0*inch,1.1*inch,1.9*inch],align={1:"RIGHT"}))

    s.append(PageBreak())
    s.append(P("6. Compliance & professional services (pre-launch)",H1)); s.append(rule(BRAND,1.2))
    rows=[
        ["Privacy & legal counsel (FERPA/COPPA, DPAs, ToS)",money(30000)],
        ["SOC 2 readiness assessment",money(25000)],
        ["Penetration test (pre-launch)",money(25000)],
        ["WCAG 2.1 AA / Section 508 audit",money(15000)],
    ]
    rows.append([Paragraph("<b>Subtotal</b>",TDB),Paragraph("<b>"+money(95000)+"</b>",TDRB)])
    s.append(make_table(["Item","Cost"],rows,[4.5*inch,1.4*inch],align={1:"RIGHT"}))

    s.append(P("7. One-time & capital",H1)); s.append(rule(BRAND,1.2))
    rows=[["Brand & accessibility design tokens",money(15000)],
          ["Test devices (iPads + MDM enrollment)",money(10000)]]
    rows.append([Paragraph("<b>Subtotal</b>",TDB),Paragraph("<b>"+money(25000)+"</b>",TDRB)])
    s.append(make_table(["Item","Cost"],rows,[4.5*inch,1.4*inch],align={1:"RIGHT"}))

    s.append(P("8. Build-to-MVP total (ROM)",H1)); s.append(rule(BRAND,1.2))
    rows=[["Personnel (5 people, 8 months)",money(746000)],
          ["Infrastructure & tooling (build)",money(117000)],
          ["Third-party services & licenses",money(54000)],
          ["Compliance & professional services",money(95000)],
          ["One-time & capital",money(25000)],
          ["Subtotal",money(1037000)],
          ["Contingency (20%, ROM)",money(207000)]]
    body=[]
    for label,amt in rows:
        b=label=="Subtotal"
        body.append([Paragraph(("<b>"+esc(label)+"</b>") if b else esc(label),TDB if b else TD),
                     Paragraph(("<b>"+amt+"</b>") if b else amt,TDRB if b else TDR)])
    body.append([Paragraph("<b>Build-to-MVP total (ROM)</b>",style("t",fontName="Helvetica-Bold",fontSize=10,textColor=BRAND)),
                 Paragraph("<b>~"+money(1244000)+"</b>",style("tr",fontName="Helvetica-Bold",fontSize=10,textColor=BRAND,alignment=TA_RIGHT))])
    t=Table(body,colWidths=[4.4*inch,1.5*inch])
    t.setStyle(TableStyle([("LINEBELOW",(0,0),(-1,-2),0.4,LINE),("LINEABOVE",(0,-1),(-1,-1),1.2,BRAND),
        ("TOPPADDING",(0,0),(-1,-1),5),("BOTTOMPADDING",(0,0),(-1,-1),5),("BACKGROUND",(0,-1),(-1,-1),LIGHT)]))
    s.append(t)
    s.append(Spacer(1,4))
    s.append(Praw("<font size=8.5 color='#0a2540'><b>Duration:</b> ~8 months to first production deploy "
        "(range 7–9 months depending on roster-connector and compliance timing).</font>", BODY))

    s.append(P("9. Steady-state run-rate (post-MVP, per year)",H1)); s.append(rule(BRAND,1.2))
    rows=[["Personnel (5 people, ongoing)",money(1120000)],
          ["Production infrastructure (initial scale)",money(360000)],
          ["Third-party services & licenses",money(65000)],
          ["Compliance (renewals, pen test, tooling)",money(60000)],
          ["Subtotal",money(1605000)],
          ["Contingency (15%)",money(241000)]]
    body=[]
    for label,amt in rows:
        b=label=="Subtotal"
        body.append([Paragraph(("<b>"+esc(label)+"</b>") if b else esc(label),TDB if b else TD),
                     Paragraph(("<b>"+amt+"</b>") if b else amt,TDRB if b else TDR)])
    body.append([Paragraph("<b>Annual run-rate</b>",style("t2",fontName="Helvetica-Bold",fontSize=10,textColor=BRAND)),
                 Paragraph("<b>~"+money(1846000)+" / yr</b>",style("t2r",fontName="Helvetica-Bold",fontSize=10,textColor=BRAND,alignment=TA_RIGHT))])
    t=Table(body,colWidths=[4.4*inch,1.5*inch])
    t.setStyle(TableStyle([("LINEBELOW",(0,0),(-1,-2),0.4,LINE),("LINEABOVE",(0,-1),(-1,-1),1.2,BRAND),
        ("TOPPADDING",(0,0),(-1,-1),5),("BOTTOMPADDING",(0,0),(-1,-1),5),("BACKGROUND",(0,-1),(-1,-1),LIGHT)]))
    s.append(t)
    s.append(Spacer(1,6))
    s.append(Praw('<font size=8 color="#5b6b7b">Per-teacher economics at initial scale: ~' + money(74) +
        '/yr all-in; ~' + money(14) + '/yr infrastructure-only — a useful floor for SaaS pricing. '
        'Costs scale with teachers/students, not districts.</font>', SMALL))
    build("STAR-OnePlatform-02-Budget.pdf","Budget Estimate (ROM)",s,"ROM budget for production MVP")

# ===========================================================================
# DOC 3 — PRODUCTION READINESS (board level)
# ===========================================================================
def ct_table(rows):
    """Current -> Target table."""
    data=[[Paragraph(esc(e),TDB),Paragraph(esc(c),TDM),Paragraph(esc(t),TD)] for e,c,t in rows]
    return make_table(["Element","Current (prototype)","Production target"],data,
        [1.25*inch,2.0*inch,3.15*inch])

def doc_readiness():
    s=[]
    s+=cover(["Production Readiness","Assessment"],
        "What must happen to take the prototype to a deployed, secure, monitored "
        "production MVP — prepared for the board approving the deployment budget.",
        [("Document","3 of 3 — Production Readiness Assessment"),("Date",DATE),("Basis",BASIS),
         ("MVP scope","4 capability areas (see §2)"),
         ("Overall rating","2.2 / 5.0 — not yet production-ready"),
         ("Recommendation","Approve build-out; gate go-live on §10 criteria")])

    s.append(P("1. Executive summary",H1)); s.append(rule(BRAND,1.2))
    s.append(P("The prototype proves the product thesis end to end, but it runs today as local developer "
        "processes against a single database with demo authentication. It is not yet a production system. "
        "This assessment sets out, at board level, exactly what must be built and hardened to deploy a secure, "
        "monitored MVP: cloud infrastructure, security and FERPA compliance, CI/CD, monitoring, the "
        "decomposition into production services, and DNS/networking. None of these require re-architecting the "
        "prototype — the event-driven design and service boundaries are sound — they require productionizing it."))
    s.append(P("We recommend approving the build-out. The architecture is validated and the path is "
        "well-understood; the residual risk is execution scope (a lean team) and compliance timing, both "
        "addressed in the plan. Go-live should be gated on the criteria in §10."))

    s.append(P("2. MVP scope & what is proven",H1)); s.append(rule(BRAND,1.2))
    s.append(mvp_table())
    s.append(Spacer(1,6))
    s.append(P("Proven in the prototype (de-risked):",H2))
    s+=bullets([
        "End-to-end event-driven loop: an offline assessment session syncs, flows over Kafka via a "
        "transactional outbox, and a separate service advances curriculum to mastered — verified in-browser.",
        "At-least-once durability: events survived a consumer outage and drained on restart — no data loss.",
        "Clean service boundaries (no cross-service DB access) with per-consumer CQRS read models.",
        "Offline-first client (IndexedDB outbox + cursor delta-sync) confirmed in a real browser.",
    ])

    s.append(PageBreak())
    s.append(P("3. Readiness scorecard",H1)); s.append(rule(BRAND,1.2))
    sc=[
        ("Architecture & service design","G","4.5","Sound, validated event-driven design; productionize, don't redesign"),
        ("Assignment & Progress (Cap 3)","G","4.0","Proven teacher loop; needs hardening & scale"),
        ("Cloud infrastructure","R","1.5","Local processes + single DB; no LB, auto-scaling, cache, or CDN"),
        ("Security (encryption/authz/secrets)","R","1.0","Demo cookie auth; secrets in .env; no at-rest encryption config"),
        ("FERPA / student-data compliance","R","1.0","No DPAs, retention, DSAR, audit logging, or SOC 2 — top blocker"),
        ("CI/CD & release process","R","1.5","Clean builds; no pipeline, GitOps, or release/rollback process"),
        ("Monitoring & observability","R","1.5","App logs only; no APM, alerting, error tracking, or uptime checks"),
        ("Onboarding & identity (Cap 1)","A","2.0","Roster graph + admin onboarding exist; no real SSO or live sync"),
        ("Admin & Leadership view (Cap 4)","A","2.0","Shell + data exist; reporting service & dashboards net-new"),
        ("Planning & Orchestration (Cap 2)","R","1.0","Net-new; data foundation present"),
        ("DNS & networking","R","1.0","localhost only; no domain, managed TLS, or CDN"),
        ("Accessibility (WCAG 2.1 AA)","R","1.0","Not audited — legal & mission requirement for the audience"),
    ]
    rows=[[Paragraph(esc(n),TDB),status_cell({"G":"GREEN","A":"AMBER","R":"RED"}[k],k),Paragraph(esc(v),TDC),Paragraph(esc(t),TDM)] for n,k,v,t in sc]
    s.append(make_table(["Domain","Status","Score","Summary"],rows,[1.75*inch,0.7*inch,0.5*inch,3.45*inch]))
    s.append(Spacer(1,4))
    s.append(Praw('<font size=8 color="#0a2540"><b>Overall: 2.2 / 5.0</b> — a validated MVP, not yet '
        'production-ready. <font color="#5b6b7b">Green ≥ 3.5 · Amber 2.0–3.4 · Red &lt; 2.0.</font></font>', SMALL))

    s.append(PageBreak())
    s.append(P("4. Cloud infrastructure",H1)); s.append(rule(BRAND,1.2))
    s.append(ct_table([
        ("Compute","Local Node processes; `next start`","Containerized services on Amazon EKS (Fargate/EC2), rolling deploys"),
        ("Load balancing","None — direct ports","AWS ALB with health checks; TLS termination; path/host routing"),
        ("Auto-scaling","None","Horizontal Pod Autoscaler (CPU/latency) + cluster autoscaler; queue-depth scaling for workers"),
        ("Database","Single Postgres, co-located schemas","Aurora PostgreSQL, one cluster per service, multi-AZ + read replicas"),
        ("Caching","None","ElastiCache (Redis): session, read-through read-models, rate-limiting"),
        ("CDN","None","CloudFront (US edge) for web/static assets and signed media"),
    ]))
    s.append(Praw("<b>Recommendation:</b> stand up the EKS + ALB + Aurora + Redis + CloudFront baseline via "
        "Terraform in WS-A (M1–M2); it underpins every capability and all later hardening.", BODY))

    s.append(P("5. Security",H1)); s.append(rule(BRAND,1.2))
    s.append(ct_table([
        ("Encryption","TLS in dev only; no at-rest config","KMS at-rest (Aurora, S3, EBS, backups); TLS 1.2+ in transit; field-level for sensitive PII"),
        ("Auth / authz","Demo base64 cookie + Cedar policies","Cognito SSO (Clever/ClassLink, SAML, LTI 1.3) + MFA for staff; short-lived signed sessions; Cedar retained"),
        ("Secrets management",".env files on disk","AWS Secrets Manager with rotation; no secrets in code or CI logs"),
        ("FERPA compliance","Data minimization started","Full controls program — see callout below"),
    ]))
    s.append(Spacer(1,2))
    s.append(Praw('<b>FERPA / student-data compliance (gating).</b> As a "school official" handling education '
        'records under FERPA, the platform must implement: signed Data Processing Agreements per district; a '
        'data map and inventory; least-privilege access with full audit logging; configurable data retention and '
        'deletion; parental/eligible-student access &amp; correction (DSAR) workflows; sub-processor governance; '
        'breach detection &amp; notification; and COPPA handling for under-13 students. SOC 2 readiness provides '
        'the control evidence. This is the single largest go-live blocker and must start in week 1.', BODY))

    s.append(P("6. CI/CD",H1)); s.append(rule(BRAND,1.2))
    s.append(ct_table([
        ("Source control","Git / GitHub; clean builds, lint, types","GitHub with branch protection, CODEOWNERS, required checks, signed commits"),
        ("Deployment pipeline","Manual local builds","GitHub Actions → ECR → Argo CD (GitOps); Terraform IaC; ephemeral preview envs"),
        ("Release process","None","Promote dev → staging → prod; canary / blue-green; automated rollback; gated DB migrations"),
        ("Cache invalidation","Manual; service-worker cache risk","Content-hashed assets + CloudFront invalidation on deploy + service-worker version bump + explicit cache-control"),
    ]))
    s.append(Praw("<b>Note:</b> the PWA already ships a service worker; its cache must be versioned and busted on "
        "each release to avoid serving stale offline assets — handled in the release pipeline.", BODY))

    s.append(P("7. Monitoring",H1)); s.append(rule(BRAND,1.2))
    s.append(ct_table([
        ("APM","None","Distributed tracing + per-service latency/throughput (OpenTelemetry → Datadog/Grafana)"),
        ("Logging","Console logs","Centralized structured logs (CloudWatch/OpenSearch) with retention &amp; PII scrubbing"),
        ("Alerting","None","SLO-based alerts → PagerDuty on-call; sync-freshness &amp; dead-letter-queue monitors"),
        ("Error tracking","None","Sentry across web and services with release tagging"),
        ("Uptime","None","Synthetic checks (CloudWatch Synthetics / Pingdom) + public status page"),
    ]))

    s.append(PageBreak())
    s.append(P("8. Services architecture — prototype → production",H1)); s.append(rule(BRAND,1.2))
    s.append(P("The prototype already separates concerns cleanly; production decomposes the co-located dev setup "
        "into independently deployable, scalable services on the shared event backbone.",BODY))
    rows=[
        ["Single Postgres (co-located schemas)","Per-service Aurora clusters","DB-per-service split; multi-AZ; read replicas"],
        ["roster-graph service","Roster Graph + IAM/Identity + Roster Sync","Add Cognito + Clever/ClassLink sync workers + dedup"],
        ["student-record service","Student Record & Outcomes","Scale outbox relay (HA) or Debezium CDC"],
        ["soler service","Assessment (SOLER) + offline-sync gateway","Scale; harden delta-sync endpoints"],
        ["links service","Curriculum (Links) + projector workers","Independent consumer scaling"],
        ["(net-new)","Planning & Orchestration service","Next-best-action (rules) + scheduling over progress data"],
        ["(net-new)","Reporting & Analytics service","Usage telemetry + leadership dashboards + exports"],
        ["In-memory / Kafka broker","Amazon MSK + Schema Registry","Already validated on Kafka; add registry + DLQ"],
        ["Single-instance outbox relay","Relay workers (SKIP LOCKED) or CDC","Remove single point of failure"],
        ["Next.js web (`next start`)","Web app on EKS behind ALB + CloudFront","Containerized, autoscaled, CDN-fronted"],
    ]
    s.append(make_table(["Prototype component","Production service(s)","Production change"],rows,
        [2.0*inch,2.2*inch,2.2*inch]))

    s.append(P("9. DNS & networking",H1)); s.append(rule(BRAND,1.2))
    s.append(ct_table([
        ("Domain config","localhost","Route 53 hosted zone; app + api subdomains; health-checked records"),
        ("SSL / TLS","Dev only","ACM-managed certs; TLS 1.2+; HSTS; auto-renewal"),
        ("US content delivery","None","CloudFront US-only edge (geo-restriction) over US AWS regions; data residency in-US"),
        ("Edge protection","None","AWS WAF + Shield (DDoS); rate-limiting; bot controls at the edge"),
    ]))

    s.append(P("10. What has to happen before go-live (gates)",H1)); s.append(rule(BRAND,1.2))
    rows=[
        ["P0","Production IAM + SSO + MFA","Replaces demo auth; gates all real access"],
        ["P0","FERPA program + signed DPAs + audit logging","Legal prerequisite to handle student records"],
        ["P0","Secrets management + at-rest encryption (KMS)","Baseline data protection"],
        ["P0","Cloud baseline: EKS+ALB+Aurora+Redis+CloudFront","Deployable, scalable footprint"],
        ["P0","CI/CD pipeline with rollback + monitoring/alerting","Safe to deploy and operate"],
        ["P0","Penetration test passed + WCAG 2.1 AA audit","Security + accessibility sign-off"],
        ["P1","Live roster connectors + identity dedup","Real onboarding at scale"],
        ["P1","Load test to initial scale + DR/backup drill","Reliability evidence"],
        ["P1","Planning/Orchestration + Admin dashboards live","Complete the MVP surface"],
    ]
    rows2=[[status_cell(p,"R" if p=="P0" else "A"),Paragraph(esc(i),TDB),Paragraph(esc(w),TDM)] for p,i,w in rows]
    s.append(make_table(["Pri","Gate","Why it gates go-live"],rows2,[0.5*inch,2.65*inch,2.75*inch]))
    s.append(Spacer(1,4))
    s.append(Praw('<font size=8 color="#5b6b7b"><i>Assessment basis: live verification of the running services '
        '(PostgreSQL + Kafka), an in-browser walkthrough of the offline teacher loop, and review of the source, '
        'ADRs and architecture docs as of ' + BASIS + '.</i></font>', SMALL))
    build("STAR-OnePlatform-03-Production-Readiness.pdf","Production Readiness Assessment",s,"Board-level production readiness")

if __name__ == "__main__":
    doc_tasks(); doc_budget(); doc_readiness(); print("done")
