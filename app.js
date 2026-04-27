/* =================================================================
   CV D3 Visualization – app.js
   Uses D3 v7 (loaded via CDN in index.html)
   ================================================================= */

const CATEGORY_COLORS = {
  Languages: 'var(--cat-languages)',
  Frontend:  'var(--cat-frontend)',
  Backend:   'var(--cat-backend)',
  Data:      'var(--cat-data)',
  DevOps:    'var(--cat-devops)',
};

// ── Helpers ──────────────────────────────────────────────────────

function formatDate(str) {
  if (!str) return 'Present';
  const [year, month] = str.split('-');
  return new Date(+year, +month - 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function dateRange(start, end) {
  const s = formatDate(start);
  const e = formatDate(end);
  const startYear = +start.split('-')[0];
  const endYear   = end ? +end.split('-')[0] : new Date().getFullYear();
  const endMonth  = end ? +end.split('-')[1] : new Date().getMonth() + 1;
  const startMonth = +start.split('-')[1];
  const months = (endYear - startYear) * 12 + (endMonth - startMonth);
  const years  = Math.floor(months / 12);
  const rem    = months % 12;
  const dur    = years > 0 ? `${years}y ${rem > 0 ? rem + 'm' : ''}` : `${rem}m`;
  return `${s} – ${e} · ${dur.trim()}`;
}

// ── Header ───────────────────────────────────────────────────────

function renderHeader(cv) {
  const p = cv.personal;
  document.getElementById('person-name').textContent   = p.name;
  document.getElementById('person-title').textContent  = p.title;
  document.getElementById('person-location').textContent = p.location;
  document.getElementById('person-email').textContent  = p.email;
  document.getElementById('person-github').textContent = p.github;
  document.getElementById('person-linkedin').textContent = p.linkedin;
  document.getElementById('person-summary').textContent = p.summary;
}

// ── Nav ──────────────────────────────────────────────────────────

function initNav() {
  const buttons = document.querySelectorAll('#nav button');
  const sections = document.querySelectorAll('.section');

  function activate(id) {
    buttons.forEach(b => b.classList.toggle('active', b.dataset.target === id));
    sections.forEach(s => s.classList.toggle('visible', s.id === id));
  }

  buttons.forEach(b => b.addEventListener('click', () => activate(b.dataset.target)));
  activate('section-skills'); // default tab
}

// ── Skills – Force-Directed Bubble Chart ─────────────────────────

function renderSkills(skills) {
  const container = document.getElementById('skills-viz');
  const width  = container.clientWidth || 900;
  const height = 460;

  const svg = d3.select('#skills-viz').insert('svg', ':first-child')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('width', '100%')
    .attr('height', height)
    .attr('preserveAspectRatio', 'xMidYMid meet')
    .style('display', 'block');

  // Scale bubble radius by skill level
  const rScale = d3.scaleSqrt()
    .domain([d3.min(skills, d => d.level), 100])
    .range([22, 52]);

  const nodes = skills.map(d => ({ ...d, r: rScale(d.level) }));

  // Build a colour scale resolving CSS custom properties at runtime
  const colorOf = cat => {
    const map = {
      Languages: '#f78166',
      Frontend:  '#79c0ff',
      Backend:   '#56d364',
      Data:      '#e3b341',
      DevOps:    '#bc8cff',
    };
    return map[cat] || '#8b949e';
  };

  const simulation = d3.forceSimulation(nodes)
    .force('charge', d3.forceManyBody().strength(5))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collision', d3.forceCollide().radius(d => d.r + 4).strength(0.85))
    .force('x', d3.forceX(width / 2).strength(0.04))
    .force('y', d3.forceY(height / 2).strength(0.04));

  // Tooltip
  const tooltip = d3.select('#skills-tooltip');

  const node = svg.selectAll('.node')
    .data(nodes)
    .join('g')
    .attr('class', 'node')
    .call(
      d3.drag()
        .on('start', (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x; d.fy = d.y;
        })
        .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y; })
        .on('end', (event, d) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null; d.fy = null;
        })
    );

  node.append('circle')
    .attr('r', d => d.r)
    .attr('fill', d => colorOf(d.category))
    .attr('fill-opacity', 0.22)
    .attr('stroke', d => colorOf(d.category))
    .attr('stroke-opacity', 0.8)
    .on('mousemove', (event, d) => {
      tooltip
        .style('left', (event.clientX + 14) + 'px')
        .style('top',  (event.clientY - 10) + 'px')
        .style('opacity', 1);
      tooltip.select('.tt-name').text(d.name);
      tooltip.select('.tt-cat').text(d.category);
      tooltip.select('.tt-fill')
        .style('width', d.level + '%')
        .style('background', colorOf(d.category));
    })
    .on('mouseleave', () => tooltip.style('opacity', 0));

  // Truncate label if bubble is small
  node.append('text')
    .text(d => d.r < 28 ? d.name.split('/')[0].split('.')[0] : d.name)
    .attr('font-size', d => Math.min(d.r * 0.42, 12) + 'px');

  simulation.on('tick', () => {
    node.attr('transform', d => {
      d.x = Math.max(d.r + 4, Math.min(width  - d.r - 4, d.x));
      d.y = Math.max(d.r + 4, Math.min(height - d.r - 4, d.y));
      return `translate(${d.x},${d.y})`;
    });
  });

  // Legend
  const legend = document.getElementById('skills-legend');
  Object.entries(CATEGORY_COLORS).forEach(([cat]) => {
    const item = document.createElement('div');
    item.className = 'legend-item';
    item.innerHTML = `<span class="legend-dot" style="background:${colorOf(cat)}"></span>${cat}`;
    legend.appendChild(item);
  });
}

