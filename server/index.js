const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const PDFParser = require('pdf-parse');
const { PDFDocument } = require('pdf-lib');
const xlsx = require('xlsx');
const config = require('../config');
const csvParse = require('csv-parse/sync');
const archiver = require('archiver');

const app = express();
const port = config.server.port;

const CLIENTES_DATA_PATH = path.join(__dirname, config.files.clientesPath);

// Carregar dados de clientes de XLSX e CSV
let clientesData = [];
const loadClientesData = () => {
    try {
        // XLSX
        const workbook = xlsx.readFile(CLIENTES_DATA_PATH);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        clientesData = xlsx.utils.sheet_to_json(sheet);
        // CSV
        const csvPath = path.join(__dirname, '../renomeador-nf-gdm-app/public/DADOSCLIENTES.CSV');
        if (fs.existsSync(csvPath)) {
            const csvContent = fs.readFileSync(csvPath, 'utf8');
            // Detecta delimitador automaticamente: se houver mais ';' que ',' na primeira linha, usa ';'
            const firstLine = csvContent.split('\n')[0];
            const delimiter = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ';' : ',';
            const csvRows = csvParse.parse(csvContent, { columns: true, skip_empty_lines: true, delimiter });
            // Normaliza os campos do cabeçalho
            const normalizeKey = key => key.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]/g, '').toLowerCase();
            const normalizedRows = csvRows.map(row => {
                const newRow = {};
                Object.keys(row).forEach(key => {
                    newRow[normalizeKey(key)] = row[key];
                });
                return newRow;
            });
            clientesData = normalizedRows.concat(clientesData);
        }
        console.log('Dados de clientes carregados com sucesso.');
        // Logar todos os CNPJs carregados
        console.log('CNPJs carregados:', clientesData.map(c => c['cnpjemitente']));
    } catch (error) {
        console.error('Erro ao carregar dados de clientes:', error);
    }
};

// Carregar dados de clientes ao iniciar o servidor
loadClientesData();

// Configurar CORS
app.use(cors(config.security.cors));
app.use(express.json());

// Configurar headers de segurança
Object.entries(config.security.headers).forEach(([key, value]) => {
    app.use((req, res, next) => {
        res.setHeader(key, value);
        next();
    });
});

const uploadDir = path.join(__dirname, config.files.uploadDir);
const processedPdfsDir = path.join(__dirname, config.files.processedDir);

// Garante que os diretórios existam
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
if (!fs.existsSync(processedPdfsDir)) fs.mkdirSync(processedPdfsDir);

// Configurar multer com validações
const upload = multer({
    dest: uploadDir,
    limits: {
        fileSize: config.validation.maxFileSize,
        files: config.validation.maxFiles
    },
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (config.files.acceptedExtensions.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Tipo de arquivo não suportado. Apenas PDFs são aceitos.'));
        }
    }
});

// Endpoint de teste
app.get('/', (req, res) => {
    res.json({
        message: 'Backend is running!',
        version: '1.0.0',
        endpoints: {
            upload: '/upload',
            files: '/files',
            download: '/download/:filename'
        }
    });
});

