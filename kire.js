#!/usr/bin/env node

/**
 * Simple GitHub Models API Server
 * A single-file solution for accessing all 24 GitHub AI models via GET requests
 * 
 * Usage: node simple-github-models.js
 * API: GET /api/models/{model}/chat?q=your_message
 * Compare: GET /api/compare?q=your_message&models=model1,model2
 */

import express from 'express';
import cors from 'cors';
const app = express();
const port = process.env.PORT || 5000;

// GitHub token - replace with your own
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "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";

// All 24 available GitHub Models
const MODELS = [
  'gpt-4o',
  'gpt-4o-mini',
  'AI21-Jamba-Instruct',
  'Cohere-command-r',
  'Cohere-command-r-plus',
  'Cohere-embed-v3-english',
  'Cohere-embed-v3-multilingual',
  'Meta-Llama-3-70B-Instruct',
  'Meta-Llama-3-8B-Instruct',
  'Meta-Llama-3.1-405B-Instruct',
  'Meta-Llama-3.1-70B-Instruct',
  'Meta-Llama-3.1-8B-Instruct',
  'Meta-Llama-3.2-11B-Vision-Instruct',
  'Meta-Llama-3.2-1B-Instruct',
  'Meta-Llama-3.2-3B-Instruct',
  'Meta-Llama-3.2-90B-Vision-Instruct',
  'Mistral-large-2407',
  'Mistral-Nemo',
  'Mistral-small',
  'Phi-3.5-mini-instruct',
  'Phi-3.5-MoE-instruct',
  'Phi-3.5-vision-instruct',
  'Qwen2.5-72B-Instruct',
  'Qwen2.5-Coder-32B-Instruct'
];

// Middleware
app.use(cors());
app.use(express.json());

// Helper function to call GitHub Models API
async function callGitHubModel(model, message, temperature = 0.7, maxTokens = 1000) {
  const startTime = Date.now();
  
  try {
    const response = await fetch("https://models.inference.ai.azure.com/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GITHUB_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: message }],
        temperature,
        max_tokens: maxTokens,
      }),
    });

    const responseTime = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text();
      return {
        model,
        error: errorText,
        responseTime
      };
    }

    const result = await response.json();
    return {
      model,
      response: result.choices?.[0]?.message?.content || "",
      usage: result.usage,
      responseTime
    };
  } catch (error) {
    return {
      model,
      error: error.message,
      responseTime: Date.now() - startTime
    };
  }
}

// Root endpoint - API documentation
app.get('/', (req, res) => {
  res.json({
    name: "Simple GitHub Models API",
    description: "Access all 24 GitHub AI models via simple GET requests",
    version: "1.0.0",
    endpoints: {
      models: "GET /api/models - List all available models",
      chat: "GET /api/models/{model}/chat?q=your_message - Chat with specific model",
      compare: "GET /api/compare?q=your_message&models=model1,model2 - Compare multiple models",
      health: "GET /health - Health check"
    },
    examples: {
      gpt4o: `GET /api/models/gpt-4o/chat?q=Hello world`,
      llama: `GET /api/models/Meta-Llama-3.1-8B-Instruct/chat?q=Explain AI`,
      compare: `GET /api/compare?q=Write a joke&models=gpt-4o,Meta-Llama-3.1-8B-Instruct`
    },
    available_models: MODELS.length,
    authentication: "Pre-configured (no auth required)"
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    models_available: MODELS.length
  });
});

// List all models
app.get('/api/models', (req, res) => {
  const formattedModels = MODELS.map(modelId => ({
    id: modelId,
    name: modelId,
    endpoint: `/api/models/${modelId}/chat?q=your_message`,
    publisher: getPublisher(modelId),
    available: true
  }));

  res.json({
    data: formattedModels,
    total_count: formattedModels.length,
    has_more: false
  });
});

// Chat with individual model
app.get('/api/models/:modelId/chat', async (req, res) => {
  const { modelId } = req.params;
  const { q, temperature, max_tokens } = req.query;
  
  // Validate model exists
  if (!MODELS.includes(modelId)) {
    return res.status(404).json({ 
      error: `Model '${modelId}' not found`,
      available_models: MODELS 
    });
  }
  
  // Validate query parameter
  if (!q || typeof q !== 'string') {
    return res.status(400).json({ 
      error: "Query parameter 'q' is required",
      example: `/api/models/${modelId}/chat?q=Hello world`
    });
  }

  const temp = temperature ? parseFloat(temperature) : 0.7;
  const maxTok = max_tokens ? parseInt(max_tokens) : 1000;

  const result = await callGitHubModel(modelId, q, temp, maxTok);
  
  if (result.error) {
    return res.status(500).json(result);
  }
  
  res.json(result);
});

// Compare multiple models
app.get('/api/compare', async (req, res) => {
  const { q, models, temperature, max_tokens } = req.query;
  
  // Validate query parameter
  if (!q || typeof q !== 'string') {
    return res.status(400).json({ 
      error: "Query parameter 'q' is required",
      example: "/api/compare?q=Hello world&models=gpt-4o,Meta-Llama-3.1-8B-Instruct"
    });
  }
  
  // Validate models parameter
  if (!models || typeof models !== 'string') {
    return res.status(400).json({ 
      error: "Query parameter 'models' is required (comma-separated)",
      example: "/api/compare?q=Hello world&models=gpt-4o,Meta-Llama-3.1-8B-Instruct"
    });
  }
  
  const modelsList = models.split(',').map(m => m.trim());
  
  // Validate all models exist
  const invalidModels = modelsList.filter(model => !MODELS.includes(model));
  if (invalidModels.length > 0) {
    return res.status(400).json({ 
      error: `Invalid models: ${invalidModels.join(', ')}`,
      available_models: MODELS 
    });
  }

  const temp = temperature ? parseFloat(temperature) : 0.7;
  const maxTok = max_tokens ? parseInt(max_tokens) : 1000;

  // Call all models in parallel
  const promises = modelsList.map(model => callGitHubModel(model, q, temp, maxTok));
  const results = await Promise.all(promises);

  res.json({ results });
});

// Get publisher from model name
function getPublisher(modelId) {
  if (modelId.startsWith('gpt-')) return 'OpenAI';
  if (modelId.startsWith('Meta-Llama')) return 'Meta';
  if (modelId.startsWith('Mistral')) return 'Mistral';
  if (modelId.startsWith('Phi-')) return 'Microsoft';
  if (modelId.startsWith('Cohere')) return 'Cohere';
  if (modelId.startsWith('AI21')) return 'AI21 Labs';
  if (modelId.startsWith('Qwen')) return 'Qwen';
  return 'Unknown';
}

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Endpoint not found',
    available_endpoints: [
      'GET /',
      'GET /health',
      'GET /api/models',
      'GET /api/models/{model}/chat?q=message',
      'GET /api/compare?q=message&models=model1,model2'
    ]
  });
});

// Start server
app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Simple GitHub Models API Server running on port ${port}`);
  console.log(`📖 Documentation: http://localhost:${port}/`);
  console.log(`🔍 Health check: http://localhost:${port}/health`);
  console.log(`🤖 Available models: ${MODELS.length}`);
  console.log(`💡 Example: http://localhost:${port}/api/models/gpt-4o/chat?q=Hello`);
});

// Export for testing
export default app; 
