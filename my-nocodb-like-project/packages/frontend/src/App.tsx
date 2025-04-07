import React, { useState } from 'react';
import { Layout, Typography } from 'antd';
import Sidebar from './components/Sidebar/Sidebar';
import DataGrid from './components/DataGrid/DataGrid';
import './App.css'; // Import App specific styles

const { Header, Content, Sider } = Layout;
const { Title } = Typography;

const App: React.FC = () => {
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false); // Sidebar collapse state

  return (
    <Layout className="app-layout">
      <Header className="app-header">
        <Title level={3} style={{ color: 'white', margin: 0 }}>My NocoDB Clone</Title>
      </Header>
      <Layout>
        <Sider
            className="app-sider"
            width={250}
            theme="light"
            collapsible
            collapsed={collapsed}
            onCollapse={setCollapsed}
            breakpoint="lg" // Optional: auto-collapse on smaller screens
            collapsedWidth="0" // Optional: completely hide when collapsed on small screens
            trigger={null} // Optional: remove default trigger if using breakpoint
         >
           {/* Render Sidebar only if not collapsed (or handle collapsed view differently) */}
           {!collapsed && <Sidebar selectedTable={selectedTable} onSelectTable={setSelectedTable} />}
        </Sider>
        <Layout>
          <Content className="app-content">
             {/* Button to toggle sidebar on smaller screens if collapsedWidth="0" */}
             {/* <Button onClick={() => setCollapsed(!collapsed)}>Toggle Sidebar</Button> */}
            <DataGrid tableName={selectedTable} />
          </Content>
        </Layout>
      </Layout>
    </Layout>
  );
};

export default App;