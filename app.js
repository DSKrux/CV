import * as pdfjsLib from "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.2.67/pdf.min.mjs";

const CV_PDF_PATH = "[CV] Sanchez-Crujeiras, David.pdf";

const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "that",
  "this",
  "you",
  "your",
  "are",
  "was",
  "were",
  "have",
  "has",
  "had",
  "will",
  "into",
  "about",
  "over",
  "under",
  "than",
  "then",
  "also",
  "using",
  "used",
  "build",
  "team",
  "teams",
  "project",
  "projects",
  "work",
  "experience",
  "skills",
  "education",
  "professional",
  "de",
  "la",
  "el",
  "los",
  "las",
  "del",
  "con",
  "una",
  "por",
]);

const SECTION_HINTS = {
  Experience: ["experience", "engineer", "developer", "role", "worked"],
  Education: ["education", "university", "degree", "master", "bachelor"],
  Skills: ["skills", "javascript", "python", "react", "node", "aws", "sql"],
  Projects: ["project", "portfolio", "built", "developed", "implemented"],
  Contact: ["email", "phone", "linkedin", "github", "address"],
};

const PLACE_KEYWORDS = [
  "perth",
  "sydney",
  "melbourne",
  "australia",
  "madrid",
  "barcelona",
  "valencia",
  "spain",
  "london",
  "uk",
  "berlin",
  "germany",
  "lisbon",
  "portugal",
  "remote",
  "hybrid",
  "onsite",
  "galicia",
  "europe",
  "usa",
  "new york",
  "san francisco",
  "santiago",
];

const INDUSTRY_PATTERNS = [
  { label: "Software", words: ["software", "saas", "platform", "web", "cloud", "ai", "data"] },
  { label: "Finance", words: ["bank", "fintech", "finance", "insurance", "trading", "risk"] },
  { label: "Consulting", words: ["consulting", "consultant", "advisory", "client"] },
  { label: "Telecom", words: ["telecom", "telecommunications", "network", "carrier"] },
  { label: "Healthcare", words: ["health", "healthcare", "medical", "pharma", "biotech"] },
  { label: "Education", words: ["education", "university", "school", "academic"] },
  { label: "Retail", words: ["retail", "ecommerce", "e-commerce", "marketplace", "iconic"] },
  { label: "Real Estate", words: ["real estate", "property", "leasing", "occupancy", "jll"] },
  { label: "Marketing", words: ["marketing", "advertising", "adspree", "user-acquisition", "campaign", "fraud"] },
  { label: "Engineering", words: ["engineering", "electronics", "noise", "airport", "geospatial"] },
  { label: "Energy", words: ["energy", "utilities", "oil", "gas", "renewable"] },
  { label: "Public Sector", words: ["government", "public sector", "ministry"] },
];

const MONTH_PATTERN =
  "(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";

const ROLE_KEYWORDS = [
  "engineer",
  "developer",
  "analyst",
  "architect",
  "consultant",
  "manager",
  "lead",
  "specialist",
  "director",
  "scientist",
];

// Optional hard override if you want exact control over career timeline labels.
// Example:
// const CAREER_DATA_OVERRIDE = [
//   {
//     startYear: 2022,
//     endYear: 2024,
//     role: "Senior BI Engineer",
//     company: "Example Company",
//     place: "Madrid",
//     industry: "Software",
//   },
// ];
const CAREER_DATA_OVERRIDE = [
  {
    startYear: 2016,
    endYear: 2017,
    role: "Business Intelligence Analyst",
    company: "Adspreemedia GmbH",
    place: "Berlin",
    industry: "Marketing",
  },
  {
    startYear: 2017,
    endYear: 2018,
    role: "Data Analyst",
    company: "Brüel & Kjaer EMS",
    place: "Melbourne",
    industry: "Engineering",
  },
  {
    startYear: 2018,
    endYear: 2022,
    role: "Business Intelligence Specialist",
    company: "JLL",
    place: "Melbourne",
    industry: "Real Estate",
  },
  {
    startYear: 2022,
    endYear: 2026,
    role: "Business Intelligence Specialist",
    company: "THE ICONIC",
    place: "Sydney",
    industry: "Retail",
  },
];

