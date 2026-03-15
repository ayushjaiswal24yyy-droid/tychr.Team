const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");

// ---------------------------------------------------------------------------
// Rich-text helpers (Strapi v4 stores rich text as markdown strings)
// ---------------------------------------------------------------------------

const richTextToHtml = (content) => {
  if (!content || typeof content !== "string") return "";
  return content
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/\n/g, "<br/>");
};

const renderRichText = (content) => {
  if (!content || typeof content !== "string") return "";
  return `<div class="rich-text">${richTextToHtml(content)}</div>`;
};

// Returns true if any question content contains LaTeX delimiters
const paperHasMath = (questions) => {
  const mathPattern = /\$|\\\(|\\\[/;
  return questions.some((q) => {
    const fields = [
      q.question,
      q.instructions,
      ...(q.parts || []).map((p) => p.question_text),
    ];
    return fields.some((f) => f && mathPattern.test(f));
  });
};

// ---------------------------------------------------------------------------
// Question-type renderers
// ---------------------------------------------------------------------------

const renderMCQOptions = (options) => {
  if (!options || typeof options !== "string") return "";
  const opts = options
    .split("---OPTION---")
    .map((o) => o.trim())
    .filter(Boolean);
  if (!opts.length) return "";
  return `
    <div class="options">
      ${opts
        .map(
          (opt, i) => `
        <div class="option">
          <span class="option-label">${String.fromCharCode(65 + i)}.</span>
          <span class="option-text">${richTextToHtml(opt)}</span>
        </div>`
        )
        .join("")}
    </div>`;
};

const renderMatchColumns = (options) => {
  if (!options) return "";
  let parsed;
  try {
    parsed = typeof options === "string" ? JSON.parse(options) : options;
  } catch {
    return "";
  }
  const left =
    parsed?.left?.content
      ?.split("---OPTION---")
      .map((s) => s.trim())
      .filter(Boolean) || [];
  const right =
    parsed?.right?.content
      ?.split("---OPTION---")
      .map((s) => s.trim())
      .filter(Boolean) || [];
  const rows = Math.max(left.length, right.length);
  if (!rows) return "";
  return `
    <table class="match-table">
      <thead>
        <tr><th>Column A</th><th>Column B</th></tr>
      </thead>
      <tbody>
        ${Array.from({ length: rows })
          .map(
            (_, i) => `
          <tr>
            <td>${richTextToHtml(left[i] || "")}</td>
            <td>${richTextToHtml(right[i] || "")}</td>
          </tr>`
          )
          .join("")}
      </tbody>
    </table>`;
};

const renderFillInTheBlanks = (options) => {
  if (!options) return "";
  try {
    const parsed = typeof options === "string" ? JSON.parse(options) : options;
    const content = parsed?.content;
    if (!content || typeof content !== "string") return "";
    return `<div class="rich-text fitb">${richTextToHtml(content)}</div>`;
  } catch {
    return "";
  }
};

// ---------------------------------------------------------------------------
// Multi-part renderer
// ---------------------------------------------------------------------------

const renderSubParts = (parts) => {
  return parts
    .map(
      (part, index) => `
      <div class="sub-part">
        <div class="sub-part-header">
          <span class="sub-part-label">(${String.fromCharCode(97 + index)})</span>
          <span class="sub-part-marks">[${part.marks || 0} mark${part.marks !== 1 ? "s" : ""}]</span>
        </div>
        <div class="sub-part-text">
          ${renderRichText(part.question_text)}
          ${part.answer_type === "Fill In The Blanks" ? renderFillInTheBlanks(part.options) : ""}
        </div>
      </div>`
    )
    .join("");
};

// ---------------------------------------------------------------------------
// Main question body builder
// ---------------------------------------------------------------------------

const renderQuestionBody = (q) => {
  const parts = q.parts || [];
  const isSinglePart = parts.length <= 1;
  const singlePart = parts[0] || {};

  let bodyHtml = renderRichText(q.question);

  if (isSinglePart) {
    const partText = singlePart.question_text;
    if (
      partText &&
      typeof partText === "string" &&
      partText.trim() !== (q.question || "").trim()
    ) {
      bodyHtml += renderRichText(partText);
    }

    switch (q.question_type) {
      case "mcq":
      case "mcq_multiple":
        bodyHtml += renderMCQOptions(singlePart.options);
        break;
      case "match_columns":
        bodyHtml += renderMatchColumns(singlePart.options);
        break;
      case "fill_in_the_blanks":
        bodyHtml += renderFillInTheBlanks(singlePart.options);
        break;
      default:
        break;
    }
  } else {
    bodyHtml += `<div class="sub-parts">${renderSubParts(parts)}</div>`;
  }

  return bodyHtml;
};

// ---------------------------------------------------------------------------
// Marks total — sums part-level marks when q.marks is absent/zero
// ---------------------------------------------------------------------------

const resolveQuestionMarks = (q) => {
  if (q.marks != null && q.marks > 0) return q.marks;
  const parts = q.parts || [];
  return parts.reduce((sum, p) => sum + (p.marks || 0), 0);
};

// ---------------------------------------------------------------------------
// HTML template — needsMath is computed in the controller and passed in
// ---------------------------------------------------------------------------

const buildHtml = (paper, needsMath) => {
  const questions = paper.question_banks || [];
  const totalMarks = questions.reduce((sum, q) => sum + resolveQuestionMarks(q), 0);

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${paper.title || "Test Paper"}</title>
  ${needsMath ? `
  <script>
    window.MathJax = {
      tex: { inlineMath: [['$', '$'], ['\\\\(', '\\\\)']] },
      svg: { fontCache: 'global' },
      startup: {
        ready() {
          MathJax.startup.defaultReady();
          MathJax.startup.promise.then(() => { window.__mathJaxDone = true; });
        }
      }
    };
  </script>
  <script src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js" id="MathJax-script"></script>
  ` : ""}
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Times New Roman', Times, serif;
      font-size: 12pt;
      color: #000;
      padding: 20mm 20mm 20mm 25mm;
      line-height: 1.6;
    }
    .header {
      text-align: center;
      margin-bottom: 24px;
      border-bottom: 2px solid #000;
      padding-bottom: 12px;
    }
    .header h1 { font-size: 18pt; font-weight: bold; margin-bottom: 6px; }
    .header .meta { font-size: 11pt; color: #333; }
    .instructions {
      margin-bottom: 20px;
      padding: 10px;
      border: 1px solid #ccc;
      background: #f9f9f9;
      font-size: 11pt;
    }
    .questions { margin-top: 16px; }
    .question {
      margin-bottom: 24px;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .question-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 6px;
    }
    .question-number { font-weight: bold; font-size: 12pt; min-width: 40px; }
    .question-marks { font-size: 11pt; color: #333; white-space: nowrap; margin-left: 8px; }
    .question-body { margin-left: 8px; }
    .rich-text { margin-bottom: 6px; }
    .options { margin-top: 8px; margin-left: 16px; }
    .option { display: flex; gap: 8px; margin-bottom: 4px; }
    .option-label { font-weight: bold; min-width: 20px; }
    .match-table { border-collapse: collapse; margin-top: 8px; width: 80%; }
    .match-table th, .match-table td {
      border: 1px solid #666;
      padding: 6px 12px;
      text-align: left;
    }
    .match-table th { background: #eee; font-weight: bold; }
    .sub-parts { margin-top: 8px; margin-left: 16px; }
    .sub-part { margin-bottom: 12px; }
    .sub-part-header {
      display: flex;
      justify-content: space-between;
      font-weight: bold;
      margin-bottom: 4px;
    }
    .sub-part-marks { color: #555; font-weight: normal; }
    .sub-part-text { margin-left: 24px; }
    @media print {
      body { padding: 0; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${paper.title || "Test Paper"}</h1>
    <div class="meta">
      ${paper.test_duration ? `<span>Duration: ${paper.test_duration} hrs</span> &nbsp;|&nbsp;` : ""}
      <span>Total Marks: ${totalMarks}</span>
    </div>
  </div>

  ${
    paper.instructions
      ? `<div class="instructions"><strong>Instructions:</strong><br/>${richTextToHtml(paper.instructions)}</div>`
      : ""
  }

  <div class="questions">
    ${questions
      .map(
        (q, index) => `
      <div class="question">
        <div class="question-header">
          <span class="question-number">Q${index + 1}.</span>
          <span class="question-marks">[${resolveQuestionMarks(q)} mark${resolveQuestionMarks(q) !== 1 ? "s" : ""}]</span>
        </div>
        <div class="question-body">
          ${renderQuestionBody(q)}
        </div>
      </div>`
      )
      .join("")}
  </div>
</body>
</html>`;
};

// ---------------------------------------------------------------------------
// Controller
// ---------------------------------------------------------------------------

module.exports = {
  async generate(ctx) {
    try {
      const { id } = ctx.params;

      const paper = await strapi.entityService.findOne(
        "api::test-serie.test-serie",
        id,
        {
          populate: {
            question_banks: {
              populate: ["parts", "attachments"],
            },
          },
        }
      );

      if (!paper) return ctx.notFound("Test paper not found");
      if (paper.test_mode !== "offline") {
        return ctx.badRequest("PDF generation is only allowed for offline papers");
      }

      // Compute needsMath once and pass into buildHtml so both the
      // <script> tag injection and the Puppeteer request filter stay in sync
      const questions = paper.question_banks || [];
      const needsMath = paperHasMath(questions);
      const html = buildHtml(paper, needsMath);

      const browser = await puppeteer.launch({
        args: [...chromium.args, "--no-sandbox", "--disable-setuid-sandbox"],
        executablePath: await chromium.executablePath(),
        headless: true,
      });

      const page = await browser.newPage();

      // Block MathJax CDN when not needed — prevents the page from hanging
      // on servers where outbound requests to jsdelivr.net are slow or blocked
      await page.setRequestInterception(true);
      page.on("request", (req) => {
        const url = req.url();
        const isMathJax = url.includes("mathjax") || url.includes("jsdelivr");
        if (isMathJax && !needsMath) {
          req.abort();
        } else {
          req.continue();
        }
      });

      // domcontentloaded is sufficient — HTML is self-contained
      // MathJax (if needed) is waited on separately below
      await page.setContent(html, { waitUntil: "domcontentloaded", timeout: 15000 });

      if (needsMath) {
        await page
          .waitForFunction(() => window.__mathJaxDone === true, { timeout: 20000 })
          .catch(() => {
            strapi.log.warn("MathJax did not complete — PDF will render without math formatting.");
          });
      } else {
        // Small buffer for CSS rendering (fonts, borders etc.)
        await new Promise((resolve) => setTimeout(resolve, 300));
      }

      const pdf = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: { top: "20mm", bottom: "20mm", left: "25mm", right: "20mm" },
      });

      await browser.close();

      const filename = `${(paper.title || "test-paper").replace(/[^a-z0-9]/gi, "_")}.pdf`;
      ctx.set("Content-Type", "application/pdf");
      ctx.set("Content-Disposition", `attachment; filename="${filename}"`);
      ctx.body = pdf;
    } catch (err) {
      strapi.log.error("PDF generation failed:", err);
      return ctx.internalServerError(`PDF generation failed: ${err.message}`);
    }
  },
};