// Função para processar um único arquivo PDF
async function processFile(file, uploadDir, processedPdfsDir, clientesData) {
    const filePath = path.join(uploadDir, file.filename);
    console.log('Processando arquivo:', filePath, fs.existsSync(filePath));
    let extractedData = {};
    try {
        const dataBuffer = fs.readFileSync(filePath);
        const pdf = await PDFParser(dataBuffer, {
            // Definir um timeout para evitar que arquivos problemáticos travem o processamento
            timeout: config.performance.pdfTimeout
        });
        const text = pdf.text;
        
        // Extração de dados do PDF
        const extractData = (pdfText) => {
            const data = {};

            // 1. Razão Social
            const razaoMatch = pdfText.match(/IDENTIFICA[ÇC][ÃA]O DO EMITENTE\n([A-Z0-9\s\/\-\.]+)\n/);
            data.razaoSocial = razaoMatch ? razaoMatch[1].trim() : '';

            // 2. Número da NF
            const numeroNFMatch = pdfText.match(/N[ºo\.]*\s*([0-9\.]+)/i);
            data.numeroNF = numeroNFMatch ? numeroNFMatch[1].replace(/\D/g, '') : 'N/A';

            // 3. Natureza da Operação
            const naturezaMatch = pdfText.match(/NATUREZA DA OP[ÊE]RA[ÇC][ÃA]O[\s:]*([A-Z\s]+)/i);
            if (naturezaMatch) {
                data.naturezaOperacao = naturezaMatch[1].split('\n')[0].trim();
            } else {
                const devMatch = pdfText.match(/\n\s*(DEV\w+)/i);
                data.naturezaOperacao = devMatch ? devMatch[1].trim() : 'N/A';
            }

            // 4. CNPJ
            const cnpjMatch = pdfText.match(/CNPJ[\s:]*([0-9\.\/\-]+)/i);
            data.cnpjEmitente = cnpjMatch ? cnpjMatch[1] : 'N/A';

            // 5. Data de Emissão
            const dataEmissaoMatch = pdfText.match(/DATA DA EMISS[ÃA]O[\s:]*([0-9]{2}\/[0-9]{2}\/[0-9]{4})/i);
            data.dataEmissao = dataEmissaoMatch ? dataEmissaoMatch[1] : 'N/A';

            // 6. Valor Total
            const valorTotalMatch = pdfText.match(/V\.\s*TOTAL DA NOTA[\s:]*([0-9\.,]+)/i);
            data.valorTotal = valorTotalMatch ? valorTotalMatch[1].replace(/[^0-9\,\.]/g, '') : 'N/A';

            // 7 e 8. Número Adicional e Motivo
            const dadosAdicionaisMatch = pdfText.match(/INFORMA[ÇC][ÕO]ES COMPLEMENTARES[\s\S]*?N[ºo\.]*\s*([0-9]+)[\s\S]*?Motivo:\s*([A-Za-z\s]+)/i);
            const refProdutoMatch = pdfText.match(/Ref\.\s*NF:\s*([0-9]+),\s*Serie\s*[0-9]+,\s*de\s*[0-9]{2}\/[0-9]{2}\/[0-9]{4}/i);
            const motivoMatch = pdfText.match(/Motivo:\s*([^\-\n]+)\s*\-/i);
            
            if (dadosAdicionaisMatch) {
                data.numeroAdicional = dadosAdicionaisMatch[1];
                data.motivoAdicional = dadosAdicionaisMatch[2].trim();
            } else if (refProdutoMatch || motivoMatch) {
                data.numeroAdicional = refProdutoMatch ? refProdutoMatch[1] : '';
                data.motivoAdicional = motivoMatch ? motivoMatch[1].trim() : '';
            } else {
                data.numeroAdicional = '';
                data.motivoAdicional = '';
            }

            // 9. CFOP
            const cfopMatches = pdfText.match(/\b(2411|5202|6202)\b/g);
            const cfopLinha = pdfText.match(/CFOP\s*([0-9]{4})/i);
            data.cfop = cfopLinha ? cfopLinha[1] : (cfopMatches ? cfopMatches[0] : 'N/A');

            return data;
        };

        extractedData = extractData(text);
        console.log(`Dados extraídos do arquivo ${file.originalname}:`, extractedData.numeroNF, extractedData.cnpjEmitente);
        
        return { file, extractedData, text, filePath };
    } catch (error) {
        console.error(`Erro ao processar arquivo ${file.originalname}:`, error);
        throw error;
    }
}

// Função para processar arquivos em lotes
async function processBatch(files, uploadDir, processedPdfsDir, clientesData, batchSize, batchInterval) {
    const results = [];
    const totalFiles = files.length;
    
    // Processar arquivos em lotes para evitar sobrecarga de memória
    for (let i = 0; i < totalFiles; i += batchSize) {
        const batch = files.slice(i, i + batchSize);
        console.log(`Processando lote ${Math.floor(i/batchSize) + 1}/${Math.ceil(totalFiles/batchSize)} (${batch.length} arquivos)`);
        
        // Processar cada arquivo do lote em paralelo, mas limitado pelo maxConcurrentFiles
        const batchPromises = batch.map(file => {
            return new Promise(async (resolve) => {
                try {
                    const result = await processFile(file, uploadDir, processedPdfsDir, clientesData);
                    resolve({
                        file: file,
                        success: true,
                        result: result
                    });
                } catch (error) {
                    console.error(`Erro ao processar ${file.originalname}:`, error.message);
                    resolve({
                        file: file,
                        success: false,
                        error: error.message
                    });
                    
                    // Remover arquivo temporário em caso de erro
                    try {
                        const filePath = path.join(uploadDir, file.filename);
                        if (fs.existsSync(filePath)) {
                            fs.unlinkSync(filePath);
                            console.log(`Arquivo temporário removido após erro: ${filePath}`);
                        }
                    } catch (unlinkError) {
                        console.error(`Erro ao remover arquivo temporário: ${unlinkError.message}`);
                    }
                }
            });
        });
        
        // Executar as promessas com limite de concorrência
        const batchResults = [];
        for (let j = 0; j < batchPromises.length; j += config.performance.maxConcurrentFiles) {
            const concurrentBatch = batchPromises.slice(j, j + config.performance.maxConcurrentFiles);
            const concurrentResults = await Promise.all(concurrentBatch);
            batchResults.push(...concurrentResults);
        }
        
        results.push(...batchResults);
        
        // Pausa entre lotes para evitar sobrecarga
        if (i + batchSize < totalFiles && batchInterval > 0) {
            console.log(`Pausa de ${batchInterval}ms entre lotes...`);
            await new Promise(resolve => setTimeout(resolve, batchInterval));
        }
    }
    
    return results;
}

