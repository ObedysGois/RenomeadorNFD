/**
 * Script para verificar o ambiente e diagnosticar problemas de permissão
 * Execute com: node check-environment.js
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// Diretórios a verificar
const dirsToCheck = [
  'uploads',
  'processed_pdfs'
];

console.log('=== VERIFICAÇÃO DE AMBIENTE ===');
console.log(`Sistema Operacional: ${os.type()} ${os.release()}`);
console.log(`Diretório atual: ${process.cwd()}`);
console.log(`Node.js versão: ${process.version}`);
console.log(`Usuário: ${os.userInfo().username}`);
console.log('===========================');

// Verificar e criar diretórios
dirsToCheck.forEach(dir => {
  const dirPath = path.join(__dirname, dir);
  console.log(`\nVerificando diretório: ${dirPath}`);
  
  // Verificar existência
  if (!fs.existsSync(dirPath)) {
    console.log(`Diretório não existe, criando...`);
    try {
      fs.mkdirSync(dirPath, { recursive: true, mode: 0o777 });
      console.log(`✅ Diretório criado com sucesso`);
    } catch (err) {
      console.error(`❌ ERRO ao criar diretório: ${err.message}`);
      console.error(`Stack trace: ${err.stack}`);
    }
  } else {
    console.log(`✅ Diretório existe`);
  }
  
  // Verificar permissões
  try {
    const stats = fs.statSync(dirPath);
    const mode = stats.mode.toString(8);
    console.log(`Permissões: ${mode}`);
    
    // Tentar atualizar permissões
    try {
      fs.chmodSync(dirPath, 0o777);
      console.log(`✅ Permissões atualizadas para 777`);
    } catch (err) {
      console.error(`❌ ERRO ao atualizar permissões: ${err.message}`);
    }
    
    // Testar escrita
    const testFile = path.join(dirPath, `test-${Date.now()}.txt`);
    fs.writeFileSync(testFile, 'test');
    console.log(`✅ Teste de escrita bem-sucedido`);
    
    // Limpar arquivo de teste
    fs.unlinkSync(testFile);
    console.log(`✅ Arquivo de teste removido`);
  } catch (err) {
    console.error(`❌ ERRO ao verificar permissões: ${err.message}`);
    console.error(`Stack trace: ${err.stack}`);
  }
});

console.log('\n=== VERIFICAÇÃO CONCLUÍDA ===');