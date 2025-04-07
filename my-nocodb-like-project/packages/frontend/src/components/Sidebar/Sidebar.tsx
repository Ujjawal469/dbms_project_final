import React, { useState, useEffect } from 'react';
import { Menu, Spin, Alert, Empty } from 'antd';
import * as api from '../../api'; // Import API functions

interface SidebarProps {
    selectedTable: string | null;
    onSelectTable: (tableName: string) => void; // Ensure it only passes valid table names
}

const Sidebar: React.FC<SidebarProps> = ({ selectedTable, onSelectTable }) => {
  const [tables, setTables] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api.fetchTables()
      .then(data => {
        setTables(data);
        // Optional: Auto-select first table if none selected?
        // if (!selectedTable && data.length > 0) {
        //   onSelectTable(data[0]);
        // }
      })
      .catch(err => {
        setError(`Failed to load tables: ${err.message || 'Unknown error'}`);
        setTables([]); // Clear tables on error
      })
      .finally(() => setLoading(false));
  }, []); // Run only once on mount

  const handleSelect = ({ key }: { key: string }) => {
    onSelectTable(key);
  };

  if (loading) {
    return <div style={{ padding: '20px', textAlign: 'center' }}><Spin tip="Loading tables..." /></div>;
  }

  if (error) {
    return <div style={{ padding: '10px' }}><Alert message={error} type="error" showIcon /></div>;
  }

  if (!loading && tables.length === 0) {
     return <div style={{ padding: '20px' }}><Empty description="No tables found" /></div>;
  }

  return (
    <Menu
      theme="light" // Or "dark"
      mode="inline"
      selectedKeys={selectedTable ? [selectedTable] : []}
      onClick={handleSelect}
      style={{ height: '100%', borderRight: 0 }} // Fill sidebar height
    >
      {tables.map(table => (
        <Menu.Item key={table}>{table}</Menu.Item>
      ))}
    </Menu>
  );
};

export default Sidebar;