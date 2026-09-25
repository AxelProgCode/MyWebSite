// ─── FORMAT DEFINITIONS ───────────────────────────────────────────────────────
const FORMATS = {
  image:    ['jpg','jpeg','png','webp','gif','bmp','tiff','ico','avif','pdf'],
  video:    ['mp4','webm','avi','mov','mkv','flv','wmv'],
  audio:    ['mp3','wav','ogg','flac','aac','m4a','opus'],
  document: ['pdf','txt','html','json','csv','xml','md'],
};

const MIME_MAP = {
  pdf:'application/pdf',
  jpg:'image/jpeg', jpeg:'image/jpeg', png:'image/png', webp:'image/webp',
  gif:'image/gif', bmp:'image/bmp', tiff:'image/tiff', ico:'image/x-icon',
  avif:'image/avif',
  mp4:'video/mp4', webm:'video/webm', avi:'video/x-msvideo', mov:'video/quicktime',
  mkv:'video/x-matroska', flv:'video/x-flv', wmv:'video/x-ms-wmv',
  mp3:'audio/mpeg', wav:'audio/wav', ogg:'audio/ogg', flac:'audio/flac',
  aac:'audio/aac', m4a:'audio/mp4', opus:'audio/opus',
  txt:'text/plain', html:'text/html', json:'application/json',
  csv:'text/csv', xml:'application/xml', md:'text/markdown',
};

const CATEGORY_COLORS = {
  image: '#7c6dfa', video: '#f472b6', audio: '#4facfe', document: '#22d3a5'
};

const COMPATIBLE_FORMATS = {
  image: ['jpg','jpeg','png','webp','pdf','gif','bmp','ico'],
  video: [...FORMATS.video, ...FORMATS.audio, 'gif'],
  audio: FORMATS.audio,
  document: FORMATS.document,
};

// ─── STATE ─────────────────────────────────────────────────────────────────────
let files = [];
let ffmpegInstance = null;
let ffmpegLoaded = false;
let ffmpegLoading = false;

// ─── DOM ───────────────────────────────────────────────────────────────────────
const dropZone       = document.getElementById('dropZone');
const fileInput      = document.getElementById('fileInput');
const stepUpload     = document.getElementById('stepUpload');
const stepConvert    = document.getElementById('stepConvert');
const stepResults    = document.getElementById('stepResults');
const fileListEl     = document.getElementById('fileList');
const globalFormat   = document.getElementById('globalFormat');
const convertBtn     = document.getElementById('convertBtn');
const addMoreBtn     = document.getElementById('addMoreBtn');
const progressCont   = document.getElementById('progressContainer');
const progressFill   = document.getElementById('progressFill');
const progressLabel  = document.getElementById('progressLabel');
const resultsList    = document.getElementById('resultsList');
const resultsTitle   = document.getElementById('resultsTitle');
const resultsSubtitle= document.getElementById('resultsSubtitle');
const resultsIcon    = document.getElementById('resultsIcon');
const downloadAllBtn = document.getElementById('downloadAllBtn');
const newConversionBtn = document.getElementById('newConversionBtn');
const toast          = document.getElementById('toast');

// ─── UTILITIES ─────────────────────────────────────────────────────────────────
function getExt(name) { return name.split('.').pop().toLowerCase(); }
function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes/1024).toFixed(1) + ' KB';
  return (bytes/1048576).toFixed(1) + ' MB';
}
function getCategory(ext) {
  if (ext === 'pdf') return 'document';
  for (const [cat, exts] of Object.entries(FORMATS)) if (exts.includes(ext)) return cat;
  return 'document';
}
function showToast(msg, type='', duration=3000) {
  toast.textContent = msg;
  toast.className = `toast ${type}`;
  setTimeout(() => { toast.className = 'toast hidden'; }, duration);
}
function setProgress(pct, label) {
  progressFill.style.width = pct + '%';
  progressLabel.textContent = label;
}

