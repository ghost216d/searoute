const status = document.getElementById('aiStatus');
const aiSection = document.getElementById('aiTools');
const intro = aiSection?.querySelector('.ai-head p:not(.eyebrow)');
const eyebrow = aiSection?.querySelector('.eyebrow');
const badge = aiSection?.querySelector('.free-ai-badge');

if (eyebrow) eyebrow.textContent = 'On-device AI';
if (intro) intro.textContent = 'The AI runs on this phone with no account, API key, usage charge or request limit. Safety thresholds remain calculated separately by AnglerRoute.';
if (badge) badge.textContent = 'Free · private · unlimited';
if (status) status.textContent = 'Ready. The first use downloads a compact AI model to this phone; later uses are loaded from the browser cache.';

let transformers;
let textGenerator;
let fishClassifier;

function progressMessage(prefix, event) {
  if (!status || !event) return;
  const percent = Number.isFinite(event.progress) ? ` ${Math.round(event.progress)}%` : '';
  if (event.status === 'progress') status.textContent = `${prefix}${percent} · keep this page open`;
  if (event.status === 'ready') status.textContent = `${prefix} ready on this phone.`;
}

async function library() {
  if (!transformers) {
    status.className = 'ai-status';
    status.textContent = 'Loading the on-device AI engine…';
    transformers = await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1');
    transformers.env.allowLocalModels = false;
    transformers.env.useBrowserCache = true;
  }
  return transformers;
}

async function loadTextModel() {
  if (textGenerator) return textGenerator;
  const { pipeline } = await library();
  status.className = 'ai-status';
  status.textContent = 'Downloading the compact language model for this phone…';
  textGenerator = await pipeline('text2text-generation', 'Xenova/flan-t5-small', {
    device: 'wasm',
    dtype: 'q8',
    progress_callback: (event) => progressMessage('Language model download', event),
  });
  status.className = 'ai-status online';
  status.textContent = 'On-device language AI is ready. Requests are processed on this phone.';
  return textGenerator;
}

function contextLines(context = {}) {
  return [
    `water: ${context.waterType || 'unknown'}`,
    `start: ${context.start || 'unknown'}`,
    `area: ${context.area || 'unknown'}`,
    `time: ${context.leave || 'unknown'} to ${context.returnBy || 'unknown'}`,
    `boat: ${context.boat || 'unknown'}`,
    `app warning: ${context.outlook || 'unknown'}; ${context.outlookText || ''}`,
    `wind: ${context.wind || 'unknown'}`,
    `waves: ${context.waves || 'unknown'}`,
    `visibility: ${context.visibility || 'unknown'}`,
    `water temperature: ${context.waterTemperature || 'unknown'}`,
    `water level: ${context.waterLevel || 'unknown'}`,
    `likely species: ${context.likelySpecies || 'unknown'}`,
    `daylight: ${context.daylight || 'unknown'}`,
  ].join('\n');
}

function promptFor(action, data) {
  const rules = 'Use plain UK English. Be brief. Never say conditions are safe. Never invent measurements. Tell the user to verify official forecasts, local notices, licences and regulations.';
  if (action === 'trip_brief') return `${rules}\nWrite a fishing trip brief with main concern, fishing outlook, what to pack, and checks before leaving.\n${contextLines(data.context)}`;
  if (action === 'question') return `${rules}\nAnswer this fishing question using only the supplied trip information. If it is missing, say so.\nQuestion: ${String(data.question || '').slice(0, 400)}\n${contextLines(data.context)}`;
  if (action === 'catch_post') return `${rules}\nCreate two short labelled parts: Private journal and Optional social post. Do not include exact coordinates or claim the fish was verified.\nSpecies entered: ${String(data.species || '').slice(0, 100)}\nOutcome: ${String(data.outcome || '').slice(0, 100)}\nNotes: ${String(data.notes || '').slice(0, 500)}\nApproximate area: ${String(data.context?.area || '').slice(0, 120)}`;
  throw new Error('Unsupported text request');
}

async function runText(action, data) {
  const generator = await loadTextModel();
  const result = await generator(promptFor(action, data), {
    max_new_tokens: action === 'question' ? 150 : 180,
    temperature: 0.35,
    repetition_penalty: 1.15,
  });
  const text = result?.[0]?.generated_text?.trim();
  if (!text) throw new Error('the phone produced no answer');
  return text;
}

function fishLabels(context = {}) {
  const local = String(context.likelySpecies || '').split(/[·,\/]/).map((x) => x.trim()).filter(Boolean);
  return [...new Set([...local, 'sea bass', 'mackerel', 'cod', 'haddock', 'pollock', 'salmon', 'trout', 'carp', 'pike', 'perch', 'bream', 'catfish', 'tuna', 'mahi-mahi', 'tarpon', 'halibut', 'snapper', 'flatfish', 'shark'])].slice(0, 24);
}

async function identifyFish(data) {
  const { pipeline, RawImage } = await library();
  if (!fishClassifier) {
    status.className = 'ai-status';
    status.textContent = 'Downloading the fish-photo model to this phone…';
    fishClassifier = await pipeline('zero-shot-image-classification', 'Xenova/clip-vit-base-patch32', {
      device: 'wasm',
      dtype: 'q8',
      progress_callback: (event) => progressMessage('Photo model download', event),
    });
  }
  const image = await RawImage.fromURL(data.image);
  const candidates = fishLabels(data.context);
  const results = await fishClassifier(image, candidates, { hypothesis_template: 'a clear photograph of a {} fish' });
  const top = results.slice(0, 3);
  status.className = 'ai-status online';
  status.textContent = 'On-device photo AI is ready. The image stayed on this phone.';
  return `Possible matches:\n${top.map((item, index) => `${index + 1}. ${item.label} — ${Math.round(item.score * 100)}% visual match`).join('\n')}\n\nThis is only a visual suggestion, not a confirmed identification. Compare markings and fins with an authoritative local guide, and verify local rules before keeping or releasing the fish.`;
}

window.AnglerRouteLocalAI = {
  async run(action, data) {
    try {
      return action === 'identify_fish' ? await identifyFish(data) : await runText(action, data);
    } catch (error) {
      status.className = 'ai-status error';
      status.textContent = 'On-device AI could not start on this browser. The normal live information remains available.';
      throw new Error(error?.message || 'on-device AI is unavailable');
    }
  },
};

window.dispatchEvent(new Event('anglerroute-ai-ready'));
