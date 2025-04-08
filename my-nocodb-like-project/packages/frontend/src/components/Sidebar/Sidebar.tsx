// src/components/Sidebar/Sidebar.tsx

import React, { useState, useEffect, useCallback } from 'react';
import { Menu, Spin, Alert, Empty, Button, Modal, Form, Input, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import * as api from '../../api'; // Assuming API functions are in src/api/index.ts

/**
 * Props for the Sidebar component.
 */
interface SidebarProps {
    /** The name of the currently selected table, or null if none is selected */
    selectedTable: string | null;
    /** Callback function triggered when a table is selected from the menu */
    onSelectTable: (tableName: string) => void;
}

/**
 * Sidebar component that displays a list of user-accessible tables
 * and provides functionality to add new tables (which creates physical DB tables).
 */
const Sidebar: React.FC<SidebarProps> = ({ selectedTable, onSelectTable }) => {
  // State for the list of tables displayed in the sidebar
  const [tables, setTables] = useState<string[]>([]);
  // State to track if tables are currently being loaded
  const [loading, setLoading] = useState<boolean>(false);
  // State to store any error message related to fetching tables
  const [error, setError] = useState<string | null>(null);

  // State for managing the "Add Table" modal dialog
  const [isAddModalVisible, setIsAddModalVisible] = useState<boolean>(false);
  // State to show a loading indicator on the modal's confirmation button
  const [confirmLoadingAdd, setConfirmLoadingAdd] = useState<boolean>(false);
  // Ant Design Form instance to manage the state and validation of the modal's input field
  const [addTableForm] = Form.useForm();

  /**
   * Fetches the list of tables associated with the current logged-in user from the backend API.
   * Uses useCallback to memoize the function, preventing unnecessary recreation on re-renders.
   */
  const fetchUserTables = useCallback(() => {
    setLoading(true); // Indicate loading started
    setError(null);   // Clear any previous errors
    console.log("Sidebar: Fetching tables...");
    api.fetchTables() // Call the API function
      .then(data => {
        console.log("Sidebar: Tables received:", data);
        // Update state with the fetched tables, sorted alphabetically
        setTables(data.sort());
      })
      .catch(err => {
        console.error("Sidebar: Fetch tables error:", err);
        // Set the error state using the message processed by the central API error handler
        setError(`Failed to load tables: ${err.message || 'Unknown error'}`);
        setTables([]); // Clear the tables list on error
      })
      .finally(() => {
        setLoading(false); // Ensure loading indicator is turned off
      });
  }, []); // No dependencies, as it fetches based on the current session implicitly

  /**
   * useEffect hook to fetch the tables when the component first mounts.
   */
  useEffect(() => {
    fetchUserTables();
  }, [fetchUserTables]); // Depend on the memoized fetch function

  // --- Add Table Modal Handlers ---

  /**
   * Opens the "Add Table" modal and resets any previous input in the form.
   */
  const showAddTableModal = () => {
    addTableForm.resetFields(); // Clear the input field
    setIsAddModalVisible(true); // Set modal visibility to true
  };

  /**
   * Handles the submission of the "Add Table" modal form.
   * Validates the input, calls the backend API to create the table,
   * shows feedback messages, and refreshes the table list.
   */
  const handleAddTableOk = async () => {
    try {
      // Validate the form input fields based on the rules defined in Form.Item
      const values = await addTableForm.validateFields();
      const newTableName = values.tableName.trim(); // Get the trimmed table name from form values

      // Extra safety check (though validation rules should catch this)
      if (!newTableName) {
          message.error("Table name cannot be empty.");
          return;
      }

      setConfirmLoadingAdd(true); // Show loading indicator on the "Create" button
      console.log(`Sidebar: Attempting to create table: ${newTableName}`);

      // Call the API function responsible for creating the physical table and association
      const response = await api.addTable(newTableName);

      // Display a success message (prefer backend message if available)
      message.success(response?.message || `Table "${newTableName}" created successfully!`);
      setIsAddModalVisible(false); // Close the modal

      // Refresh the list of tables in the sidebar to include the new one
      fetchUserTables();

    } catch (errorInfo: any) {
      // Log the detailed error for debugging purposes
      console.error('Sidebar: Create Table Failed:', errorInfo);

      // Check if the error originated from Ant Design form validation
      if (errorInfo.errorFields) {
          message.error('Validation failed. Please check the table name.');
      } else {
          // Otherwise, assume it's an error from the API call (already processed)
          // Display the error message provided in the error object
          message.error(`Failed to create table: ${errorInfo.message || 'Please try again.'}`);
      }
    } finally {
      // Always turn off the loading indicator on the modal button
      setConfirmLoadingAdd(false);
    }
  };

  /**
   * Handles closing the "Add Table" modal via the cancel button or the 'X' icon.
   */
  const handleAddTableCancel = () => {
    setIsAddModalVisible(false); // Set modal visibility to false
  };

  // --- End Add Table Modal Handlers ---

  /**
   * Handles the click event on a table name in the sidebar menu.
   * @param {object} info - The event object from Ant Design Menu, containing the key (table name).
   */
  const handleSelect = ({ key }: { key: string }) => {
    onSelectTable(key); // Call the callback prop passed from the parent component
  };

  /**
   * Renders the appropriate content within the sidebar based on the current state
   * (loading, error, empty list, or the list of tables).
   * @returns {React.ReactNode} The JSX element to render in the main sidebar area.
   */
  const renderSidebarContent = () => {
    // Show spinner while loading
    if (loading) {
      return <div style={{ padding: '20px', textAlign: 'center' }}><Spin tip="Loading tables..." /></div>;
    }
    // Show error alert if fetching failed
    if (error) {
      return <div style={{ padding: '10px' }}><Alert message={error} type="error" showIcon /></div>;
    }
    // Show empty state message if not loading and no tables exist
    if (!loading && tables.length === 0) {
       return <div style={{ padding: '20px' }}><Empty description="No tables found" /></div>;
    }
    // Render the menu with table items if tables exist
    return (
       <Menu
         theme="light" // Adjust theme as needed ('light' or 'dark')
         mode="inline" // Standard vertical sidebar menu
         // Highlight the key corresponding to the currently selected table
         selectedKeys={selectedTable ? [selectedTable] : []}
         onClick={handleSelect} // Set the handler for menu item clicks
         // Style the menu to fill available space and allow vertical scrolling
         style={{ height: '100%', borderRight: 0, overflowY: 'auto' }}
       >
         {/* Map over the array of table names */}
         {tables.map(table => (
           // Each table name becomes a menu item with its name as the unique key
           <Menu.Item key={table}>{table}</Menu.Item>
         ))}
       </Menu>
    );
  };


  // --- Component JSX Structure ---
  return (
    // Use flexbox to arrange title, menu, and button vertically, filling height
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Optional Title Area */}
        <div style={{ padding: '10px 16px', borderBottom: '1px solid #f0f0f0', flexShrink: 0 }}>
            <strong>Tables</strong>
        </div>

        {/* Main Content Area (Menu/Loading/Error/Empty) - Grows to fill space */}
        <div style={{ flexGrow: 1, overflow: 'hidden' }}> {/* overflow: hidden contains the menu's scroll */}
            {renderSidebarContent()}
        </div>

        {/* Fixed Button Area at the bottom */}
        <div style={{ padding: '8px', borderTop: '1px solid #f0f0f0', flexShrink: 0 }}>
            <Button
                type="primary"         // Primary button style
                icon={<PlusOutlined />} // '+' icon
                block                  // Button takes full width
                onClick={showAddTableModal} // Open modal on click
                disabled={loading}     // Disable button while loading initial table list
            >
                Add Table
            </Button>
        </div>

        {/* Modal Dialog for Adding a New Table */}
        {/* Conditionally render the Modal only when isAddModalVisible is true */}
        {isAddModalVisible && (
            <Modal
                title="Create New Table" // Updated modal title
                visible={isAddModalVisible} // Control visibility with state
                onOk={handleAddTableOk} // Call handler when OK button is clicked
                confirmLoading={confirmLoadingAdd} // Show loading state on OK button
                onCancel={handleAddTableCancel} // Call handler when modal is cancelled/closed
                okText="Create" // Updated OK button text
                destroyOnClose // Ensures form state is reset when modal closes
                maskClosable={!confirmLoadingAdd} // Prevent clicking outside modal to close while loading
            >
                {/* Informational text explaining the action and consequences */}
                <p style={{ marginBottom: '15px', fontSize: '13px', color: '#666' }}>
                    Enter a name to create a new table in the database.
                    This table will automatically have a <code style={{ background:'#eee', padding:'1px 3px', borderRadius:'3px' }}>serial_num</code> primary key column.
                    <br/>
                    <strong style={{color:'darkred'}}>Warning:</strong> This creates a physical table outside of standard schema management tools.
                </p>
                {/* Form containing the input field for the new table name */}
                <Form form={addTableForm} layout="vertical" name="add_table_form">
                    <Form.Item
                        name="tableName" // Key to access the input value
                        label="New Table Name" // Label displayed for the input
                        // Validation rules applied to the input
                        rules={[
                            { required: true, message: 'Please enter a table name!' },
                            { whitespace: true, message: 'Table name cannot be just spaces!' },
                            {
                                pattern: /^[a-zA-Z_][a-zA-Z0-9_]*$/, // Regex for valid identifiers
                                message: 'Invalid format (letters, numbers, underscores, start with letter or underscore)'
                            },
                            { max: 63, message: 'Table name is too long (max 63 characters)' } // Length limit
                        ]}
                    >
                        <Input placeholder="e.g., projects or user_preferences" />
                    </Form.Item>
                </Form>
            </Modal>
        )}
    </div>
  );
};

export default Sidebar;