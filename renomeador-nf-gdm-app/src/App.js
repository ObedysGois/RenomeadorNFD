import React, { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';
import './App.css';

function App() {
  const [processedFiles, setProcessedFiles] = useState([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [savedFiles, setSavedFiles] = useState([]);
  const [showDetails, setShowDetails] = useState({});

  // Carregar arquivos salvos ao iniciar
  useEffect(() => {
    loadSavedFiles();
  }, []);

  const loadSavedFiles = async () => {
    try {
      const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
      const response = await axios.get(`${API_URL}/files`);
      setSavedFiles(response.data);
    } catch (error) {
      console.error('Erro ao carregar arquivos:', error);
    }
  };

  const onDrop = useCallback(async (acceptedFiles) => {
    setLoading(true);
    setMessage('Processando arquivos...');
    const formData = new FormData();
    acceptedFiles.forEach(file => {
      formData.append('pdfs', file);
    });

    try {
      // Substitua as URLs hardcoded por:
      const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
      
      // Fazer upload dos arquivos
      const response = await axios.post(`${API_URL}/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      setProcessedFiles(response.data.files);
      setMessage(response.data.message);
      
      // Recarregar lista de arquivos salvos
      await loadSavedFiles();
    } catch (error) {
      console.error('Erro ao fazer upload:', error);
      setMessage('Erro ao processar os arquivos.');
    } finally {
      setLoading(false);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
    },
  });

  const clearAllFiles = async () => {
    try {
      const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
      await axios.delete(`${API_URL}/files`);
      setSavedFiles([]);
      setProcessedFiles([]);
      setMessage('Todos os arquivos foram removidos');
    } catch (error) {
      console.error('Erro ao limpar arquivos:', error);
      setMessage('Erro ao limpar arquivos');
    }
  };

  const toggleDetails = (index) => {
    setShowDetails(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>🔄 Renomeador de Devoluções - GDM</h1>
        <p className="subtitle">Processe e renomeie suas notas fiscais automaticamente</p>
        
        <div {...getRootProps()} className={`dropzone ${isDragActive ? 'active' : ''}`}>
          <input {...getInputProps()} />
          <div className="dropzone-content">
            <div className="upload-icon">📄</div>
            {isDragActive ? (
              <p>Solte os arquivos PDF aqui...</p>
            ) : (
              <div>
                <p>Arraste e solte arquivos PDF aqui</p>
                <p className="or-text">ou clique para selecionar</p>
              </div>
            )}
          </div>
        </div>

        {loading && (
          <div className="loading">
            <div className="spinner"></div>
            <p>Processando arquivos...</p>
          </div>
        )}

        {message && (
          <div className={`message ${message.includes('Erro') ? 'error' : 'success'}`}>
            {message}
          </div>
        )}

        {processedFiles.length > 0 && (
          <div className="results-section">
            <h2>📋 Resultados do Processamento</h2>
            <div className="files-list">
              {processedFiles.map((file, index) => (
                <div key={index} className={`file-item ${file.status.toLowerCase()}`}>
                  <div className="file-header" onClick={() => toggleDetails(index)}>
                    <span className="file-name">{file.originalName}</span>
                    <span className={`status ${file.status.toLowerCase()}`}>
                      {file.status === 'Processado' ? '✅' : 
                       file.status === 'Ignorado' ? '⚠️' : '❌'} {file.status}
                    </span>
                    <span className="toggle-icon">{showDetails[index] ? '▼' : '▶'}</span>
                  </div>
                  
                  {showDetails[index] && (
                    <div className="file-details">
                      {file.status === 'Processado' ? (
                        <div>
                          <p><strong>Novo nome:</strong> {file.novoNome}</p>
                          {file.extractedData && (
                            <div className="extracted-data">
                              <h4>Dados Extraídos:</h4>
                              <div className="data-grid">
                                <div><strong>Nº NF:</strong> {file.extractedData.numeroNF}</div>
                                <div><strong>CNPJ:</strong> {file.extractedData.cnpjEmitente}</div>
                                <div><strong>Data:</strong> {file.extractedData.dataEmissao}</div>
                                <div><strong>Valor:</strong> R$ {file.extractedData.valorTotal}</div>
                                <div><strong>CFOP:</strong> {file.extractedData.cfop}</div>
                                <div><strong>Natureza:</strong> {file.extractedData.naturezaOperacao}</div>
                              </div>
                              {file.extractedData.numeroAdicional && (
                                <div className="additional-data">
                                  <strong>Dados Adicionais:</strong> Número: {file.extractedData.numeroAdicional}, 
                                  Motivo: {file.extractedData.motivoAdicional}
                                </div>
                              )}
                            </div>
                          )}
                          {file.downloadPath && (
                            <a 
                              href={`${process.env.REACT_APP_API_URL || 'http://localhost:5000'}${file.downloadPath}`} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="download-btn"
                            >
                              📥 Download
                            </a>
                          )}
                        </div>
                      ) : (
                        <p className="reason">{file.reason}</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {savedFiles.length > 0 && (
          <div className="saved-files-section">
            <div className="section-header">
              <h2>💾 Arquivos Salvos ({savedFiles.length})</h2>
              <div className="header-buttons">
                <a 
                  href={`${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/download-all`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="download-btn"
                >
                  📦 Baixar Todos (ZIP)
                </a>
                <button onClick={clearAllFiles} className="clear-btn">
                  🗑️ Limpar Todos
                </button>
              </div>
            </div>
            <div className="saved-files-list">
              {savedFiles.map((file, index) => (
                <div key={index} className="saved-file-item">
                  <div className="file-info">
                    <span className="file-name">{file.name}</span>
                    <span className="file-size">{formatFileSize(file.size)}</span>
                  </div>
                  <a 
                    href={`${process.env.REACT_APP_API_URL || 'http://localhost:5000'}${file.path}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="download-btn small"
                  >
                    📥
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="instructions">
          <h3>📖 Como usar:</h3>
          <ul>
            <li>Arraste e solte arquivos PDF de notas fiscais na área acima</li>
            <li>O sistema extrairá automaticamente os dados e renomeará os arquivos</li>
            <li>Arquivos com CFOP 2411, 6202, 5202 ou natureza "DEV" serão processados</li>
            <li>Os arquivos renomeados ficarão disponíveis para download</li>
          </ul>
        </div>
      </header>
    </div>
  );
}

export default App;