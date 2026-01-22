const puppeteer = require("puppeteer");

const renderRichText = (content) =>
  content ? `<div class="rich-text">${content}</div>` : "";

const renderSubParts = (parts) =>
  parts
    .map(
      (part, index) => `
      <div class="sub-part">
        <div>
          <strong>(${String.fromCharCode(97 + index)})</strong>
          ${renderRichText(part.question_text)}
        </div>
        <div class="marks">${part.marks || 0} marks</div>
      </div>
    `
    )
    .join("");

const renderMCQOptions = (options) => {
  if (!options) return "";

  const opts = options
    .split("---OPTION---")
    .map((o) => o.trim())
    .filter(Boolean);

  return `
    <div class="options">
      ${opts
        .map(
          (opt, i) => `
          <div class="option">
            <strong>${String.fromCharCode(65 + i)}.</strong> ${opt}
          </div>
        `
        )
        .join("")}
    </div>
  `;
};

const renderMatchColumns = (options) => {
  if (!options) return "";

  let parsed;
  try {
    parsed = typeof options === "string" ? JSON.parse(options) : options;
  } catch {
    return "";
  }

  const left = parsed?.left?.content?.split("---OPTION---") || [];
  const right = parsed?.right?.content?.split("---OPTION---") || [];

  return `
    <table class="match-table">
      <tr><th>Column A</th><th>Column B</th></tr>
      ${left
        .map(
          (l, i) => `
          <tr>
            <td>${l}</td>
            <td>${right[i] || ""}</td>
          </tr>
        `
        )
        .join("")}
    </table>
  `;
};

const renderFillInTheBlanks = (options) => {
  if (!options) return "";
  try {
    const parsed = JSON.parse(options);
    return renderRichText(parsed?.content);
  } catch {
    return "";
  }
};

module.exports = {
  async generate(ctx) {
    const { id } = ctx.params;

    const paper = await strapi.entityService.findOne(
      "api::test-series.test-series",
      id,
      {
        populate: {
          question_banks: {
            populate: {
              parts: true,
              diagram: true,
            },
          },
        },
      }
    );

    if (!paper) return ctx.notFound("Test paper not found");

    const testMode = paper.test_mode || paper.attributes?.test_mode;
    if (testMode !== "offline") {
      return ctx.badRequest("PDF allowed only for offline papers");
    }

    const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>${paper.title}</title>

<style>
  body { font-family: Arial; padding: 40px; }
  h1 { text-align: center; margin-bottom: 40px; }
  .question { margin-bottom: 30px; page-break-inside: avoid; }
  .sub-part { display: flex; justify-content: space-between; }
  .marks { font-size: 12px; color: #555; }
  .match-table { width: 100%; border-collapse: collapse; }
  .match-table td, .match-table th { border: 1px solid #000; padding: 8px; }
</style>

<script src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"></script>
</head>

<body>
<h1>${paper.title}</h1>

${paper.question_banks
  ?.map((q, index) => {
    const parts = q.parts || [];
    const mainText = parts.length === 1 ? parts[0]?.question_text : "";

    return `
      <div class="question">
        <h3>Q${index + 1}.</h3>

        ${renderRichText(mainText)}

        ${q.question_type === "mcq" ? renderMCQOptions(parts[0]?.options) : ""}
        ${q.question_type === "match_columns" ? renderMatchColumns(parts[0]?.options) : ""}
        ${q.question_type === "fill_in_the_blanks" ? renderFillInTheBlanks(parts[0]?.options) : ""}
        ${q.question_type === "long_answer" && parts.length > 1 ? renderSubParts(parts) : ""}
      </div>
    `;
  })
  .join("")}

</body>
</html>
`;

    const browser = await puppeteer.launch({
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    await page.evaluate(() => global.MathJax?.typesetPromise?.());

    const pdf = await page.pdf({ format: "A4", printBackground: true });
    await browser.close();

    ctx.set("Content-Type", "application/pdf");
    ctx.set("Content-Disposition", `attachment; filename="${paper.title}.pdf"`);
    ctx.body = pdf;
  },
};
