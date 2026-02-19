
const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");

// Strapi richtext is stored as markdown - convert basic markdown to HTML
const richTextToHtml = (content) => {
  if (!content) return "";
  return content
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/\n/g, "<br/>");
};

const renderRichText = (content) => {
  if (!content) return "";
  return `<div class="rich-text">${richTextToHtml(content)}</div>`;
};

const renderMCQOptions = (options) => {
  if (!options) return "";
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
  const left = parsed?.left?.content?.split("---OPTION---").filter(Boolean) || [];
  const right = parsed?.right?.content?.split("---OPTION---").filter(Boolean) || [];
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
    return renderRichText(parsed?.content);
  } catch {
    return "";
  }
};

const renderSubParts = (parts) => {
  return parts
    .map(
      (part, index) => `
      <div class="sub-part">
        <div class="sub-part-header">
          <span class="sub-part-label">(${String.fromCharCode(97 + index)})</span>
          <span class="sub-part-marks">[${part.marks || 0} mark${part.marks !== 1 ? "s" : ""}]</span>
        </div>
        <div class="sub-part-text">${renderRichText(part.question_text)}</div>
        ${part.answer_type === "Fill In The Blanks" ? renderFillInTheBlanks(part.options) : ""}
      </div>`
    )
    .join("");
};

const renderQuestionBody = (q) => {
  const parts = q.parts || [];
  const isSinglePart = parts.length <= 1;
  const singlePart = parts[0] || {};

  // Main question text: use q.question (the top-level richtext field)
  const mainQuestionHtml = renderRichText(q.question);

  // For single-part questions, also render the part's question_text if different
  const partTextHtml =
    isSinglePart && singlePart.question_text && singlePart.question_text !== q.question
      ? renderRichText(singlePart.question_text)
      : "";

  let bodyHtml = mainQuestionHtml + partTextHtml;

  if (isSinglePart) {
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
    // Multi-part question
    bodyHtml += `<div class="sub-parts">${renderSubParts(parts)}</div>`;
  }

  return bodyHtml;
};

const buildHtml = (paper) => {
  const questions = paper.question_banks || [];
  const totalMarks = questions.reduce((sum, q) => sum + (q.marks || 0), 0);

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${paper.title || "Test Paper"}</title>
  <script>
    window.MathJax = {
      tex: { inlineMath: [['$', '$'], ['\\\\(', '\\\\)']] },
      svg: { fontCache: 'global' }
    };
  </script>
  <script src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js" id="MathJax-script" async></script>
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
    .header h1 {
      font-size: 18pt;
      font-weight: bold;
      margin-bottom: 6px;
    }
    .header .meta {
      font-size: 11pt;
      color: #333;
    }
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
      page-break-inside: avoid;
    }
    .question-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 6px;
    }
    .question-number {
      font-weight: bold;
      font-size: 12pt;
      min-width: 40px;
    }
    .question-marks {
      font-size: 11pt;
      color: #333;
      white-space: nowrap;
      margin-left: 8px;
    }
    .question-body { margin-left: 8px; }
    .rich-text { margin-bottom: 6px; }
    .options { margin-top: 8px; margin-left: 16px; }
    .option {
      display: flex;
      gap: 8px;
      margin-bottom: 4px;
    }
    .option-label { font-weight: bold; min-width: 20px; }
    .match-table {
      border-collapse: collapse;
      margin-top: 8px;
      width: 80%;
    }
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
    .answer-line {
      border-bottom: 1px solid #999;
      margin-top: 8px;
      height: 24px;
    }
    @media print {
      body { padding: 0; }
      .question { page-break-inside: avoid; }
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
          <span class="question-marks">[${q.marks || 0} mark${q.marks !== 1 ? "s" : ""}]</span>
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

      const html = buildHtml(paper);

      const browser = await puppeteer.launch({
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath(),
        headless: chromium.headless,
      });

      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "networkidle0" });

      await page.evaluate(async () => {
        const win = window;
        if (win.MathJax?.typesetPromise) {
          await win.MathJax.typesetPromise();
        }
      });

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