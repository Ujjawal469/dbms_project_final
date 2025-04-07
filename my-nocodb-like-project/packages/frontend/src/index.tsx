import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css'; // Import global CSS
import App from './App';
// Optional: If using Ant Design locale providers
// import { ConfigProvider } from 'antd';
// import enUS from 'antd/locale/en_US';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    {/* Optional: Wrap with Antd ConfigProvider for theme/locale */}
    {/* <ConfigProvider locale={enUS}> */}
      <App />
    {/* </ConfigProvider> */}
  </React.StrictMode>
);