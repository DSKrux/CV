# CV

JavaScript + d3 visualization for the CV PDF in this repository.

## What It Shows

- Interactive PDF viewer (page navigation + zoom)
- Automatic text extraction using pdf.js
- Bubble map of the top terms in the CV
- Estimated section distribution chart (Experience, Skills, Education, etc.)
- Career progression timeline extracted from year ranges in the CV
- Bar chart split into year-by-industry and year-by-place panels

## Run Locally

Because browsers block local PDF access from `file://`, serve this folder with a local web server.

### Option 1: Python

```bash
python -m http.server 8000
```

### Option 2: Node

```bash
npx serve .
```

Then open:

```text
http://localhost:8000
```

## Files

- `index.html`: UI structure
- `styles.css`: visual style and responsive layout
- `app.js`: PDF rendering, text extraction, and d3 charts

## Deploy Analytics Chat (Public Web)

The `analytics-chat` app is a separate Python/Streamlit app and should be deployed independently from this static CV site.

### Recommended Setup

1. Keep this CV site on GitHub Pages (or Netlify/Vercel).
2. Deploy `analytics-chat/app.py` on Streamlit Community Cloud.
3. Use a hosted LLM provider for public access (OpenAI mode), not local Ollama.

### Streamlit Cloud Steps

1. Push this repository to GitHub.
2. In Streamlit Community Cloud, create a new app from this repo.
3. Set the app entrypoint to:

```text
analytics-chat/app.py
```

4. Add secrets in Streamlit:

```toml
OPENAI_API_KEY = "your_api_key_here"
OPENAI_MODEL = "gpt-4o-mini"
# optional, defaults to https://api.openai.com/v1
OPENAI_BASE_URL = "https://api.openai.com/v1"
```

5. Deploy and copy the generated Streamlit URL.

### Local vs Cloud Modes

- Local mode: choose `ollama` provider in sidebar and use model `llama3`.
- Cloud mode: choose `openai` provider (or set secrets so it defaults there).

## Portfolio Project Card Template

Use this HTML snippet in your broader portfolio site and replace the links:

```html
<article class="project-card">
	<h3>Analytics Chat: Natural Language to SQL</h3>
	<p>
		Retail analytics copilot built with Streamlit, DuckDB, Plotly, and an LLM.
		Ask business questions in plain English and get SQL + interactive charts.
	</p>
	<ul>
		<li>Tech: Python, Streamlit, DuckDB, Plotly, LLM APIs</li>
		<li>Highlights: SQL generation, chart auto-rendering, date-safe SQL hardening</li>
	</ul>
	<p>
		<a href="https://your-streamlit-app-url" target="_blank" rel="noopener">Live Demo</a>
		|
		<a href="https://github.com/DSKrux/CV/tree/main/analytics-chat" target="_blank" rel="noopener">Source Code</a>
	</p>
</article>
```