// ─── NATIVE PDF GENERATOR ──────────────────────────────────────────────────────
function base64ToBytes(base64) {
  const binary = atob(base64.split(',')[1] || base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function buildPdfFromJpegBytes(jpegBytes, width, height) {
  const enc = new TextEncoder();
  const chunks = [];
  let offset = 0;
  const offsets = [];

  function addStr(str) {
    const b = enc.encode(str);
    chunks.push(b);
    offset += b.length;
  }
  function addBytes(b) {
    chunks.push(b);
    offset += b.length;
  }

  addStr("%PDF-1.4\n%âãÏÓ\n");
  offsets[1] = offset;
  addStr("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  offsets[2] = offset;
  addStr("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");
  offsets[3] = offset;
  addStr(`3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`);
  offsets[4] = offset;
  addStr(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`);
  addBytes(jpegBytes);
  addStr("\nendstream\nendobj\n");

  const streamOp = `q\n${width} 0 0 ${height} 0 0 cm\n/Im0 Do\nQ\n`;
  offsets[5] = offset;
  addStr(`5 0 obj\n<< /Length ${streamOp.length} >>\nstream\n${streamOp}endstream\nendobj\n`);

  const startxref = offset;
  addStr("xref\n0 6\n0000000000 65535 f \n");
  for (let i = 1; i <= 5; i++) {
    addStr(`${String(offsets[i]).padStart(10, '0')} 00000 n \n`);
  }
  addStr(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${startxref}\n%%EOF`);
  return new Blob(chunks, { type: 'application/pdf' });
}

async function convertImageToPdf(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);

      const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.9);
      const jpegBytes = base64ToBytes(jpegDataUrl);
      resolve(buildPdfFromJpegBytes(jpegBytes, canvas.width, canvas.height));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Impossibile leggere l'immagine per la conversione in PDF"));
    };
    img.src = url;
  });
}

async function convertTextToPdf(file) {
  const text = await file.text();
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 1100;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#111827';
  ctx.font = 'bold 16px Inter, system-ui, sans-serif';
  let y = 50;
  ctx.fillText(file.name, 40, y);

  ctx.font = '13px Inter, monospace, sans-serif';
  ctx.fillStyle = '#374151';
  y += 30;

  const lines = text.split('\n');
  for (const line of lines) {
    if (y > 1050) break;
    const words = line.split(' ');
    let currentLine = '';
    for (const w of words) {
      if (ctx.measureText(currentLine + ' ' + w).width > 720) {
        ctx.fillText(currentLine, 40, y);
        y += 18;
        currentLine = w;
      } else {
        currentLine = currentLine ? currentLine + ' ' + w : w;
      }
    }
    if (currentLine) {
      ctx.fillText(currentLine, 40, y);
      y += 18;
    }
  }

  const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.92);
  const jpegBytes = base64ToBytes(jpegDataUrl);
  return buildPdfFromJpegBytes(jpegBytes, canvas.width, canvas.height);
}

// ─── FFmpeg ────────────────────────────────────────────────────────────────────
async function getFFmpeg() {
  if (ffmpegLoaded) return ffmpegInstance;
  if (ffmpegLoading) return new Promise(res => { const iv = setInterval(()=>{ if(ffmpegLoaded){clearInterval(iv);res(ffmpegInstance);} },200); });
  ffmpegLoading = true;
  try {
    const { FFmpeg } = FFmpegWASM;
    const { toBlobURL } = FFmpegUtil;
    const ff = new FFmpeg();
    ff.on('progress', ({ progress }) => {
      const pct = Math.round(progress * 100);
      setProgress(10 + pct * 0.8, `Elaborazione: ${pct}%`);
    });
    ff.on('log', ({ message }) => { console.log('[FFmpeg]', message); });
    const base = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
    await ff.load({
      coreURL: await toBlobURL(`${base}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${base}/ffmpeg-core.wasm`, 'application/wasm'),
    });
    ffmpegInstance = ff;
    ffmpegLoaded = true;
    ffmpegLoading = false;
    return ff;
  } catch(e) {
    ffmpegLoading = false;
    throw e;
  }
}

// ─── POPULATE FORMAT OPTIONS ───────────────────────────────────────────────────
function buildFormatOptions(selectEl, category) {
  selectEl.innerHTML = '<option value="">— formato —</option>';
  const fmts = COMPATIBLE_FORMATS[category] || Object.values(FORMATS).flat();
  fmts.forEach(f => {
    const o = document.createElement('option');
    o.value = f; o.textContent = f.toUpperCase();
    selectEl.appendChild(o);
  });
}

function buildGlobalFormatOptions() {
  globalFormat.innerHTML = '<option value="">— scegli formato —</option>';
  const cats = ['document','image','video','audio'];
  cats.forEach(cat => {
    const grp = document.createElement('optgroup');
    grp.label = cat.charAt(0).toUpperCase() + cat.slice(1);
    FORMATS[cat].forEach(f => {
      const o = document.createElement('option');
      o.value = f + ':' + cat;
      o.textContent = f.toUpperCase();
      grp.appendChild(o);
    });
    globalFormat.appendChild(grp);
  });
}

