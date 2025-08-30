# Renomeador de NF - GDM

Aplicativo para renomear notas fiscais automaticamente com base em dados de clientes.

## Estrutura do Projeto

- `server/`: Backend Node.js com Express
- `renomeador-nf-gdm-app/`: Frontend React (bootstrapped with [Create React App](https://github.com/facebook/create-react-app))
- `render.yaml`: Configuração para deploy no Render

## Configuração do Git

### Clonar o repositório

```bash
git clone https://github.com/ObedysGois/RenomeadorNFD.git
cd RenomeadorNFD
```

### Configurar o repositório remoto

Se você já tem um projeto existente e deseja conectá-lo ao repositório:

```bash
git remote set-url origin https://github.com/ObedysGois/RenomeadorNFD.git
```

### Enviar alterações para o repositório

```bash
git add .
git commit -m "Sua mensagem de commit"
git push origin main
```

## Deploy no Render

O projeto está configurado para ser hospedado no Render usando o arquivo `render.yaml`.

### Passos para o Deploy

1. Crie uma conta no [Render](https://render.com/)
2. Conecte sua conta do GitHub ao Render
3. No dashboard do Render, clique em "New" e selecione "Blueprint"
4. Selecione o repositório `RenomeadorNFD`
5. O Render detectará automaticamente o arquivo `render.yaml` e criará os serviços configurados:
   - `renomeador-nf-gdm-frontend`: Frontend estático React
   - `renomeador-nf-gdm-backend`: Backend Node.js

### Configuração dos Serviços

#### Frontend
- **Tipo**: Web Service (Static)
- **Diretório de publicação**: renomeador-nf-gdm-app/build
- **Variáveis de ambiente**:
  - `NODE_VERSION`: 18.0.0
  - `API_URL`: URL do backend (configurada automaticamente)

#### Backend
- **Tipo**: Web Service (Node)
- **Comando de build**: npm install
- **Comando de start**: cd server && node index.js
- **Variáveis de ambiente**:
  - `NODE_VERSION`: 18.0.0
  - `PORT`: 5000
  - `FRONTEND_URL`: URL do frontend (configurada automaticamente)

### Verificação do Deploy

Após o deploy, você poderá acessar:
- Frontend: https://renomeador-nf-gdm-frontend.onrender.com
- Backend: https://renomeador-nf-gdm-backend.onrender.com

## Desenvolvimento Local

### Scripts Disponíveis

No diretório do projeto, você pode executar:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

The page will reload when you make changes.\
You may also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can't go back!**

If you aren't satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you're on your own.

You don't have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn't feel obligated to use this feature. However we understand that this tool wouldn't be useful if you couldn't customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).

### Code Splitting

This section has moved here: [https://facebook.github.io/create-react-app/docs/code-splitting](https://facebook.github.io/create-react-app/docs/code-splitting)

### Analyzing the Bundle Size

This section has moved here: [https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size](https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size)

### Making a Progressive Web App

This section has moved here: [https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app](https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app)

### Advanced Configuration

This section has moved here: [https://facebook.github.io/create-react-app/docs/advanced-configuration](https://facebook.github.io/create-react-app/docs/advanced-configuration)

### Deployment

This section has moved here: [https://facebook.github.io/create-react-app/docs/deployment](https://facebook.github.io/create-react-app/docs/deployment)

### `npm run build` fails to minify

This section has moved here: [https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify](https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify)