// Endpoint para upload e processamento de PDF
app.post('/upload', upload.array('files', config.upload.maxFiles), async (req, res) => {
    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'Nenhum arquivo foi enviado.' });
    }

    console.log(`Recebidos ${req.files.length} arquivos para processamento`);
    const processedFiles = [];
    
    try {
        // Processar arquivos em lotes
        const batchResults = await processBatch(
            req.files, 
            uploadDir, 
            processedPdfsDir, 
            clientesData, 
            config.performance.batchSize || 20, 
            config.performance.batchInterval || 500
        );
        
        // Processar resultados dos lotes
        for (const result of batchResults) {
            if (!result.success) {
                processedFiles.push({
                    originalName: result.file.originalname,
                    status: 'Erro',
                    message: result.error || 'Erro desconhecido'
                });
                continue;
            }
            
            const { file, extractedData, text, filePath } = result.result;
            
            // Verificar se o arquivo é um PDF
            if (!file.originalname.toLowerCase().endsWith('.pdf')) {
                processedFiles.push({
                    originalName: file.originalname,
                    status: 'Ignorado',
                    message: 'Não é um arquivo PDF'
                });
                
                // Remover arquivo não-PDF
                try {
                    if (fs.existsSync(filePath)) {
                        fs.unlinkSync(filePath);
                    }
                } catch (unlinkError) {
                    console.error(`Erro ao remover arquivo não-PDF: ${unlinkError.message}`);
                }
                continue;
            }

            // Completar a extração de dados que foi iniciada na função processFile
            const extractData = (pdfText) => {
                const data = {};

                // 1. Razão Social (caso não encontre nome fantasia pelo CNPJ)
                if (!data.razaoSocial || data.razaoSocial === 'N/A') {
                    // Busca logo após 'IDENTIFICAÇÃO DO EMITENTE'
                    const razaoMatch = pdfText.match(/IDENTIFICA[ÇC][ÃA]O DO EMITENTE\n([A-Z0-9\s\/\-\.]+)\n/);
                    data.razaoSocial = razaoMatch ? razaoMatch[1].trim() : '';
                }
                // Se ainda não encontrar razão social, tenta usar nome fantasia do CNPJ
                if ((!data.razaoSocial || data.razaoSocial === '') && data.cnpjEmitente && data.cnpjEmitente !== 'N/A') {
                    const cliente = clientesData.find(c =>
                        typeof c['CNPJ Emitente'] === 'string' &&
                        c['CNPJ Emitente'].replace(/[^0-9-]/g, '') === data.cnpjEmitente.replace(/[^0-9-]/g, '')
                    );
                    if (cliente) {
                        data.razaoSocial = cliente['Nome Fantasia'] || '';
                    }
                }

                // 2. Número da NF (apenas números, sem pontuação)
                const numeroNFMatch = pdfText.match(/N[ºo\.]*\s*([0-9\.]+)/i);
                data.numeroNF = numeroNFMatch ? numeroNFMatch[1].replace(/\D/g, '') : 'N/A';

                // 3. Natureza da Operação (linha que começa com DEV, ignorando acentos/maiúsculas)
                const naturezaMatch = pdfText.match(/NATUREZA DA OP[ÊE]RA[ÇC][ÃA]O[\s:]*([A-Z\s]+)/i);
                if (naturezaMatch) {
                    data.naturezaOperacao = naturezaMatch[1].split('\n')[0].trim();
                } else {
                    // Busca por linha que comece com DEV
                    const devMatch = pdfText.match(/\n\s*(DEV\w+)/i);
                    data.naturezaOperacao = devMatch ? devMatch[1].trim() : 'N/A';
                }

                // 4. CNPJ (para buscar nome fantasia)
                const cnpjMatch = pdfText.match(/CNPJ[\s:]*([0-9\.\/\-]+)/i);
                data.cnpjEmitente = cnpjMatch ? cnpjMatch[1] : 'N/A';

                // 5. Data de Emissão (formato dd/mm/yyyy)
                const dataEmissaoMatch = pdfText.match(/DATA DA EMISS[ÃA]O[\s:]*([0-9]{2}\/[0-9]{2}\/[0-9]{4})/i);
                data.dataEmissao = dataEmissaoMatch ? dataEmissaoMatch[1] : 'N/A';

                // 6. Valor Total (ex: 167,01)
                const valorTotalMatch = pdfText.match(/V\.\s*TOTAL DA NOTA[\s:]*([0-9\.,]+)/i);
                data.valorTotal = valorTotalMatch ? valorTotalMatch[1].replace(/[^0-9\,\.]/g, '') : 'N/A';

                // 7 e 8. Número Adicional e Motivo (em DADOS ADICIONAIS)
                const dadosAdicionaisMatch = pdfText.match(/INFORMA[ÇC][ÕO]ES COMPLEMENTARES[\s\S]*?N[ºo\.]*\s*([0-9]+)[\s\S]*?Motivo:\s*([A-Za-z\s]+)/i);
                
                // Novo padrão para capturar referência e motivo nos campos da tabela de produtos
                const refProdutoMatch = pdfText.match(/Ref\.\s*NF:\s*([0-9]+),\s*Serie\s*[0-9]+,\s*de\s*[0-9]{2}\/[0-9]{2}\/[0-9]{4}/i);
                const motivoMatch = pdfText.match(/Motivo:\s*([^\-\n]+)\s*\-/i);
                
                if (dadosAdicionaisMatch) {
                    data.numeroAdicional = dadosAdicionaisMatch[1];
                    data.motivoAdicional = dadosAdicionaisMatch[2].trim();
                } else if (refProdutoMatch || motivoMatch) {
                    // Usar os novos padrões encontrados
                    data.numeroAdicional = refProdutoMatch ? refProdutoMatch[1] : '';
                    data.motivoAdicional = motivoMatch ? motivoMatch[1].trim() : '';
                } else {
                    data.numeroAdicional = '';
                    data.motivoAdicional = '';
                }

                // 9. CFOP (na tabela de produtos, 2411, 5202, 6202)
                // Busca todos os CFOPs válidos em qualquer lugar do texto
                const cfopMatches = pdfText.match(/\b(2411|5202|6202)\b/g);
                const cfopLinha = pdfText.match(/CFOP\s*([0-9]{4})/i);
                data.cfop = cfopLinha ? cfopLinha[1] : (cfopMatches ? cfopMatches[0] : 'N/A');

                return data;
            };

            extractedData = extractData(text);
            console.log('EXTRAÍDO DO PDF:', extractedData);

            // Validação de CFOP ou Natureza da Operação usando configuração
            const cfopLimpo = String(extractedData.cfop).replace(/[^0-9]/g, '');
            const isCfopValido = config.validCFOPs ? config.validCFOPs.includes(cfopLimpo) : config.cfopValidos.includes(cfopLimpo);
            const naturezaLimpa = normalizeText(extractedData.naturezaOperacao);
            const isDevolucao = naturezaLimpa.startsWith('DEV');

            if (!isCfopValido && !isDevolucao) {
                processedFiles.push({
                    originalName: file.originalname,
                    status: 'Ignorado',
                    message: `CFOP inválido: ${extractedData.cfop} ou Natureza da Operação inválida`,
                });
                try {
                    if (fs.existsSync(filePath)) {
                        fs.unlinkSync(filePath);
                    }
                } catch (unlinkError) {
                    console.error(`Erro ao remover arquivo com CFOP inválido: ${unlinkError.message}`);
                }
                continue; // Pula para o próximo arquivo, não copia
            }

            try {
                // Lógica de renomeação
                let nomeFantasia = '';
                let nomeVendedor = '';
                if (extractedData.cnpjEmitente !== 'N/A') {
                    const normalizeCnpj = cnpj => cnpj.replace(/[^0-9-]/g, '');
                    // Busca na base CSV (campos normalizados)
                    let cliente = clientesData.find(c =>
                        typeof c['cnpjemitente'] === 'string' &&
                        normalizeCnpj(c['cnpjemitente']) === normalizeCnpj(extractedData.cnpjEmitente)
                    );
                    if (cliente) {
                        console.log('Cliente encontrado:', cliente);
                        nomeFantasia = (cliente['nomefantasia'] || cliente['Nome Fantasia'] || '').trim();
                        nomeVendedor = (cliente['nomevendedor'] || cliente['Nome Vendedor'] || '').trim();
                    } else {
                        // Busca na base XLSX (campos originais)
                        cliente = clientesData.find(c =>
                            typeof c['CNPJ Emitente'] === 'string' &&
                            normalizeCnpj(c['CNPJ Emitente']) === normalizeCnpj(extractedData.cnpjEmitente)
                        );
                        if (cliente) {
                            nomeFantasia = (cliente['Nome Fantasia'] || '').trim();
                            nomeVendedor = (cliente['Nome Vendedor'] || '').trim();
                        }
                    }
                }

                let novoNome = `NFD ${extractedData.numeroNF} - `;

                if (nomeFantasia) {
                    novoNome += `${nomeFantasia}`;
                    if (nomeVendedor) {
                        novoNome += ` - ${nomeVendedor}`;
                    }
                    novoNome += ' - ';
                } else {
                    novoNome += `${extractedData.razaoSocial} - `;
                }

                // Substituir barras na data por hífens ou outro caractere válido
                const dataFormatada = extractedData.dataEmissao.replace(/\//g, '-');
                novoNome += `${dataFormatada} - R$ ${extractedData.valorTotal}`;

                if (extractedData.numeroAdicional && extractedData.motivoAdicional) {
                    novoNome += ` - REF. ${extractedData.numeroAdicional} - MOT. ${extractedData.motivoAdicional}`;
                }

                // Remover caracteres inválidos para nome de arquivo
                novoNome = novoNome.replace(/[\/:*?"<>|]/g, '_');
                novoNome += '.pdf'; // Adiciona a extensão do arquivo

                // Salvar o arquivo com o novo nome
                const newFilePath = path.join(processedPdfsDir, novoNome);
                if (fs.existsSync(filePath)) {
                    fs.copyFileSync(filePath, newFilePath);
                } else {
                    console.warn('Arquivo temporário não encontrado para copiar:', filePath);
                    throw new Error('Arquivo temporário não encontrado');
                }

                processedFiles.push({
                    originalName: file.originalname,
                    extractedData: extractedData,
                    novoNome: novoNome,
                    status: 'Processado',
                    downloadPath: `/download/${encodeURIComponent(novoNome)}`
                });

                // Remover o arquivo temporário após o processamento
                try {
                    if (fs.existsSync(filePath)) {
                        fs.unlinkSync(filePath);
                    }
                } catch (err) {
                    console.error('Erro ao remover arquivo temporário:', err);
                }
            } catch (processingError) {
                console.error(`Erro ao processar arquivo ${file.originalname}:`, processingError);
                processedFiles.push({
                    originalName: file.originalname,
                    status: 'Erro',
                    message: `Erro ao processar: ${processingError.message}`
                });
                
                // Remover o arquivo temporário em caso de erro
                try {
                    if (fs.existsSync(filePath)) {
                        fs.unlinkSync(filePath);
                    }
                } catch (unlinkError) {
                    console.error(`Erro ao remover arquivo temporário: ${unlinkError.message}`);
                }
            }
        }
    } catch (error) {
        console.error('Erro geral no processamento de arquivos:', error);
        
        // Tentar limpar arquivos temporários em caso de erro
        try {
            const files = fs.readdirSync(uploadDir);
            for (const file of files) {
                try {
                    fs.unlinkSync(path.join(uploadDir, file));
                } catch (unlinkError) {
                    console.error(`Erro ao remover arquivo temporário ${file}:`, unlinkError);
                }
            }
        } catch (cleanupError) {
            console.error('Erro ao limpar diretório temporário:', cleanupError);
        }
        
        return res.status(500).json({ 
            error: 'Erro ao processar arquivos', 
            message: error.message,
            files: processedFiles
        });
    }

    // Adicionar informações de estatísticas ao resultado
    const stats = {
        total: req.files.length,
        processados: processedFiles.filter(f => f.status === 'Processado').length,
        ignorados: processedFiles.filter(f => f.status === 'Ignorado').length,
        erros: processedFiles.filter(f => f.status === 'Erro').length
    };

    res.json({ 
        message: `Arquivos processados com sucesso! (${stats.processados}/${stats.total})`, 
        files: processedFiles,
        stats: stats
    });
});

// Endpoint para download de arquivos processados
app.get('/download/:filename', (req, res) => {
    const filename = decodeURIComponent(req.params.filename);
    const filePath = path.join(processedPdfsDir, filename);

    if (fs.existsSync(filePath)) {
        res.download(filePath, filename, (err) => {
            if (err) {
                console.error('Erro ao fazer download do arquivo:', err);
                res.status(500).send('Erro ao fazer download do arquivo.');
            }
        });
    } else {
        res.status(404).send('Arquivo não encontrado.');
    }
});

// Endpoint para listar arquivos processados
app.get('/files', (req, res) => {
    try {
        const files = fs.readdirSync(processedPdfsDir);
        const fileList = files.map(filename => ({
            name: filename,
            path: `/download/${encodeURIComponent(filename)}`,
            size: fs.statSync(path.join(processedPdfsDir, filename)).size
        }));
        res.json(fileList);
    } catch (error) {
        console.error('Erro ao listar arquivos:', error);
        res.status(500).json({ error: 'Erro ao listar arquivos' });
    }
});

// Endpoint para download de todos os arquivos em ZIP
app.get('/download-all', (req, res) => {
    try {
        const files = fs.readdirSync(processedPdfsDir);
        
        if (files.length === 0) {
            return res.status(404).json({ error: 'Não há arquivos para download' });
        }
        
        const zipFileName = `notas-fiscais-${new Date().toISOString().slice(0, 10)}.zip`;
        const zipFilePath = path.join(processedPdfsDir, zipFileName);
        
        const output = fs.createWriteStream(zipFilePath);
        const archive = archiver('zip', {
            zlib: { level: 9 } // Nível máximo de compressão
        });
        
        output.on('close', () => {
            console.log(`Arquivo ZIP criado: ${zipFilePath} (${archive.pointer()} bytes)`);
            res.download(zipFilePath, zipFileName, (err) => {
                if (err) {
                    console.error('Erro ao fazer download do arquivo ZIP:', err);
                    res.status(500).send('Erro ao fazer download do arquivo ZIP.');
                }
                // Remover o arquivo ZIP após o download
                fs.unlinkSync(zipFilePath);
            });
        });
        
        archive.on('error', (err) => {
            console.error('Erro ao criar arquivo ZIP:', err);
            res.status(500).send('Erro ao criar arquivo ZIP.');
        });
        
        archive.pipe(output);
        
        // Adicionar todos os arquivos ao ZIP
        files.forEach(file => {
            const filePath = path.join(processedPdfsDir, file);
            archive.file(filePath, { name: file });
        });
        
        archive.finalize();
    } catch (error) {
        console.error('Erro ao criar arquivo ZIP:', error);
        res.status(500).json({ error: 'Erro ao criar arquivo ZIP' });
    }
});

// Endpoint para limpar arquivos processados
app.delete('/files', (req, res) => {
    try {
        const files = fs.readdirSync(processedPdfsDir);
        files.forEach(filename => {
            fs.unlinkSync(path.join(processedPdfsDir, filename));
        });
        res.json({ message: 'Todos os arquivos foram removidos' });
    } catch (error) {
        console.error('Erro ao limpar arquivos:', error);
        res.status(500).json({ error: 'Erro ao limpar arquivos' });
    }
});

// Middleware de tratamento de erros
app.use((error, req, res, next) => {
    console.error('Erro:', error);
    res.status(500).json({ 
        error: 'Erro interno do servidor',
        message: error.message 
    });
});

// Adicione no início do arquivo:
const PORT = process.env.PORT || 5000;

// Configure CORS para aceitar o domínio do Netlify:
app.use(cors({
  origin: [
    'http://localhost:3000',
    'renomeadordev.netlify.app' // Substitua pelo seu domínio
  ],
  credentials: true
}));

// No final, substitua:
app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
});

// Função para remover acentos e padronizar texto
function normalizeText(text) {
    return text
        ? text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim()
        : '';
}
