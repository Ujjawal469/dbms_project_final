import React, { useState, useEffect } from 'react';
import { useNavigate } from "react-router-dom";
import { Layout, Typography, Spin, Alert } from 'antd'; // Added Alert
import Sidebar from './components/Sidebar/Sidebar';
import DataGrid from './components/DataGrid/DataGrid';
import * as api from './api';
import './css_files/dashboard.css';

const { Header, Content, Sider } = Layout;
const { Title } = Typography;

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  // State for selected database and table
  const [selectedDbId, setSelectedDbId] = useState<number | null>(null);
  const [selectedTableName, setSelectedTableName] = useState<string | null>(null);

  // Sidebar collapse state
  const [collapsed, setCollapsed] = useState(false);

  // Auth state
  const [isCheckingAuth, setIsCheckingAuth] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // Authentication Check Effect
  useEffect(() => {
    let isMounted = true; // Prevent state update on unmounted component
    const checkAuthStatus = async () => {
        setIsCheckingAuth(true);
        setAuthError(null);
        try {
            const status = await api.checkLoginStatus();
            if (!isMounted) return; // Exit if component unmounted during async call

            if (!status.loggedIn) {
                console.log("Dashboard: User not logged in, redirecting to Login.");
                navigate("/login");
            } else {
                console.log("Dashboard: User is logged in. Rendering.");
                // Authentication successful
            }
        } catch (error) {
            if (!isMounted) return;
            console.error("Dashboard: Error checking authentication status:", error);
            setAuthError("Could not verify authentication. Please try logging in again.");
            // Consider delaying redirect slightly or showing error before redirect
            navigate("/login");
        } finally {
            if (isMounted) {
                setIsCheckingAuth(false);
            }
        }
    };

    checkAuthStatus();

    return () => { isMounted = false; }; // Cleanup function
  }, [navigate]);


  // Handlers for selection changes from Sidebar
  const handleSelectDatabase = (dbId: number | null) => {
      console.log("Dashboard: Database selected:", dbId);
      setSelectedDbId(dbId);
      // When DB changes, always deselect the table
      setSelectedTableName(null);
  };

  const handleSelectTable = (dbId: number | null, tableName: string | null) => {
      console.log(`Dashboard: Table selected: ${tableName} in DB: ${dbId}`);
       // Ensure DB is also selected if a table is selected
       if (tableName && dbId) {
           setSelectedDbId(dbId);
           setSelectedTableName(tableName);
       } else {
           // If tableName is null, just update tableName state (might keep db selected)
           setSelectedTableName(null);
           // Optionally deselect DB if table is deselected? Depends on desired UX.
           // setSelectedDbId(dbId); // Keep dbId as is or handle based on UX
       }
  };


  // Render Logic
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
         <Alert message="Authentication Error" description={authError} type="error" showIcon />
      </Layout>
    );
  }

  // Main Dashboard Layout (only if authenticated)
  return (
    <Layout className="app-layout">
      <Header className="app-header">
        {/* Keep Header simple or add dynamic content */}
        <Title level={3} style={{ color: 'white', margin: 0 }}>Database UI</Title>
      </Header>
      <Layout>
        {/* Sidebar */}
        <Sider
            className="app-sider"
            width={250} // Adjust width as needed
            theme="light" // Use light theme to match Antd Menu default
            collapsible
            collapsed={collapsed}
            onCollapse={setCollapsed}
            breakpoint="lg" // Allow collapsing on smaller screens
            collapsedWidth={0} // Completely hide when collapsed by breakpoint
            trigger={null} // Use default trigger or customize
            style={{ background: '#fff' }} // Explicit background for Sider
         >
           {/* Render Sidebar only if not collapsed (or handle collapsed view differently) */}
           {/* Pass selection state and handlers */}
           {!collapsed && (
                <Sidebar
                    selectedDatabaseId={selectedDbId}
                    selectedTableName={selectedTableName}
                    onSelectDatabase={handleSelectDatabase}
                    onSelectTable={handleSelectTable}
                    // Pass other handlers like onCreateView if needed
                />
            )}
        </Sider>
        {/* Main Content Area */}
        <Layout style={{ padding: '0' }}> {/* Remove padding from Layout if Content has it */}
          <Content className="app-content">
            {/* DataGrid receives the selected dbId and tableName */}
            <DataGrid
                dbId={selectedDbId}
                tableName={selectedTableName}
                // Pass callbacks if DataGrid needs to trigger actions in Dashboard/Sidebar
            />
          </Content>
        </Layout>
      </Layout>
    </Layout>
  );
};

export default Dashboard;