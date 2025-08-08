/*
  Family Tree demo using D3 hierarchical layout
  - Local storage persistence
  - Add person, add parent-child relationship
  - Zoom/pan, center/fit, focus selection
*/

const STORAGE_KEY = 'familyTreeData.v1';

/** @typedef {{ id:string, name:string, birthYear?:number }} Person */
/** @typedef {{ parentId:string, childId:string }} ParentChild */
/** @typedef {{ persons: Person[], relations: ParentChild[], rootId?: string }} TreeData */

/** @type {TreeData} */
let data = loadData() ?? seedData();

const d3svg = d3.select('#tree-svg');
const svg = d3svg.node();
const gZoom = d3svg.append('g').attr('class', 'zoom-pane');
const gLinks = gZoom.append('g').attr('class', 'links');
const gNodes = gZoom.append('g').attr('class', 'nodes');

let focusedNodeId = null;

// Zoom & pan
const zoom = d3.zoom().scaleExtent([0.2, 2]).on('zoom', (event) => {
  gZoom.attr('transform', event.transform);
});
d3svg.call(zoom);

// Cursor feedback
let isMouseDown = false;
d3svg.on('mousedown', () => { isMouseDown = true; d3svg.classed('grabbing', true); });
d3svg.on('mouseup mouseleave', () => { isMouseDown = false; d3svg.classed('grabbing', false); });

// Controls
const nameInput = document.getElementById('person-name');
const birthInput = document.getElementById('person-birth');
const addPersonBtn = document.getElementById('btn-add-person');
const parentSelect = document.getElementById('select-parent');
const childSelect = document.getElementById('select-child');
const addEdgeBtn = document.getElementById('btn-add-edge');
const rootSelect = document.getElementById('select-root');
const centerBtn = document.getElementById('btn-center');
const fitBtn = document.getElementById('btn-fit');
const searchInput = document.getElementById('search-input');
const searchBtn = document.getElementById('btn-search');
const exportBtn = document.getElementById('btn-export');
const importInput = document.getElementById('input-import');

addPersonBtn.addEventListener('click', onAddPerson);
addEdgeBtn.addEventListener('click', onAddEdge);
centerBtn.addEventListener('click', () => centerOnRoot());
fitBtn.addEventListener('click', () => fitToView());
searchBtn.addEventListener('click', () => searchAndFocus(searchInput.value.trim()));
searchInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') searchBtn.click(); });
exportBtn.addEventListener('click', onExport);
importInput.addEventListener('change', onImport);
rootSelect.addEventListener('change', () => { data.rootId = rootSelect.value || undefined; persist(); render(); });

render();

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed.persons || !parsed.relations) return null;
    return parsed;
  } catch { return null; }
}

function seedData() {
  const a = { id: id(), name: 'You', birthYear: 1990 };
  const b = { id: id(), name: 'Parent A', birthYear: 1965 };
  const c = { id: id(), name: 'Parent B', birthYear: 1967 };
  const d = { id: id(), name: 'Grandparent A', birthYear: 1940 };
  const e = { id: id(), name: 'Grandparent B', birthYear: 1942 };
  const f = { id: id(), name: 'Grandparent C', birthYear: 1943 };
  const g = { id: id(), name: 'Grandparent D', birthYear: 1945 };
  return {
    persons: [a,b,c,d,e,f,g],
    relations: [
      { parentId: b.id, childId: a.id },
      { parentId: c.id, childId: a.id },
      { parentId: d.id, childId: b.id },
      { parentId: e.id, childId: b.id },
      { parentId: f.id, childId: c.id },
      { parentId: g.id, childId: c.id },
    ],
    rootId: a.id,
  };
}

function id() {
  return 'id_' + Math.random().toString(36).slice(2, 10);
}

function getPerson(id) { return data.persons.find(p => p.id === id); }

function onAddPerson() {
  const name = nameInput.value.trim();
  const birthYear = parseInt(birthInput.value, 10);
  if (!name) return;
  const person = { id: id(), name, birthYear: Number.isFinite(birthYear) ? birthYear : undefined };
  data.persons.push(person);
  if (!data.rootId) data.rootId = person.id;
  nameInput.value = '';
  birthInput.value = '';
  persist();
  render();
}

function onAddEdge() {
  const parentId = parentSelect.value;
  const childId = childSelect.value;
  if (!parentId || !childId || parentId === childId) return;
  const exists = data.relations.some(r => r.parentId === parentId && r.childId === childId);
  if (!exists) {
    data.relations.push({ parentId, childId });
    persist();
    render();
  }
}

function onExport() {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'family-tree.json'; a.click();
  URL.revokeObjectURL(url);
}

async function onImport(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    if (!parsed.persons || !parsed.relations) throw new Error('Invalid file');
    data = parsed;
    persist();
    render();
  } catch (err) {
    alert('Import failed: ' + (err?.message || 'Unknown error'));
  } finally {
    e.target.value = '';
  }
}

