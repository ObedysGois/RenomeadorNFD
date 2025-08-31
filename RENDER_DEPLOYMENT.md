# Instruções para Implantação no Render

## Modificações Realizadas

### 1. Correção de Erro JavaScript

- Corrigido erro `SyntaxError: Identifier 'extractedData' has already been declared` no arquivo `server/index.js`:
  - Removida a redeclaração de `extractedData` com `let` na linha 475, mantendo apenas a atribuição
  - A variável já havia sido declarada na linha 380 através de desestruturação
  - Este erro estava causando falha na inicialização do servidor no Render

### 2. Permissões de Diretórios

Foram feitas as seguintes alterações para resolver problemas de permissão no ambiente Render:

- Modificada a função `ensureDirectoryExists` no arquivo `server/index.js` para:
  - Usar permissões 0o777 (mais permissivas) ao criar diretórios
  - Adicionar uma tentativa de correção de permissões com `chmod` quando ocorrer erro de permissão
  - Melhorar o log de erros para facilitar o diagnóstico

- Atualizado o arquivo `render.yaml` para:
  - Adicionar comandos de pré-inicialização que criam os diretórios necessários
  - Definir permissões 777 nos diretórios antes de iniciar o servidor
  - Adicionar a variável de ambiente NODE_ENV=production

## Solução de Problemas

Se ainda ocorrerem erros 500 no Render, verifique:

1. **Logs do Render**: Acesse o dashboard do Render e verifique os logs do serviço para identificar erros específicos.

2. **Permissões de Diretório**: O Render tem um sistema de arquivos efêmero. Certifique-se de que os diretórios são recriados a cada reinicialização do serviço.

3. **Armazenamento Persistente**: Para uma solução mais robusta, considere usar o Render Disk (armazenamento persistente) ou um serviço de armazenamento externo como AWS S3.

## Comandos Úteis para Depuração

Se tiver acesso ao shell do Render (disponível em planos pagos), você pode usar estes comandos para diagnóstico:

```bash
# Verificar permissões dos diretórios
ls -la server/uploads
ls -la server/processed_pdfs

# Tentar criar manualmente os diretórios
mkdir -p server/uploads server/processed_pdfs

# Definir permissões manualmente
chmod -R 777 server/uploads server/processed_pdfs
```

## Considerações Adicionais

- O uso de permissões 777 não é recomendado para ambientes de produção com dados sensíveis, mas pode ser necessário para resolver problemas no Render.
- Para uma solução mais segura, considere usar um serviço de armazenamento em nuvem como AWS S3 para os arquivos processados.