const state = {
  pdfDoc: null,
  pageNum: 1,
  scale: 1.2,
};

const canvas = document.getElementById("pdfCanvas");
const ctx = canvas.getContext("2d");
const pageIndicator = document.getElementById("pageIndicator");
const loadingState = document.getElementById("loadingState");
const prevBtn = document.getElementById("prevPageBtn");
const nextBtn = document.getElementById("nextPageBtn");
const zoomRange = document.getElementById("zoomRange");

const statPages = document.getElementById("statPages");
const statWords = document.getElementById("statWords");
const statUnique = document.getElementById("statUnique");

pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.2.67/pdf.worker.min.mjs";

function setStatus(message = "") {
  loadingState.textContent = message;
  loadingState.style.display = message ? "block" : "none";
}

function updateControls() {
  pageIndicator.textContent = `Page ${state.pageNum} / ${state.pdfDoc.numPages}`;
  prevBtn.disabled = state.pageNum <= 1;
  nextBtn.disabled = state.pageNum >= state.pdfDoc.numPages;
}

async function renderPage() {
  const page = await state.pdfDoc.getPage(state.pageNum);
  const viewport = page.getViewport({ scale: state.scale });

  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);

  await page.render({
    canvasContext: ctx,
    viewport,
  }).promise;
}