// ─── FILE HANDLING ─────────────────────────────────────────────────────────────
function addFiles(fileArray) {
  fileArray.forEach(f => {
    if (files.find(x => x.name === f.name && x.size === f.size)) return;
    const ext = getExt(f.name);
    const cat = getCategory(ext);
    let defaultTarget = '';
    if (cat === 'image') defaultTarget = ext === 'png' ? 'jpg' : 'pdf';
    else if (cat === 'document') defaultTarget = ext === 'pdf' ? 'txt' : 'pdf';

    files.push({ file: f, id: Math.random().toString(36).slice(2), targetFormat: defaultTarget, result: null });
  });
  renderFileList();
  showStep('convert');
}

function renderFileList() {
  fileListEl.innerHTML = '';
  buildGlobalFormatOptions();
  files.forEach((item) => {
    const ext = getExt(item.file.name);
    const cat = getCategory(ext);
    const color = CATEGORY_COLORS[cat];
    const div = document.createElement('div');
    div.className = 'file-item'; div.id = 'fi-' + item.id;
    div.innerHTML = `
      <div class="file-thumb" style="background:${color}20;color:${color}">${ext.toUpperCase().slice(0,4)}</div>
      <div class="file-info">
        <div class="file-name">${item.file.name}</div>
        <div class="file-size">${formatSize(item.file.size)}</div>
      </div>
      <select class="file-format-select" id="sel-${item.id}"></select>
      <button class="file-remove" data-id="${item.id}" title="Rimuovi">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>`;
    fileListEl.appendChild(div);
    const sel = document.getElementById('sel-' + item.id);
    buildFormatOptions(sel, cat);
    if (item.targetFormat) sel.value = item.targetFormat;
    sel.addEventListener('change', () => { item.targetFormat = sel.value; updateConvertBtn(); });
    div.querySelector('.file-remove').addEventListener('click', () => removeFile(item.id));
  });
  updateConvertBtn();
}

function removeFile(id) {
  files = files.filter(f => f.id !== id);
  if (files.length === 0) { showStep('upload'); return; }
  renderFileList();
}

function updateConvertBtn() {
  const anyFormat = files.some(f => f.targetFormat) || (globalFormat.value !== '');
  convertBtn.disabled = files.length === 0 || !anyFormat;
}

function showStep(step) {
  stepUpload.classList.add('hidden');
  stepConvert.classList.add('hidden');
  stepResults.classList.add('hidden');
  if (step === 'upload') stepUpload.classList.remove('hidden');
  else if (step === 'convert') stepConvert.classList.remove('hidden');
  else if (step === 'results') stepResults.classList.remove('hidden');
}

// ─── CONVERSION ENGINE ─────────────────────────────────────────────────────────
async function convertImageCanvas(file, targetExt) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (targetExt === 'jpg' || targetExt === 'jpeg' || targetExt === 'bmp') {
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0,0,canvas.width,canvas.height);
      }
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      const mime = MIME_MAP[targetExt] || 'image/png';
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Canvas toBlob failed')), mime, 0.92);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Impossibile caricare l\'immagine')); };
    img.src = url;
  });
}

