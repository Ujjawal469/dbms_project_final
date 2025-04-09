import React, { useState, useEffect } from 'react';
import { useNavigate } from "react-router-dom";
import { Layout, Typography, Spin } from 'antd';
import Sidebar from './components/Sidebar/Sidebar';
import DataGrid from './components/DataGrid/DataGrid';
import * as api from './api';
import './dashboard.css';

const { Header, Content, Sider } = Layout;
const { Title } = Typography;

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const checkAuthStatus = async () => {
      setAuthError(null);
      try {
        const isLoggedIn = await api.checkLoginStatus();
        if (!isLoggedIn.loggedIn) {
          console.log("User not logged in, redirecting to Login.");
          navigate("/login"); 
        } else {
          console.log("User is logged in. Rendering Dashboard.");
         
          setIsCheckingAuth(false);
        }
      } catch (error) {
        console.error("Error checking authentication status:", error);
        setAuthError("Could not verify authentication status. Please try logging in again.");
        navigate("/login");
      }
      
    };

    checkAuthStatus();
  }, [navigate]); 


  if (isCheckingAuth) {
    return (
      <Layout style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <Spin size="large" tip="Verifying authentication..." />
      </Layout>
    );
  }


  if (authError) {
     return (
      <Layout style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
         <Typography.Text type="danger">{authError}</Typography.Text>
         {/* Optionally add a button to retry or go to login */}
      </Layout>
    );
  }

  return (
    <Layout className="app-layout">
      <Header className="app-header">
        <Title level={3} style={{ color: 'white', margin: 0 }}>Spreadsheet UI</Title>
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

export default Dashboard;