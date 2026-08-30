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

function responseText(response) {
  if (typeof response.output_text === 'string' && response.output_text.trim()) return response.output_text;
  const parts = [];
  for (const item of response.output || []) {
    if (item.type !== 'message') continue;
    for (const content of item.content || []) {
      if ((content.type === 'output_text' || content.type === 'text') && typeof content.text === 'string') parts.push(content.text);
    }
  }
  if (!parts.length) throw new Error('A IA não retornou texto. Tente novamente.');
  return parts.join('\n');
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
    text: { format: { type: 'json_schema', name: 'post_analysis', strict: true, schema: {
      type: 'object', additionalProperties: false,
      properties: {
        composition: { type: 'string' }, hierarchy: { type: 'string' }, palette: { type: 'string' }, mood: { type: 'string' },
        title: { type: 'string' }, subtitle: { type: 'string' }, visualPrompt: { type: 'string' },
        recommendedStyle: { type: 'string', enum: ['authority', 'tech', 'concept', 'editorial'] }
      },
      required: ['composition', 'hierarchy', 'palette', 'mood', 'title', 'subtitle', 'visualPrompt', 'recommendedStyle']
    } } },
    input: [{ role: 'user', content: [
      { type: 'input_text', text: 'Analise esta referência visual sem reproduzir marcas, logotipos, marcas-d\'água, pessoas identificáveis ou textos exclusivos. Extraia apenas padrões abstratos de composição, hierarquia, paleta e clima. Crie título e subtítulo novos em português do Brasil para CTZ Studio, com escrita curta e forte. Responda SOMENTE JSON com: composition, hierarchy, palette, mood, title, subtitle, visualPrompt, recommendedStyle. recommendedStyle deve ser exatamente authority, tech, concept ou editorial. visualPrompt deve descrever uma nova imagem original sem texto, sem logotipo e sem marca-d\'água.' },
      { type: 'input_image', image_url: image, detail: 'high' }
    ] }],
    max_output_tokens: 900
  });
  return cleanJson(responseText(response));
}

async function chat(body) {
  const response = await openai('/responses', {
    model: 'gpt-5.4-mini', store: false, max_output_tokens: 650,
    text: { format: { type: 'json_schema', name: 'post_revision', strict: true, schema: {
      type: 'object', additionalProperties: false,
      properties: { title: { type: 'string' }, subtitle: { type: 'string' }, visualPrompt: { type: 'string' }, reply: { type: 'string' }, regenerate: { type: 'boolean' } },
      required: ['title', 'subtitle', 'visualPrompt', 'reply', 'regenerate']
    } } },
    input: 'Você é o diretor criativo do CTZ Studio. Atualize o conteúdo com base no pedido, mantendo linguagem original, direta, em português do Brasil e sem copiar marcas ou frases de terceiros. Responda SOMENTE JSON com title, subtitle, visualPrompt, reply e regenerate (boolean). Estado atual: ' + JSON.stringify({ title: body.title, subtitle: body.subtitle, visualPrompt: body.visualPrompt, analysis: body.analysis }) + '. Pedido: ' + String(body.message || '').slice(0, 1000)
  });
  return cleanJson(responseText(response));
}

async function reviseCarouselCopy(body) {
  const pages = Array.isArray(body.pages) ? body.pages.slice(0, 15).map((page) => String(page || '').slice(0, 1600)) : [];
  if (!pages.length) throw new Error('Nenhum texto foi enviado para revisão.');
  const requestedCount = Math.max(1, Math.min(Number(body.count) || pages.length, 15));
  const source = String(body.source || pages.join('\n\n')).slice(0, 12000);
  const response = await openai('/responses', {
    model: 'gpt-5.4-mini', store: false, max_output_tokens: 2200,
    text: { format: { type: 'json_schema', name: 'carousel_copy_revision', strict: true, schema: {
      type: 'object', additionalProperties: false,
      properties: {
        pages: { type: 'array', minItems: 1, maxItems: 15, items: { type: 'string' } }
      },
      required: ['pages']
    } } },
    input: [
      { role: 'system', content: 'Você é o CTZ COPY VIRAL, especialista em textos estratégicos para carrosséis da Creatorize. Transforme o conteúdo bruto em um carrossel claro, útil, humano e fácil de consumir. Use AIDA: a primeira folha prende a Atenção com um gancho forte e específico; as folhas seguintes geram Interesse com uma dor, dúvida ou oportunidade reconhecível; depois criam Desejo mostrando benefício, transformação ou solução; a última conclui e traz uma Ação coerente. Preserve rigorosamente fatos, nomes, números, datas e a intenção original. Nunca invente dados, pesquisas, resultados ou promessas. Elimine frases sem informação, repetições, redundâncias, introduções longas, explicações óbvias, clichês, exageros, adjetivos excessivos, metacomentários e instruções de produção. Não use expressões genéricas como “no mundo de hoje” ou “é importante destacar”. Troque palavras difíceis por linguagem simples, divida frases longas e mantenha uma única ideia por folha. A headline deve complementar o apoio, sem repeti-lo. Cada folha deve ter aproximadamente 15 a 30 palavras e despertar interesse pela próxima. Não use hashtags, emojis ou termos técnicos, salvo se já forem indispensáveis no conteúdo de origem. Evite aparência de texto produzido por IA e preserve naturalidade, personalidade e ritmo humano. Formate cada item exatamente como **HEADLINE CURTA E FORTE**, uma linha em branco e o texto de apoio. A headline inteira deve estar entre **. No apoio, destaque com ** somente uma a três palavras-chave ou trechos curtos; nunca um parágrafo inteiro. Faça internamente uma segunda revisão e corte novamente tudo que não contribui para a mensagem central. Entregue exatamente a quantidade solicitada, na ordem narrativa, sem rótulos como “Folha”, “Capa”, “Contexto” ou explicações externas. Retorne somente o JSON solicitado.' },
      { role: 'user', content: JSON.stringify({ requestedCount, source, draftPages: pages }) }
    ]
  });
  const result = cleanJson(responseText(response));
  if (!Array.isArray(result.pages) || result.pages.length !== requestedCount) throw new Error('A revisão retornou uma quantidade diferente de páginas.');
  return result;
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
    if (body.action === 'revise-copy') return send(res, 200, await reviseCarouselCopy(body));
    if (body.action === 'generate') return send(res, 200, await generate(body));
    return send(res, 400, { error: 'Ação inválida.' });
  } catch (error) {
    console.error('post-ai:', error.message);
    return send(res, 500, { error: error.message || 'Erro ao processar a solicitação.' });
  }
};

module.exports.config = { maxDuration: 60 };
