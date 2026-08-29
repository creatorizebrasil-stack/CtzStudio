const OPENAI_URL = 'https://api.openai.com/v1';

function send(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(data));
}

function cleanJson(text) {
  const source = String(text || '').replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
  try { return JSON.parse(source); } catch (_) {
    const start = source.indexOf('{');
    const end = source.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(source.slice(start, end + 1));
    throw new Error('A IA retornou um formato inesperado. Tente novamente.');
  }
}

async function openai(path, body) {
  const response = await fetch(OPENAI_URL + path, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + process.env.OPENAI_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error && data.error.message ? data.error.message : 'Falha na API de IA.');
  return data;
}

async function analyze(image) {
  const response = await openai('/responses', {
    model: 'gpt-5.4-mini',
    store: false,
    input: [{ role: 'user', content: [
      { type: 'input_text', text: 'Analise esta referência visual sem reproduzir marcas, logotipos, marcas-d\'água, pessoas identificáveis ou textos exclusivos. Extraia apenas padrões abstratos de composição, hierarquia, paleta e clima. Crie título e subtítulo novos em português do Brasil para CTZ Studio, com escrita curta e forte. Responda SOMENTE JSON com: composition, hierarchy, palette, mood, title, subtitle, visualPrompt, recommendedStyle. recommendedStyle deve ser exatamente authority, tech, concept ou editorial. visualPrompt deve descrever uma nova imagem original sem texto, sem logotipo e sem marca-d\'água.' },
      { type: 'input_image', image_url: image, detail: 'high' }
    ] }],
    max_output_tokens: 900
  });
  return cleanJson(response.output_text);
}

async function chat(body) {
  const response = await openai('/responses', {
    model: 'gpt-5.4-mini', store: false, max_output_tokens: 650,
    input: 'Você é o diretor criativo do CTZ Studio. Atualize o conteúdo com base no pedido, mantendo linguagem original, direta, em português do Brasil e sem copiar marcas ou frases de terceiros. Responda SOMENTE JSON com title, subtitle, visualPrompt, reply e regenerate (boolean). Estado atual: ' + JSON.stringify({ title: body.title, subtitle: body.subtitle, visualPrompt: body.visualPrompt, analysis: body.analysis }) + '. Pedido: ' + String(body.message || '').slice(0, 1000)
  });
  return cleanJson(response.output_text);
}

async function generate(body) {
  const styles = {
    authority: 'Cinematic editorial portrait advertising: one confident adult professional, centered or slightly off-center, dark neutral wardrobe, subtle film grain, controlled studio lighting, orange rim light, deep black background, premium personal-brand campaign. The person must be fictional and not resemble any real public or reference person.',
    tech: 'Premium technology advertising: one hero device, interface, futuristic machine or digital object, black environment, electric orange glow, clean geometric composition, subtle data grid, realistic materials, high-end product visualization.',
    concept: 'Cinematic conceptual advertising: one memorable visual metaphor related to strategy, growth, branding or innovation, dramatic scale, volumetric orange light, deep shadows, realistic detail, bold negative space.',
    editorial: 'Bright premium editorial advertising: warm white background, black and orange accents, elegant object arrangement, refined soft shadows, modern magazine layout, minimal but visually distinctive.'
  };
  const styleDirection = styles[body.style] || styles.authority;
  const prompt = [
    'Create an original premium social media background for CTZ Studio, vertical 4:5 composition.',
    styleDirection,
    'Use a polished agency-campaign look with a clear focal point and excellent visual hierarchy.',
    String(body.visualPrompt || ''), String(body.instruction || ''),
    'Leave intentional negative space in the upper or middle third for a bold headline and a short paragraph. Keep the important subject clear of that text-safe area.',
    'No words, no letters, no typography, no logos, no watermarks, no social handles, no copied brand elements.'
  ].join(' ');
  const response = await openai('/images/generations', {
    model: 'gpt-image-2', prompt, size: '1024x1536', quality: 'medium', output_format: 'png'
  });
  const image = response.data && response.data[0] && response.data[0].b64_json;
  if (!image) throw new Error('A imagem não foi retornada. Tente novamente.');
  return { image };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Método não permitido.' });
  if (!process.env.OPENAI_API_KEY) return send(res, 503, { error: 'A variável OPENAI_API_KEY ainda não foi configurada na Vercel.' });
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    if (body.action === 'analyze') {
      if (!/^data:image\/(png|jpeg|webp);base64,/i.test(body.image || '')) return send(res, 400, { error: 'Imagem inválida.' });
      return send(res, 200, await analyze(body.image));
    }
    if (body.action === 'chat') return send(res, 200, await chat(body));
    if (body.action === 'generate') return send(res, 200, await generate(body));
    return send(res, 400, { error: 'Ação inválida.' });
  } catch (error) {
    console.error('post-ai:', error.message);
    return send(res, 500, { error: error.message || 'Erro ao processar a solicitação.' });
  }
};

module.exports.config = { maxDuration: 60 };