function searchAndFocus(query) {
  if (!query) return;
  const found = data.persons.find(p => p.name.toLowerCase().includes(query.toLowerCase()));
  if (found) {
    focusedNodeId = found.id;
    if (data.rootId !== found.id) {
      data.rootId = found.id;
    }
    persist();
    render();
  }
}

function buildHierarchy(rootId) {
  // Build adjacency from parent -> children
  const childrenByParent = new Map();
  for (const rel of data.relations) {
    if (!childrenByParent.has(rel.parentId)) childrenByParent.set(rel.parentId, []);
    childrenByParent.get(rel.parentId).push(rel.childId);
  }
  const visited = new Set();

  function dfs(personId) {
    if (visited.has(personId)) return null; // prevent cycles
    visited.add(personId);
    const person = getPerson(personId);
    if (!person) return null;
    const childIds = childrenByParent.get(personId) || [];
    const children = childIds.map(dfs).filter(Boolean);
    return { ...person, children };
  }

  const root = getPerson(rootId) || data.persons[0];
  return dfs(root?.id);
}

function render() {
  // Update selects
  for (const sel of [parentSelect, childSelect, rootSelect]) {
    sel.innerHTML = '';
    const empty = document.createElement('option');
    empty.value = '';
    empty.textContent = sel === rootSelect ? '(auto)' : '(select)';
    sel.appendChild(empty);
    for (const p of data.persons) {
      const opt = document.createElement('option');
      opt.value = p.id; opt.textContent = p.name;
      if (sel === rootSelect && data.rootId === p.id) opt.selected = true;
      sel.appendChild(opt);
    }
  }

  // Layout
  const width = svg.clientWidth || 1200;
  const height = svg.clientHeight || 800;

  const hierarchy = d3.hierarchy(buildHierarchy(data.rootId));
  const treeLayout = d3.tree().nodeSize([80, 160]); // [y, x] spacing
  treeLayout(hierarchy);

  // Transform coords: d.x: horizontal (depth), d.y: vertical spacing
  const nodes = hierarchy.descendants();
  const links = hierarchy.links();

  // Links
  const linkSel = gLinks.selectAll('path.link').data(links, d => d.target.data.id);
  linkSel.exit().remove();
  linkSel.enter().append('path')
    .attr('class', 'link')
    .merge(linkSel)
    .attr('d', d => diagonal(d));

  // Nodes
  const nodeSel = gNodes.selectAll('g.node').data(nodes, d => d.data.id);
  nodeSel.exit().remove();
  const nodeEnter = nodeSel.enter().append('g').attr('class', 'node');

  nodeEnter.append('rect').attr('width', 160).attr('height', 52).attr('x', -80).attr('y', -26);
  nodeEnter.append('text').attr('class', 'name').attr('text-anchor', 'middle').attr('y', -4);
  nodeEnter.append('text').attr('class', 'meta').attr('text-anchor', 'middle').attr('y', 14);

  const nodeMerge = nodeEnter.merge(nodeSel);

  nodeMerge
    .attr('transform', d => `translate(${d.depth * 180}, ${d.x})`)
    .classed('focus', d => d.data.id === focusedNodeId);

  nodeMerge.select('text.name').text(d => d.data.name);
  nodeMerge.select('text.meta').text(d => d.data.birthYear ? `b. ${d.data.birthYear}` : '');

  nodeMerge.on('click', (event, d) => {
    focusedNodeId = d.data.id;
    data.rootId = d.data.id;
    persist();
    render();
  });

  // Auto-fit on first render or after big changes
  fitToView(0.08);
}

function diagonal(link) {
  const sx = link.source.depth * 180, sy = link.source.x;
  const tx = link.target.depth * 180, ty = link.target.x;
  const mx = (sx + tx) / 2;
  return `M${sx},${sy} C ${mx},${sy} ${mx},${ty} ${tx},${ty}`;
}

function centerOnRoot() {
  const root = d3.select('g.node');
  if (root.empty()) return;
  const transform = d3.zoomIdentity.translate(50, (svg.clientHeight || 800)/2).scale(1);
  d3svg.transition().duration(400).call(zoom.transform, transform);
}

function fitToView(padding = 0.1) {
  const bbox = gZoom.node().getBBox();
  if (!isFinite(bbox.width) || bbox.width === 0) return;
  const width = svg.clientWidth || 1200;
  const height = svg.clientHeight || 800;
  const scale = Math.min(
    (1 - padding) * width / bbox.width,
    (1 - padding) * height / bbox.height,
    2
  );
  const tx = (width - bbox.width * scale) / 2 - bbox.x * scale;
  const ty = (height - bbox.height * scale) / 2 - bbox.y * scale;
  const t = d3.zoomIdentity.translate(tx, ty).scale(scale);
  d3svg.transition().duration(450).call(zoom.transform, t);
}