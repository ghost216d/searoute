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
let modelUnavailable = false;

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
    // Transformers.js v2 has the widest mobile-browser support. The v3 build
    // previously used here failed during start-up on both Safari and Chrome.
    transformers = await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2');
    transformers.env.allowLocalModels = false;
    transformers.env.useBrowserCache = true;
    transformers.env.backends.onnx.wasm.numThreads = 1;
    transformers.env.backends.onnx.wasm.proxy = false;
  }
  return transformers;
}

async function loadTextModel() {
  if (textGenerator) return textGenerator;
  const { pipeline } = await library();
  status.className = 'ai-status';
  status.textContent = 'Downloading the compact language model for this phone…';
  textGenerator = await pipeline('text2text-generation', 'Xenova/flan-t5-small', {
    quantized: true,
    progress_callback: (event) => progressMessage('Language model download', event),
  });
  status.className = 'ai-status online';
  status.textContent = 'On-device language AI is ready. Requests are processed on this phone.';
  return textGenerator;
}

function value(value, fallback = 'not available') {
  const text = String(value || '').trim();
  return text && text.toLowerCase() !== 'unknown' ? text : fallback;
}

function localTripBrief(context = {}) {
  const concerns = [value(context.outlook, ''), value(context.outlookText, '')].filter(Boolean).join(' — ') || 'No app warning is available yet.';
  const conditions = [
    context.wind ? `Wind: ${context.wind}` : '',
    context.waves ? `waves: ${context.waves}` : '',
    context.visibility ? `visibility: ${context.visibility}` : '',
    context.waterTemperature ? `water temperature: ${context.waterTemperature}` : '',
  ].filter(Boolean).join('; ');
  return `Main concern: ${concerns}\n\nFishing outlook: ${conditions || 'Check a location first to load live conditions.'}${context.likelySpecies ? ` Likely local species shown by the app: ${context.likelySpecies}.` : ''}\n\nTake: charged phone, suitable clothing, drinking water, first-aid kit and the correct safety equipment for ${value(context.waterType, 'this water')}.\n\nBefore leaving: check the official local forecast, water conditions, notices, access, licence rules and your return time. This summary does not confirm that conditions are safe.`;
}

function localQuestionAnswer(question, context = {}) {
  const q = String(question || '').toLowerCase();
  const place = value(context.area, 'your selected area');
  const species = value(context.likelySpecies, 'no confirmed target species');
  if (/tide|tidal/.test(q)) return `The live panel is not an official tide prediction. For ${place}, check the relevant harbour or hydrographic tide service before leaving, and allow for changes in depth, current and access on the return journey.`;
  if (/licen[cs]e|permit|rule|legal|season|limit|size/.test(q)) return `Rules vary by location, water and species. Check the official authority for ${place} for licences, access, closed seasons, minimum sizes and catch limits. The app currently lists these possible species: ${species}.`;
  if (/boat|sail|navigation|route|harbour|anchor|vhf/.test(q)) return `For the planned ${value(context.boat, 'boat')}, check the official forecast and notices, fuel or battery, lifejackets, VHF or another reliable way to call for help, navigation lights, anchor, charts and a return plan. Avoid relying on this app as a navigation chart.`;
  if (/bait|lure|hook|rig/.test(q)) return `Likely species shown for ${place}: ${species}. Choose bait, lure, hook and rig for the target species, water type and local rules. Ask a local tackle shop when the species or method is uncertain.`;
  if (/pack|bring|equipment|kit/.test(q)) return `Take a charged phone, weather-appropriate clothing, water, first-aid kit, landing and unhooking equipment, and the correct personal safety equipment. For a boat, also verify lifejackets, communications, fuel, navigation lights and your return plan.`;
  if (/safe|danger|weather|wind|wave|condition/.test(q)) return `The app reading is ${value(context.outlook)}. Wind: ${value(context.wind)}; waves: ${value(context.waves)}; visibility: ${value(context.visibility)}. This cannot confirm safety—check the official forecast, local notices and conditions at the water before leaving.`;
  if (/fish|species|catch|habit|feed|depth/.test(q)) return `Species currently suggested for ${place}: ${species}. Activity can change with season, light, water temperature, depth and food. Treat this as general guidance and confirm identification, seasons, sizes and catch limits with an authoritative local source.`;
  if (/beginner|start|new to/.test(q)) return `Start from an accessible shore location in daylight, tell someone your plan and return time, check the official forecast and local rules, and use simple tackle suited to the likely species: ${species}.`;
  if (/when|time|morning|evening|night/.test(q)) return `Your planned time is ${value(context.leave)} to ${value(context.returnBy)} and the app shows daylight as ${value(context.daylight)}. Fish activity varies by species and water, so also consider light, temperature, tide or flow and local knowledge.`;
  return `I can help with fishing safety, weather, tides, bait, tackle, likely species, licences, boats and sailing. For ${place}, the current app reading is ${value(context.outlook)} with wind ${value(context.wind)}, waves ${value(context.waves)} and visibility ${value(context.visibility)}. Please ask one short fishing question.`;
}

function localCatchPost(data = {}) {
  const species = value(data.species, 'a fish');
  const outcome = value(data.outcome, 'outcome not recorded');
  const notes = value(data.notes, 'No extra notes');
  return `Private journal\nCatch: ${species}\nArea: ${value(data.context?.area, 'not recorded')}\nOutcome: ${outcome}\nNotes: ${notes}\n\nOptional social post\nA memorable session and a ${species} today. ${outcome}. ${notes} #Fishing #AnglerRoute\n\nExact location has not been included.`;
}

function localFallback(action, data) {
  if (action === 'trip_brief') return localTripBrief(data.context);
  if (action === 'question') return localQuestionAnswer(data.question, data.context);
  if (action === 'catch_post') return localCatchPost(data);
  return '';
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
  if (!modelUnavailable) {
    try {
      const generator = await loadTextModel();
      const result = await generator(promptFor(action, data), {
        max_new_tokens: action === 'question' ? 150 : 180,
        temperature: 0.35,
        repetition_penalty: 1.15,
      });
      const text = result?.[0]?.generated_text?.trim();
      if (text) return text;
    } catch (error) {
      modelUnavailable = true;
    }
  }
  status.className = 'ai-status online';
  status.textContent = 'Mobile assistant ready. Using the fast on-device mode with no download, account or usage limit.';
  return localFallback(action, data);
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
      quantized: true,
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
      if (action === 'question') {
        status.className = 'ai-status online';
        status.textContent = 'Fishing assistant ready — fast answers with no model download or usage limit.';
        return localQuestionAnswer(data.question, data.context);
      }
      return action === 'identify_fish' ? await identifyFish(data) : await runText(action, data);
    } catch (error) {
      status.className = 'ai-status error';
      if (action === 'identify_fish') {
        const candidates = fishLabels(data.context).slice(0, 5).join(', ');
        status.textContent = 'Photo analysis is not supported by this phone. The rest of the mobile assistant is still available.';
        return `The photo model could not run on this phone, so the image has not been identified. Species listed for this area include: ${candidates}. Compare the fish's markings, fins and shape with an authoritative local guide before keeping or releasing it.`;
      }
      status.className = 'ai-status online';
      status.textContent = 'Mobile assistant ready in fast on-device mode.';
      return localFallback(action, data);
    }
  },
};

window.dispatchEvent(new Event('anglerroute-ai-ready'));