// ── Experience Timeline ───────────────────────────────────────────

function renderExperience(experience) {
  const container = document.getElementById('exp-timeline');

  experience.forEach(job => {
    const item = document.createElement('div');
    item.className = 'tl-item';

    const badges = (job.skills || [])
      .map(s => `<span class="skill-badge">${s}</span>`).join('');

    item.innerHTML = `
      <div class="tl-card">
        <div class="tl-header">
          <div>
            <div class="tl-role">${job.role}</div>
            <div class="tl-company">${job.company}</div>
          </div>
          <div class="tl-date">${dateRange(job.start, job.end)}</div>
        </div>
        <p class="tl-desc">${job.description}</p>
        <div class="tl-skills">${badges}</div>
      </div>`;
    container.appendChild(item);
  });
}

// ── Education Timeline ────────────────────────────────────────────

function renderEducation(education) {
  const container = document.getElementById('edu-timeline');

  education.forEach(edu => {
    const item = document.createElement('div');
    item.className = 'tl-item edu';

    item.innerHTML = `
      <div class="tl-card edu">
        <div class="tl-header">
          <div>
            <div class="tl-role">${edu.degree}</div>
            <div class="tl-company edu">${edu.institution}</div>
          </div>
          <div class="tl-date">${dateRange(edu.start, edu.end)}</div>
        </div>
        ${edu.gpa ? `<p class="tl-desc">GPA: ${edu.gpa}</p>` : ''}
      </div>`;
    container.appendChild(item);
  });
}

// ── Projects ──────────────────────────────────────────────────────

function renderProjects(projects) {
  const container = document.getElementById('projects-grid');

  projects.forEach(proj => {
    const card = document.createElement('div');
    card.className = 'project-card';

    const badges = proj.tech.map(t => `<span class="skill-badge">${t}</span>`).join('');

    card.innerHTML = `
      <h3>${proj.name}</h3>
      <p>${proj.description}</p>
      <a class="proj-url" href="https://${proj.url}" target="_blank" rel="noopener">↗ ${proj.url}</a>
      <div class="tl-skills">${badges}</div>`;
    container.appendChild(card);
  });
}

// ── CV Data ───────────────────────────────────────────────────────
// Inline data mirrors data/cv.json so the page works without a server.