function normalizeWord(word) {
  return word
    .toLowerCase()
    .replace(/[^a-z0-9#+.-]/g, "")
    .trim();
}

function buildWordFrequency(fullText) {
  const counts = new Map();
  const tokens = fullText.split(/\s+/).map(normalizeWord);

  for (const token of tokens) {
    if (!token || token.length < 3 || STOP_WORDS.has(token)) {
      continue;
    }
    counts.set(token, (counts.get(token) || 0) + 1);
  }

  const sorted = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([term, count]) => ({ term, count }));

  return {
    top: sorted.slice(0, 26),
    totalWords: tokens.filter((t) => t && t.length >= 1).length,
    uniqueTerms: counts.size,
  };
}

function estimateSections(fullText) {
  const text = fullText.toLowerCase();
  const result = [];

  for (const [section, hints] of Object.entries(SECTION_HINTS)) {
    let score = 0;
    for (const hint of hints) {
      const rx = new RegExp(`\\b${hint}\\b`, "g");
      score += (text.match(rx) || []).length;
    }
    result.push({ section, score });
  }

  const max = Math.max(...result.map((x) => x.score), 1);
  return result.map((item) => ({
    ...item,
    normalized: Math.round((item.score / max) * 100),
  }));
}

function drawKeywordBubbles(data) {
  const svg = d3.select("#keywordsChart");
  svg.selectAll("*").remove();

  const width = 720;
  const height = 420;
  const color = d3.scaleSequential(d3.interpolateYlGnBu).domain([1, d3.max(data, (d) => d.count) || 1]);

  const root = d3
    .hierarchy({ children: data })
    .sum((d) => d.count)
    .sort((a, b) => b.value - a.value);

  const pack = d3.pack().size([width - 16, height - 16]).padding(6);
  const nodes = pack(root).leaves();

  const g = svg.append("g").attr("transform", "translate(8,8)");

  g.selectAll("circle")
    .data(nodes)
    .join("circle")
    .attr("cx", (d) => d.x)
    .attr("cy", (d) => d.y)
    .attr("r", 0)
    .attr("fill", (d) => color(d.data.count))
    .attr("fill-opacity", 0.88)
    .attr("stroke", "#19403d")
    .attr("stroke-opacity", 0.3)
    .transition()
    .duration(750)
    .attr("r", (d) => d.r);

  g.selectAll("text")
    .data(nodes)
    .join("text")
    .attr("class", "bubble-label")
    .attr("x", (d) => d.x)
    .attr("y", (d) => d.y)
    .style("font-size", (d) => `${Math.max(10, Math.min(15, d.r / 2.4))}px`)
    .style("opacity", 0)
    .text((d) => d.data.term)
    .transition()
    .delay(150)
    .duration(450)
    .style("opacity", 1);

  g.selectAll("title")
    .data(nodes)
    .join("title")
    .text((d) => `${d.data.term}: ${d.data.count}`);
}

function drawSectionBars(data) {
  const svg = d3.select("#sectionsChart");
  svg.selectAll("*").remove();

  const width = 720;
  const height = 320;
  const margin = { top: 24, right: 18, bottom: 38, left: 70 };

  const x = d3
    .scaleLinear()
    .domain([0, d3.max(data, (d) => d.normalized) || 10])
    .nice()
    .range([margin.left, width - margin.right]);

  const y = d3
    .scaleBand()
    .domain(data.map((d) => d.section))
    .range([margin.top, height - margin.bottom])
    .padding(0.22);

  svg
    .append("g")
    .selectAll("rect")
    .data(data)
    .join("rect")
    .attr("x", margin.left)
    .attr("y", (d) => y(d.section))
    .attr("height", y.bandwidth())
    .attr("width", 0)
    .attr("rx", 8)
    .attr("fill", "#1f7a74")
    .transition()
    .duration(700)
    .attr("width", (d) => x(d.normalized) - margin.left);

  svg
    .append("g")
    .attr("transform", `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(x).ticks(6).tickFormat((d) => `${d}%`))
    .call((g) => g.select(".domain").attr("stroke", "#6a7673"));

  svg
    .append("g")
    .attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisLeft(y))
    .call((g) => g.select(".domain").remove());

  svg
    .append("g")
    .selectAll("text.value")
    .data(data)
    .join("text")
    .attr("x", (d) => x(d.normalized) + 8)
    .attr("y", (d) => y(d.section) + y.bandwidth() / 2 + 4)
    .attr("fill", "#0f2f2c")
    .style("font-size", "12px")
    .style("font-weight", "700")
    .text((d) => `${d.normalized}%`);
}

function pickPlace(text) {
  const lower = text.toLowerCase();
  const found = PLACE_KEYWORDS.find((word) => lower.includes(word));
  if (!found) {
    return "Unknown";
  }
  return found.replace(/\b\w/g, (char) => char.toUpperCase());
}

function pickIndustry(text) {
  const lower = text.toLowerCase();
  const hit = INDUSTRY_PATTERNS.find((rule) => rule.words.some((word) => lower.includes(word)));
  return hit ? hit.label : "General Tech";
}

function pickCompany(lines) {
  const context = lines.join(" ");

  if (/\bTHE\s+ICONIC\b/i.test(context)) {
    return "THE ICONIC";
  }

  const candidates = lines
    .map((line) => line.replace(/[•|]/g, " ").replace(/[()]/g, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .filter((line) => !/(19|20)\d{2}/.test(line))
    .filter((line) => !/^(tech stack|clients supported|work experience|education|languages)/i.test(line))
    .filter((line) => !isLikelyRoleLine(line))
    .filter((line) => !/^(planned|implementation|data|development|optimization|visualization)/i.test(line))
    .filter((line) => line.length >= 3 && line.length <= 40)
    .filter((line) => !/[,:;/]/.test(line))
    .filter((line) => /^(?:[A-Z][A-Za-z&.'\-]*)(?:\s+[A-Z][A-Za-z&.'\-]*){0,4}$/.test(line));

  if (candidates.length) {
    return candidates[0];
  }

  return "Company Not Listed";
}

function cleanRoleLabel(line) {
  return line
    .replace(new RegExp(`${MONTH_PATTERN}\\.?`, "gi"), "")
    .replace(/(19|20)\d{2}\s*(?:-|–|—|to)\s*(?:present|current|(19|20)\d{2})/gi, "")
    .replace(/[()]/g, "")
    .replace(/[|•·]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isLikelyRoleLine(line) {
  const lower = line.toLowerCase();
  return ROLE_KEYWORDS.some((word) => new RegExp(`\\b${word}\\b`, "i").test(lower));
}

function isNoiseLine(line) {
  const lower = line.toLowerCase();
  if (lower.length < 3) {
    return true;
  }
  if (/(linkedin|github|@|www\.|http)/i.test(lower)) {
    return true;
  }
  if (/^\+?[0-9\s().-]{7,}$/.test(lower)) {
    return true;
  }
  return false;
}

function pickBestRoleCandidate(candidates) {
  const cleaned = candidates
    .map((line) => cleanRoleLabel(line))
    .filter((line) => line && !isNoiseLine(line) && !/(19|20)\d{2}/.test(line));

  if (!cleaned.length) {
    return "Career Step";
  }

  const roleish = cleaned.find((line) => isLikelyRoleLine(line));
  if (roleish) {
    return roleish;
  }

  return cleaned.sort((a, b) => a.length - b.length)[0];
}

function roleSignalScore(label) {
  const lower = label.toLowerCase();
  let score = 0;

  if (isLikelyRoleLine(label)) {
    score += 5;
  }
  if (/\bat\b/.test(lower)) {
    score += 1;
  }
  if (/\b(senior|junior|lead|principal|head)\b/.test(lower)) {
    score += 2;
  }
  if (/\b(business intelligence|bi analyst|bi engineer|data analyst|data engineer|data scientist)\b/.test(lower)) {
    score += 3;
  }
  if (label.length > 74) {
    score -= 4;
  }
  if (/^(planned|developed|implemented|optimization|extraction|maintenance)\b/i.test(lower)) {
    score -= 3;
  }

  return score;
}

function summarizeCareerEntries(entries) {
  if (!entries.length) {
    return entries;
  }

  const grouped = d3.group(entries, (d) => `${d.startYear}-${d.endYear}`);
  const summarized = [];

  for (const [, group] of grouped) {
    const sorted = [...group].sort((a, b) => roleSignalScore(b.role) - roleSignalScore(a.role));
    const best = sorted[0];
    if (!best) {
      continue;
    }

    if (roleSignalScore(best.role) < 0 && best.startYear !== best.endYear) {
      continue;
    }

    const places = d3.rollups(
      group,
      (vals) => vals.length,
      (d) => d.place,
    ).sort((a, b) => b[1] - a[1]);

    const industries = d3.rollups(
      group,
      (vals) => vals.length,
      (d) => d.industry,
    ).sort((a, b) => b[1] - a[1]);

    const companies = d3.rollups(
      group,
      (vals) => vals.length,
      (d) => d.company,
    ).sort((a, b) => b[1] - a[1]);

    summarized.push({
      ...best,
      company: companies[0]?.[0] || best.company,
      place: places[0]?.[0] || best.place,
      industry: industries[0]?.[0] || best.industry,
    });
  }

  return summarized.sort((a, b) => a.startYear - b.startYear || a.endYear - b.endYear);
}

function normalizeYearRange(startYear, endYear) {
  if (!Number.isFinite(startYear) || !Number.isFinite(endYear)) {
    return null;
  }
  if (startYear < 1970 || startYear > 2100 || endYear < 1970 || endYear > 2100) {
    return null;
  }
  if (endYear < startYear) {
    return null;
  }
  return { startYear, endYear };
}

function extractCareerEntriesFromLines(lines) {
  const entries = [];
  const rangeRegex = new RegExp(
    `(?:${MONTH_PATTERN}\\.?\\s+)?((?:19|20)\\d{2})\\s*(?:-|–|—|to)\\s*(?:${MONTH_PATTERN}\\.?\\s+)?(present|current|(?:19|20)\\d{2})`,
    "gi",
  );

  for (let i = 0; i < lines.length; i += 1) {
    const windowLines = [
      lines[i - 2] || "",
      lines[i - 1] || "",
      lines[i] || "",
      lines[i + 1] || "",
      lines[i + 2] || "",
      lines[i + 3] || "",
      lines[i + 4] || "",
    ];
    const windowText = windowLines.join(" ").replace(/\s+/g, " ");

    let match;
    rangeRegex.lastIndex = 0;
    while ((match = rangeRegex.exec(windowText)) !== null) {
      const startYear = Number(match[1]);
      const endToken = match[2].toLowerCase();
      const resolvedEndYear = ["present", "current"].includes(endToken) ? new Date().getFullYear() : Number(endToken);
      const normalized = normalizeYearRange(startYear, resolvedEndYear);
      if (!normalized) {
        continue;
      }

      const role = pickBestRoleCandidate(windowLines);
      const context = windowLines.join(" ");
      entries.push({
        startYear: normalized.startYear,
        endYear: normalized.endYear,
        role,
        company: pickCompany(windowLines),
        place: pickPlace(context),
        industry: pickIndustry(context),
      });
    }
  }

  // Keep unique year-range + role records to avoid duplicates from repeated text spans.
  const deduped = new Map();
  for (const entry of entries) {
    const key = `${entry.startYear}-${entry.endYear}-${entry.role.toLowerCase()}`;
    if (!deduped.has(key)) {
      deduped.set(key, entry);
    }
  }

  return [...deduped.values()]
    .filter((entry) => entry.endYear - entry.startYear <= 20)
    .sort((a, b) => a.startYear - b.startYear || a.endYear - b.endYear);
}

function extractYearMilestones(lines) {
  const milestones = [];
  const yearRegex = /\b(19|20)\d{2}\b/g;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const years = line.match(yearRegex);
    if (!years) {
      continue;
    }

    const contextLines = [lines[i - 1] || "", lines[i] || "", lines[i + 1] || ""];
    const role = pickBestRoleCandidate(contextLines);
    const context = contextLines.join(" ");

    for (const yearText of years) {
      const year = Number(yearText);
      const normalized = normalizeYearRange(year, year);
      if (!normalized) {
        continue;
      }

      milestones.push({
        startYear: year,
        endYear: year,
        role,
        company: pickCompany(contextLines),
        place: pickPlace(context),
        industry: pickIndustry(context),
      });
    }
  }

  const deduped = new Map();
  for (const entry of milestones) {
    const key = `${entry.startYear}-${entry.role.toLowerCase()}`;
    if (!deduped.has(key)) {
      deduped.set(key, entry);
    }
  }

  return [...deduped.values()]
    .filter((entry) => roleSignalScore(entry.role) >= 1)
    .sort((a, b) => a.startYear - b.startYear);
}

function drawCareerTimeline(entries) {
  const svg = d3.select("#timelineChart");
  svg.selectAll("*").remove();

  if (!entries.length) {
    svg
      .append("text")
      .attr("x", 24)
      .attr("y", 40)
      .style("fill", "#4d5c58")
      .style("font-size", "14px")
      .text("No clear year ranges found in the CV text.");
    return;
  }

  const width = 720;
  const height = 380;
  const margin = { top: 34, right: 26, bottom: 36, left: 64 };

  const minYear = d3.min(entries, (d) => d.startYear);
  const maxYear = d3.max(entries, (d) => d.endYear);

  const x = d3
    .scaleLinear()
    .domain([minYear - 0.2, maxYear + 0.2])
    .range([margin.left, width - margin.right]);

  const y = d3
    .scalePoint()
    .domain(entries.map((d, i) => i))
    .range([margin.top, height - margin.bottom]);

  svg
    .append("g")
    .attr("transform", `translate(0,${height - margin.bottom + 6})`)
    .call(d3.axisBottom(x).ticks(Math.min(10, maxYear - minYear + 1)).tickFormat(d3.format("d")))
    .call((g) => g.select(".domain").attr("stroke", "#6a7673"));

  const rows = svg.append("g");

  rows
    .selectAll("text.timeline-label")
    .data(entries)
    .join("text")
    .attr("x", margin.left)
    .attr("y", (_, i) => y(i))
    .attr("fill", "#0f2f2c")
    .style("font-size", "13px")
    .style("font-weight", "700")
    .text((d) =>
      d.startYear === d.endYear
        ? `${d.company || "Company Not Listed"} (${d.startYear})`
        : `${d.company || "Company Not Listed"} (${d.startYear}-${d.endYear})`,
    );

  rows
    .selectAll("text.timeline-meta")
    .data(entries)
    .join("text")
    .attr("x", margin.left)
    .attr("y", (_, i) => y(i) + 16)
    .attr("fill", "#4b5b57")
    .style("font-size", "11px")
    .text((d) => {
      if (d.place === "Unknown" || d.place === "Company Not Listed") {
        return `${d.role} | ${d.industry}`;
      }
      return `${d.role} | ${d.place} | ${d.industry}`;
    });

  rows
    .selectAll("line.timeline-span")
    .data(entries)
    .join("line")
    .attr("x1", (d) => x(d.startYear))
    .attr("x2", (d) => x(d.startYear))
    .attr("y1", (_, i) => y(i) + 30)
    .attr("y2", (_, i) => y(i) + 30)
    .attr("stroke", "#1f7a74")
    .attr("stroke-width", 14)
    .attr("stroke-linecap", "round")
    .transition()
    .duration(750)
    .attr("x2", (d) => x(d.endYear));
}

function aggregateYearsByDimension(entries, key) {
  const yearsByDimension = new Map();

  for (const entry of entries) {
    const dimension = entry[key] || "Unknown";
    const years = Math.max(1, entry.endYear - entry.startYear + 1);
    yearsByDimension.set(dimension, (yearsByDimension.get(dimension) || 0) + years);
  }

  return [...yearsByDimension.entries()]
    .map(([dimension, years]) => ({ dimension, years }))
    .sort((a, b) => b.years - a.years);
}

function compressDimensions(rows, maxDimensions = 7) {
  if (rows.length <= maxDimensions) {
    return rows;
  }

  const keep = rows.slice(0, maxDimensions - 1);
  const otherYears = d3.sum(rows.slice(maxDimensions - 1), (d) => d.years);
  return [...keep, { dimension: "Other", years: otherYears }];
}

function injectKnownCompanies(entries, fullText) {
  if (!entries.length) {
    return entries;
  }

  const text = fullText.toLowerCase();
  const enriched = [...entries];

  if (text.includes("the iconic")) {
    for (let i = 0; i < enriched.length; i += 1) {
      const entry = enriched[i];
      const isCurrentSpecialistRole =
        entry.endYear >= new Date().getFullYear() - 1 && /business intelligence specialist/i.test(entry.role);

      if (entry.company === "Company Not Listed" && isCurrentSpecialistRole) {
        enriched[i] = {
          ...entry,
          company: "THE ICONIC",
        };
      }
    }
  }

  return enriched;
}

function drawYearByPlaceIndustry(entries) {
  const svg = d3.select("#yearPlaceIndustryChart");
  svg.selectAll("*").remove();

  if (!entries.length) {
    svg
      .append("text")
      .attr("x", 24)
      .attr("y", 40)
      .style("fill", "#4d5c58")
      .style("font-size", "14px")
      .text("Not enough structured timeline data to build year/place/industry bars.");
    return;
  }

  const industryRows = compressDimensions(aggregateYearsByDimension(entries, "industry"), 7);
  const placeRows = compressDimensions(aggregateYearsByDimension(entries, "place"), 7);

  const width = 720;
  const height = 580;
  const panelH = 260;
  const margin = { top: 28, right: 24, bottom: 36, left: 170 };

  function drawPanel(yOffset, rows, title, barColor) {
    const xMax = d3.max(rows, (d) => d.years) || 1;
    const x = d3
      .scaleLinear()
      .domain([0, xMax])
      .nice()
      .range([margin.left, width - margin.right]);

    const y = d3
      .scaleBand()
      .domain(rows.map((d) => d.dimension))
      .range([yOffset + margin.top, yOffset + panelH - margin.bottom])
      .padding(0.2);

    svg
      .append("text")
      .attr("x", margin.left)
      .attr("y", yOffset + 18)
      .attr("fill", "#0f2f2c")
      .style("font-family", "Fraunces, Georgia, serif")
      .style("font-size", "15px")
      .style("font-weight", "700")
      .text(`${title} (X = Years, Y = Dimension)`);

    const panel = svg.append("g");

    panel
      .selectAll("rect.bar")
      .data(rows)
      .join("rect")
      .attr("class", "bar")
      .attr("x", margin.left)
      .attr("y", (d) => y(d.dimension))
      .attr("height", y.bandwidth())
      .attr("rx", 8)
      .attr("fill", barColor)
      .attr("width", 0)
      .transition()
      .duration(720)
      .attr("width", (d) => x(d.years) - margin.left);

    panel
      .selectAll("text.bar-value")
      .data(rows)
      .join("text")
      .attr("class", "bar-value")
      .attr("x", (d) => x(d.years) + 8)
      .attr("y", (d) => y(d.dimension) + y.bandwidth() / 2 + 4)
      .attr("fill", "#0f2f2c")
      .style("font-size", "12px")
      .style("font-weight", "700")
      .text((d) => `${d.years}y`);

    panel
      .append("g")
      .attr("transform", `translate(0,${yOffset + panelH - margin.bottom + 1})`)
      .call(d3.axisBottom(x).ticks(6).tickFormat((v) => `${v}y`))
      .call((g) => g.select(".domain").attr("stroke", "#6a7673"));

    panel
      .append("g")
      .attr("transform", `translate(${margin.left},0)`)
      .call(d3.axisLeft(y))
      .call((g) => g.select(".domain").remove());
  }

  drawPanel(0, industryRows, "By Industry", "#1f7a74");
  drawPanel(290, placeRows, "By Place", "#df6f2d");
}

async function extractDocumentLines(pdfDoc) {
  const allLines = [];

  for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum += 1) {
    const page = await pdfDoc.getPage(pageNum);
    const textContent = await page.getTextContent();

    const sorted = [...textContent.items]
      .filter((item) => item.str && item.str.trim())
      .sort((a, b) => {
        const yDiff = b.transform[5] - a.transform[5];
        if (Math.abs(yDiff) > 1.2) {
          return yDiff;
        }
        return a.transform[4] - b.transform[4];
      });

    const lineRows = [];
    for (const item of sorted) {
      const y = item.transform[5];
      const value = item.str.trim();
      const existing = lineRows.find((row) => Math.abs(row.y - y) <= 2.2);

      if (existing) {
        existing.parts.push(value);
      } else {
        lineRows.push({ y, parts: [value] });
      }
    }

    for (const row of lineRows) {
      const line = row.parts.join(" ").replace(/\s+/g, " ").trim();
      if (line) {
        allLines.push(line);
      }
    }
  }

  return allLines;
}

async function extractDocumentText(pdfDoc) {
  const pagesText = [];
  for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum += 1) {
    const page = await pdfDoc.getPage(pageNum);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item) => item.str).join(" ");
    pagesText.push(pageText);
  }
  return pagesText.join("\n");
}

async function loadPdf() {
  try {
    setStatus("Loading PDF...");
    const loadingTask = pdfjsLib.getDocument(encodeURI(CV_PDF_PATH));
    state.pdfDoc = await loadingTask.promise;

    statPages.textContent = String(state.pdfDoc.numPages);

    await renderPage();
    updateControls();

    setStatus("Extracting text for visualization...");
    const fullText = await extractDocumentText(state.pdfDoc);
    const lines = await extractDocumentLines(state.pdfDoc);

    const freq = buildWordFrequency(fullText);
    statWords.textContent = String(freq.totalWords);
    statUnique.textContent = String(freq.uniqueTerms);

    let careerEntries = extractCareerEntriesFromLines(lines);
    if (CAREER_DATA_OVERRIDE.length) {
      careerEntries = CAREER_DATA_OVERRIDE;
    } else if (careerEntries.length < 3) {
      careerEntries = extractYearMilestones(lines);
    }
    careerEntries = summarizeCareerEntries(careerEntries);
    careerEntries = injectKnownCompanies(careerEntries, fullText);

    drawKeywordBubbles(freq.top);
    drawCareerTimeline(careerEntries);
    drawYearByPlaceIndustry(careerEntries);
    setStatus("");
  } catch (error) {
    console.error(error);
    setStatus("PDF not found — showing chart data from override.");
    if (CAREER_DATA_OVERRIDE.length) {
      const careerEntries = summarizeCareerEntries(CAREER_DATA_OVERRIDE);
      drawCareerTimeline(careerEntries);
      drawYearByPlaceIndustry(careerEntries);
    }
  }
}

prevBtn.addEventListener("click", async () => {
  if (state.pageNum <= 1) {
    return;
  }
  state.pageNum -= 1;
  updateControls();
  await renderPage();
});

nextBtn.addEventListener("click", async () => {
  if (!state.pdfDoc || state.pageNum >= state.pdfDoc.numPages) {
    return;
  }
  state.pageNum += 1;
  updateControls();
  await renderPage();
});

zoomRange.addEventListener("input", async (event) => {
  state.scale = Number(event.target.value);
  if (!state.pdfDoc) {
    return;
  }
  setStatus("Rendering...");
  await renderPage();
  setStatus("");
});

loadPdf();