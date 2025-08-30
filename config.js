// Configurações do Renomeador de NF - GDM

module.exports = {
  // Configurações do servidor
  server: {
    port: process.env.PORT || 5000,
    host: process.env.HOST || 'localhost'
  },

  // Configurações do frontend
  frontend: {
    url: process.env.FRONTEND_URL || 'http://localhost:3000',
    port: process.env.FRONTEND_PORT || 3000,
    host: process.env.FRONTEND_HOST || 'localhost'
  },

  // CFOPs válidos para processamento
  cfopValidos: ['2411', '6202', '5202'],

  // Padrões de extração de dados
  patterns: {
    // Padrões para número da NF
    numeroNF: [
      /N\s*\.?\s*DA\s*NF\s*(\d+)/i,
      /N\s*\.?\s*NF\s*(\d+)/i,
      /NF\s*(\d+)/i,
      /DANFE\s*N\s*\.?\s*(\d+)/i
    ],

    // Padrões para CNPJ
    cnpj: [
      /CNPJ:\s*(\d{2}\.\d{3}\.\d{3}\/\d{4}\-\d{2})/,
      /CNPJ\s*(\d{2}\.\d{3}\.\d{3}\/\d{4}\-\d{2})/,
      /(\d{2}\.\d{3}\.\d{3}\/\d{4}\-\d{2})/
    ],

    // Padrões para razão social
    razaoSocial: [
      /Razão Social:\s*(.*?)(?:\n|$)/i,
      /Razão Social\s*(.*?)(?:\n|$)/i,
      /Nome:\s*(.*?)(?:\n|$)/i
    ],

    // Padrões para data de emissão
    dataEmissao: [
      /Data de Emissão:\s*(\d{2}\/\d{2}\/\d{4})/,
      /Data Emissão:\s*(\d{2}\/\d{2}\/\d{4})/,
      /Emissão:\s*(\d{2}\/\d{2}\/\d{4})/,
      /(\d{2}\/\d{2}\/\d{4})/
    ],

    // Padrões para valor total
    valorTotal: [
      /VALOR TOTAL DA NOTA\s*R\$\s*([\d\.,]+)/i,
      /VALOR TOTAL\s*R\$\s*([\d\.,]+)/i,
      /TOTAL\s*R\$\s*([\d\.,]+)/i,
      /R\$\s*([\d\.,]+)/i
    ],

    // Padrões para dados adicionais
    dadosAdicionais: [
      /INFORMAÇÕES COMPLEMENTARES\s*.*?número:\s*(\d+)\s*Motivo:\s*(.*?)(?:\n|$)/is,
      /DADOS ADICIONAIS\s*.*?número:\s*(\d+)\s*Motivo:\s*(.*?)(?:\n|$)/is,
      /número:\s*(\d+)\s*Motivo:\s*(.*?)(?:\n|$)/is
    ]
  },

  // Configurações de arquivos
  files: {
    // Caminho para a base de clientes
    clientesPath: '../renomeador-nf-gdm-app/public/DADOSCLIENTES.xlsx',
    
    // Diretórios
    uploadDir: 'uploads',
    processedDir: 'processed_pdfs',
    
    // Extensões aceitas
    acceptedExtensions: ['.pdf']
  },

  // Configurações de validação
  validation: {
    // Tamanho máximo do arquivo (em bytes)
    maxFileSize: 10 * 1024 * 1024, // 10MB
    
    // Número máximo de arquivos por upload
    maxFiles: 50
  },

  // Configurações de logging
  logging: {
    level: 'info', // 'error', 'warn', 'info', 'debug'
    enableConsole: true,
    enableFile: false,
    logFile: 'logs/app.log'
  },

  // Configurações de segurança
  security: {
    // Headers de segurança
    headers: {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block'
    },
    
    // CORS
    cors: {
      origin: function(origin, callback) {
        const allowedOrigins = [
          process.env.FRONTEND_URL || 'http://localhost:3000', 
          'http://127.0.0.1:3000',
          'https://renomeador-nf-gdm-frontend.onrender.com',
          'https://renomeador-nf-gdm-frontend-4all.onrender.com'
        ];
        // Permitir requisições sem origin (como mobile apps ou curl)
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
          callback(null, true);
        } else {
          console.log('Origem bloqueada por CORS:', origin);
          callback(null, true); // Temporariamente permitindo todas as origens
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization']
    }
  },

  // Configurações de performance
  performance: {
    // Timeout para processamento de PDF (em ms)
    pdfTimeout: 30000,
    
    // Número máximo de arquivos processados simultaneamente
    maxConcurrentFiles: 5
  }
};