const CV_DATA = {
  personal: {
    name:     'Alex Rivera',
    title:    'Full-Stack Engineer',
    location: 'San Francisco, CA',
    email:    'alex.rivera@email.com',
    github:   'github.com/alexrivera',
    linkedin: 'linkedin.com/in/alexrivera',
    summary:  'Passionate engineer with 8+ years building scalable web applications and data pipelines. Loves turning complex problems into elegant solutions.',
  },
  experience: [
    {
      id: 'exp1', company: 'DataStream Inc.', role: 'Senior Software Engineer',
      start: '2021-03', end: null,
      description: 'Led migration of monolith to microservices, reducing latency by 40%. Built real-time data pipelines processing 1M+ events/day.',
      skills: ['Python', 'Kubernetes', 'Kafka', 'React', 'PostgreSQL'],
    },
    {
      id: 'exp2', company: 'Nexus Labs', role: 'Software Engineer',
      start: '2018-06', end: '2021-02',
      description: 'Developed customer-facing dashboards and REST APIs. Improved test coverage from 30% to 85%.',
      skills: ['JavaScript', 'Node.js', 'Vue.js', 'MySQL', 'Docker'],
    },
    {
      id: 'exp3', company: 'Bright Startup', role: 'Junior Developer',
      start: '2016-08', end: '2018-05',
      description: 'Built and maintained e-commerce platform features. Integrated third-party payment APIs.',
      skills: ['JavaScript', 'PHP', 'jQuery', 'MySQL'],
    },
  ],
  education: [
    {
      id: 'edu1', institution: 'UC Berkeley', degree: 'B.Sc. Computer Science',
      start: '2012-08', end: '2016-05', gpa: '3.8',
    },
  ],
  skills: [
    { name: 'Python',      category: 'Languages', level: 95 },
    { name: 'JavaScript',  category: 'Languages', level: 92 },
    { name: 'TypeScript',  category: 'Languages', level: 80 },
    { name: 'Go',          category: 'Languages', level: 65 },
    { name: 'PHP',         category: 'Languages', level: 55 },
    { name: 'React',       category: 'Frontend',  level: 90 },
    { name: 'Vue.js',      category: 'Frontend',  level: 78 },
    { name: 'D3.js',       category: 'Frontend',  level: 75 },
    { name: 'CSS/SASS',    category: 'Frontend',  level: 82 },
    { name: 'Node.js',     category: 'Backend',   level: 88 },
    { name: 'FastAPI',     category: 'Backend',   level: 85 },
    { name: 'GraphQL',     category: 'Backend',   level: 72 },
    { name: 'PostgreSQL',  category: 'Data',      level: 88 },
    { name: 'MySQL',       category: 'Data',      level: 80 },
    { name: 'MongoDB',     category: 'Data',      level: 70 },
    { name: 'Kafka',       category: 'Data',      level: 78 },
    { name: 'Redis',       category: 'Data',      level: 74 },
    { name: 'Docker',      category: 'DevOps',    level: 88 },
    { name: 'Kubernetes',  category: 'DevOps',    level: 80 },
    { name: 'AWS',         category: 'DevOps',    level: 82 },
    { name: 'CI/CD',       category: 'DevOps',    level: 85 },
    { name: 'Git',         category: 'DevOps',    level: 95 },
  ],
  projects: [
    {
      name: 'OpenMetrics',
      description: 'Open-source observability toolkit with 1.2k GitHub stars',
      url: 'github.com/alexrivera/openmetrics',
      tech: ['Python', 'Kafka', 'Grafana'],
    },
    {
      name: 'LiveBoard',
      description: 'Real-time collaborative whiteboard built with WebSockets',
      url: 'github.com/alexrivera/liveboard',
      tech: ['React', 'Node.js', 'Redis'],
    },
  ],
};

// ── Entry Point ───────────────────────────────────────────────────

(function init() {
  const cv = CV_DATA;
  renderHeader(cv);
  initNav();
  renderSkills(cv.skills);
  renderExperience(cv.experience);
  renderEducation(cv.education);
  renderProjects(cv.projects);
}());
