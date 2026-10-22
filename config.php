<?php
/**
 * LenChat - config.php
 *
 * Copyright (c) 2026 Leonard Muia t/a LENTECH DIGIWORKS (https://lentech.co.ke)
 * Licensed under AGPL-3.0 with additional attribution terms - see LICENSE and NOTICE.md.
 * NEVER put API keys in this file. Keys live only in each visitor's browser
 
 * Works on PHP 7.4+.
 */
declare(strict_types=1);

return [

    'app_name'         => 'LenChat',
    'version'          => '4.0.0',
    'default_provider' => 'groq',

    'stream_endpoint'  => 'api/stream.php',

    'providers' => [
        'groq' => [
            'label'    => 'Groq',
            'kind'     => 'openai',
            'base_url' => 'https://api.groq.com/openai/v1',
            'models'   => ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'openai/gpt-oss-120b', 'openai/gpt-oss-20b'],
            'local'    => false,
        ],
        'openai' => [
            'label'    => 'OpenAI',
            'kind'     => 'openai',
            'base_url' => 'https://api.openai.com/v1',
            'models'   => ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1', 'gpt-4.1-mini'],
            'local'    => false,
        ],
        'azure' => [
            'label'       => 'Azure OpenAI',
            'kind'        => 'azure',
            'base_url'    => '',
            'api_version' => '2024-10-21',
            'models'      => [],
            'local'       => false,
        ],
        'gemini' => [
            'label'    => 'Google Gemini',
            'kind'     => 'gemini',
            'base_url' => 'https://generativelanguage.googleapis.com/v1beta',
            'models'   => ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.5-flash-lite', 'gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite', 'gemini-4-argon'],
            'local'    => false,
        ],
        'anthropic' => [
            'label'    => 'Anthropic',
            'kind'     => 'anthropic',
            'base_url' => 'https://api.anthropic.com/v1',
            'models'   => ['claude-sonnet-5-5', 'claude-opus-5-5', 'claude-haiku-5-5'],
            'local'    => false,
        ],
        'deepseek' => [
            'label'    => 'DeepSeek',
            'kind'     => 'openai',
            'base_url' => 'https://api.deepseek.com',
            'models'   => ['deepseek-chat', 'deepseek-reasoner'],
            'local'    => false,
        ],
        'xai' => [
            'label'    => 'xAI',
            'kind'     => 'openai',
            'base_url' => 'https://api.x.ai/v1',
            'models'   => ['grok-4', 'grok-3-mini'],
            'local'    => false,
        ],
        'moonshot' => [
            'label'    => 'Moonshot (Kimi)',
            'kind'     => 'openai',
            'base_url' => 'https://api.moonshot.ai/v1',
            'models'   => ['kimi-k2-0905-preview', 'moonshot-v1-8k', 'moonshot-v1-32k'],
            'local'    => false,
        ],
        'alibaba' => [
            'label'    => 'Alibaba (Qwen)',
            'kind'     => 'openai',
            'base_url' => 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
            'models'   => ['qwen-plus', 'qwen-max', 'qwen-turbo', 'qwen3-coder-plus'],
            'local'    => false,
        ],
        'bytedance' => [
            'label'    => 'ByteDance (Doubao)',
            'kind'     => 'openai',
            'base_url' => 'https://ark.cn-beijing.volces.com/api/v3',
            'models'   => ['doubao-1-5-pro-32k-250115', 'doubao-1-5-lite-32k-250115'],
            'local'    => false,
        ],
        'tencent' => [
            'label'    => 'Tencent (Hunyuan)',
            'kind'     => 'openai',
            'base_url' => 'https://api.hunyuan.cloud.tencent.com/v1',
            'models'   => ['hunyuan-turbo', 'hunyuan-large', 'hunyuan-lite'],
            'local'    => false,
        ],
        'baidu' => [
            'label'    => 'Baidu (ERNIE)',
            'kind'     => 'openai',
            'base_url' => 'https://qianfan.baidubce.com/v2',
            'models'   => ['ernie-4.5-turbo-128k', 'ernie-4.0-turbo-8k', 'ernie-speed-128k'],
            'local'    => false,
        ],
        'iflytek' => [
            'label'    => 'iFlytek (Spark)',
            'kind'     => 'openai',
            'base_url' => 'https://spark-api-open.xf-yun.com/v1',
            'models'   => ['generalv3.5', '4.0Ultra', 'lite'],
            'local'    => false,
        ],
        'chatglm' => [
            'label'    => 'ChatGLM (Zhipu)',
            'kind'     => 'openai',
            'base_url' => 'https://open.bigmodel.cn/api/paas/v4',
            'models'   => ['glm-4-flash', 'glm-4-plus', 'glm-4-air'],
            'local'    => false,
        ],
        'siliconflow' => [
            'label'    => 'SiliconFlow',
            'kind'     => 'openai',
            'base_url' => 'https://api.siliconflow.com/v1',
            'models'   => ['deepseek-ai/DeepSeek-V3', 'Qwen/Qwen2.5-72B-Instruct', 'THUDM/glm-4-9b-chat'],
            'local'    => false,
        ],
        'ai302' => [
            'label'    => '302.AI',
            'kind'     => 'openai',
            'base_url' => 'https://api.302.ai/v1',
            'models'   => ['gpt-4o-mini', 'gpt-4o', 'deepseek-chat'],
            'local'    => false,
        ],
        'openrouter' => [
            'label'    => 'OpenRouter',
            'kind'     => 'openai',
            'base_url' => 'https://openrouter.ai/api/v1',
            'models'   => ['openai/gpt-4o-mini', 'anthropic/claude-sonnet-4.5', 'google/gemini-2.5-flash'],
            'local'    => false,
        ],
        'lentech' => [
            'label'    => 'LenTech AI',
            'kind'     => 'openai',
            'base_url' => 'https://ai.lentech.co.ke/v1',
            'models'   => [],
            'local'    => false,
        ],
        'ollama' => [
            'label'    => 'Ollama (local)',
            'kind'     => 'openai',
            'base_url' => 'http://localhost:11434/v1',
            'models'   => ['llama3.2', 'qwen2.5-coder', 'deepseek-r1'],
            'local'    => true,
        ],
        'custom' => [
            'label'    => 'Custom (OpenAI-compatible)',
            'kind'     => 'openai',
            'base_url' => '',
            'models'   => [],
            'local'    => false,
        ],
    ],

    'defaults' => [
        'max_tokens'   => 4096,
        'context_mode' => 'last',
        'context_n'    => 6,
    ],

    'relay' => [
        'enabled'             => true,
        'access_token'        => '',
        'allowed_hosts'       => [
            'api.groq.com',
            'api.openai.com',
            '*.openai.azure.com',
            '*.cognitiveservices.azure.com',
            'generativelanguage.googleapis.com',
            'api.anthropic.com',
            'api.deepseek.com',
            'api.x.ai',
            'api.moonshot.ai',
            'api.moonshot.cn',
            'dashscope-intl.aliyuncs.com',
            'dashscope.aliyuncs.com',
            'ark.cn-beijing.volces.com',
            'api.hunyuan.cloud.tencent.com',
            'qianfan.baidubce.com',
            'spark-api-open.xf-yun.com',
            'open.bigmodel.cn',
            'api.siliconflow.com',
            'api.siliconflow.cn',
            'api.302.ai',
            'openrouter.ai',
            'ai.lentech.co.ke',
        ],
        'allow_custom_hosts'  => false,
        'allow_private_hosts' => false,
        'max_body_bytes'      => 4 * 1024 * 1024,
        'connect_timeout'     => 15,
        'timeout'             => 300,
    ],

    'limits' => [
        'max_file_bytes'  => 262144,
        'max_total_chars' => 600000,
        'max_files'       => 300,
        'max_images'      => 6,
        'max_doc_bytes'   => 15728640,
        'max_zip_bytes'   => 52428800,
        'max_zip_entries' => 2000,
        'image_max_edge'  => 1600,
    ],

    'vision' => [
        'ocr_src'       => 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js',
        'ocr_integrity' => 'sha384-GJqSu7vueQ9qN0E9yLPb3Wtpd7OrgK8KmYzC8T1IysG1bcvxvIO4qtYR/D3A991F',
        'ocr_lang'      => 'eng',
    ],

    'libs' => [
        'jszip'        => ['src' => 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js', 'integrity' => '', 'global' => 'JSZip'],
        'mammoth'      => ['src' => 'https://cdn.jsdelivr.net/npm/mammoth@1.8.0/mammoth.browser.min.js', 'integrity' => '', 'global' => 'mammoth'],
        'sheetjs'      => ['src' => 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js', 'integrity' => '', 'global' => 'XLSX'],
        'pdfjs'        => ['src' => 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js', 'integrity' => '', 'global' => 'pdfjsLib'],
        'pdfjs_worker' => ['src' => 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js'],
    ],

    'image' => [
        'pollinations' => 'https://image.pollinations.ai/prompt/',
    ],

    'update' => [
        'repo'         => 'lenny-tishay/LenChat',
        'branch'       => 'main',
        'auto_enabled' => false,
        'token'        => '',
    ],

    'security' => [
        'send_csp' => true,
    ],
];