function convertTextDocument(file, targetExt) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      let content = e.target.result;
      const srcExt = getExt(file.name);
      let out = content;

      if (srcExt === 'json' && targetExt === 'csv') {
        try {
          const data = JSON.parse(content);
          const arr = Array.isArray(data) ? data : [data];
          const keys = Object.keys(arr[0] || {});
          out = [keys.join(','), ...arr.map(r => keys.map(k => JSON.stringify(r[k]??'')).join(','))].join('\n');
        } catch { out = content; }
      } else if (srcExt === 'csv' && targetExt === 'json') {
        try {
          const lines = content.trim().split('\n');
          const headers = lines[0].split(',');
          const rows = lines.slice(1).map(l => {
            const vals = l.split(',');
            const o = {}; headers.forEach((h,i) => o[h.trim()] = vals[i]?.trim() ?? '');
            return o;
          });
          out = JSON.stringify(rows, null, 2);
        } catch { out = content; }
      } else if (targetExt === 'html') {
        out = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${file.name}</title></head><body><pre>${content.replace(/</g,'&lt;')}</pre></body></html>`;
      } else if (targetExt === 'md') {
        out = '# ' + file.name + '\n\n' + content;
      }
      const mime = MIME_MAP[targetExt] || 'text/plain';
      resolve(new Blob([out], { type: mime }));
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

async function convertWithFFmpeg(file, targetExt) {
  const ff = await getFFmpeg();
  const { fetchFile } = FFmpegUtil;
  const inputName = 'input.' + getExt(file.name);
  const outputName = 'output.' + targetExt;
  await ff.writeFile(inputName, await fetchFile(file));
  
  const args = ['-i', inputName];
  if (targetExt === 'gif') { args.push('-vf','fps=10,scale=480:-1:flags=lanczos'); args.push('-loop','0'); }
  else if (['mp3','aac','opus','ogg'].includes(targetExt)) { args.push('-vn'); }
  else if (targetExt === 'flac') { args.push('-vn','-c:a','flac'); }
  else if (targetExt === 'wav') { args.push('-vn','-c:a','pcm_s16le'); }
  else if (targetExt === 'webp') { args.push('-vf','scale=trunc(iw/2)*2:trunc(ih/2)*2'); }
  args.push('-y', outputName);
  
  await ff.exec(args);
  const data = await ff.readFile(outputName);
  await ff.deleteFile(inputName);
  await ff.deleteFile(outputName);
  return new Blob([data.buffer], { type: MIME_MAP[targetExt] || 'application/octet-stream' });
}

async function convertFile(item, targetExt) {
  const srcExt = getExt(item.file.name);
  const cat = getCategory(srcExt);
  const tgtCat = getCategory(targetExt);

  if (srcExt === targetExt) {
    return new Blob([item.file], { type: item.file.type });
  }

  // Supporto TARGET PDF
  if (targetExt === 'pdf') {
    if (cat === 'image') return await convertImageToPdf(item.file);
    if (cat === 'document') return await convertTextToPdf(item.file);
  }

  // Image → Image via Canvas
  if (cat === 'image' && tgtCat === 'image' && targetExt !== 'avif' && targetExt !== 'pdf') {
    return convertImageCanvas(item.file, targetExt);
  }

  // Text documents
  if (cat === 'document' && tgtCat === 'document' && targetExt !== 'pdf') {
    return convertTextDocument(item.file, targetExt);
  }

  // Media / Audio / Video: FFmpeg
  return convertWithFFmpeg(item.file, targetExt);
}

// ─── MAIN CONVERT FLOW ─────────────────────────────────────────────────────────
async function runConversions() {
  const [gfmt] = (globalFormat.value || ':').split(':');
  const tasks = files.map(item => {
    const sel = document.getElementById('sel-' + item.id);
    const fmt = (sel && sel.value) ? sel.value : gfmt;
    return { item, targetExt: fmt };
  }).filter(t => t.targetExt);

  if (tasks.length === 0) { showToast('Seleziona almeno un formato!', 'error'); return; }

  convertBtn.disabled = true;
  addMoreBtn.disabled = true;
  progressCont.classList.remove('hidden');
  setProgress(2, 'Avvio conversione...');

  const results = [];
  for (let i = 0; i < tasks.length; i++) {
    const { item, targetExt } = tasks[i];
    const pctStart = Math.round((i / tasks.length) * 90);
    setProgress(pctStart, `Conversione ${i+1}/${tasks.length}: ${item.file.name}`);
    try {
      const blob = await convertFile(item, targetExt);
      const baseName = item.file.name.replace(/\.[^/.]+$/, '');
      const outName = `${baseName}.${targetExt}`;
      const url = URL.createObjectURL(blob);
      results.push({ ok: true, name: outName, url, size: blob.size });
    } catch(e) {
      console.error(e);
      results.push({ ok: false, name: item.file.name, error: e.message });
    }
  }

  setProgress(100, 'Completato!');
  setTimeout(() => {
    progressCont.classList.add('hidden');
    showResults(results);
  }, 600);
}

function showResults(results) {
  resultsList.innerHTML = '';
  const okCount = results.filter(r => r.ok).length;
  const errCount = results.filter(r => !r.ok).length;

  if (errCount === 0) {
    resultsIcon.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6 9 17l-5-5"/></svg>`;
    resultsIcon.style.cssText = 'background:rgba(34,211,165,0.15);border:1px solid rgba(34,211,165,0.3);color:#22d3a5;';
  } else {
    resultsIcon.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
    resultsIcon.style.cssText = 'background:rgba(248,113,113,0.15);border:1px solid rgba(248,113,113,0.3);color:#f87171;';
  }
  resultsTitle.textContent = okCount > 0 ? `${okCount} file convertit${okCount===1?'o':'i'}!` : 'Errore di conversione';
  resultsSubtitle.textContent = errCount > 0 ? `${errCount} errore${errCount>1?'i':''} riscontrato${errCount>1?'i':''}` : 'Tutti i file sono pronti per il download';

  const allDownloads = [];
  results.forEach(r => {
    const div = document.createElement('div');
    div.className = 'result-item';
    if (r.ok) {
      allDownloads.push({ name: r.name, url: r.url });
      div.innerHTML = `
        <div class="result-st