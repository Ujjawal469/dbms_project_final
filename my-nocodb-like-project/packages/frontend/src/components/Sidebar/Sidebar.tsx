// src/components/Sidebar/Sidebar.tsx

import React, { useState, useEffect, useCallback } from 'react';
import { Menu, Spin, Alert, Empty, Button, Modal, Form, Input, message, Dropdown, Space } from 'antd';
import { PlusOutlined, EllipsisOutlined, AppstoreOutlined, TableOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons';
import * as api from '../../api'; // Assuming API functions are in src/api/index.ts

const { confirm } = Modal;

/**
 * Props for the Sidebar component.
 */
interface SidebarProps {
    /** The name of the currently selected table, or null if none is selected */
    selectedTable: string | null;
    /** Callback function triggered when a table is selected or deselected */
    onSelectTable: (tableName: string | null) => void;
    /** Optional callback function triggered when a view creation is initiated */
    onCreateView?: (tableName: string, viewType: 'grid' | 'gallery') => void;
    /** Optional callback function to notify parent when table list changes (e.g., after add/delete/rename) */
    onTableListChange?: () => void;
}

/**
 * Sidebar component that displays tables, allows adding/renaming/deleting tables,
 * and provides actions per table (e.g., Create View).
 */
const Sidebar: React.FC<SidebarProps> = ({ selectedTable, onSelectTable, onCreateView, onTableListChange }) => {
  // Core state for table list, loading, and errors
  const [tables, setTables] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // State for "Add Table" modal
  const [isAddModalVisible, setIsAddModalVisible] = useState<boolean>(false);
  const [confirmLoadingAdd, setConfirmLoadingAdd] = useState<boolean>(false);
  const [addTableForm] = Form.useForm();

  // State for "Rename Table" modal
  const [isRenameModalVisible, setIsRenameModalVisible] = useState<boolean>(false);
  const [confirmLoadingRename, setConfirmLoadingRename] = useState<boolean>(false);
  const [renameTableForm] = Form.useForm();
  // State to hold the old name of the table being renamed while the modal is open
  const [renamingTableInfo, setRenamingTableInfo] = useState<{ oldName: string } | null>(null);

  // State for "Delete Table" operation (tracks which item is being deleted)
  const [deletingTableKey, setDeletingTableKey] = useState<string | null>(null);


  /**
   * Fetches the list of user's tables from the API.
   * Wrapped in useCallback for memoization.
   */
  const fetchUserTables = useCallback(async (): Promise<void> => {
    setDeletingTableKey(null); // Reset any delete indicators
    setLoading(true);
    setError(null);
    console.log("Sidebar: Fetching tables...");
    try {
        const data = await api.fetchTables();
        if (!Array.isArray(data)) {
            throw new Error("Invalid table list format received.");
        }
        setTables(data.sort()); // Update state with sorted list
        setError(null);
        // Notify parent component about the potential change in the table list
        if (onTableListChange) onTableListChange();
    } catch (err: any) {
        console.error("Sidebar: Fetch tables error:", err);
        const errorMsg = err.message || 'Unknown error';
        setError(`Failed to load tables: ${errorMsg}`);
        setTables([]); // Clear list on error
        // Optionally re-throw if needed by caller context
        // throw err;
    } finally {
        setLoading(false); // Ensure loading state is always turned off
    }
 }, [onTableListChange]); // Recreate only if onTableListChange prop changes


 /**
  * useEffect hook to perform the initial table fetch when the component mounts.
  */
 useEffect(() => {
    console.log("Sidebar: Mount/fetchUserTables dependency changed. Fetching...");
    fetchUserTables().catch(() => {
        // Catch errors from initial fetch so the component doesn't crash
        console.error("Initial table fetch failed and was caught by useEffect.");
        // Error state is already managed within fetchUserTables
    });
 }, [fetchUserTables]); // Dependency array includes the memoized fetch function


  // --- Add Table Modal Handlers ---
  /** Opens the Add Table modal */
  const showAddTableModal = () => {
    addTableForm.resetFields();
    setIsAddModalVisible(true);
  };

  /** Handles Add Table modal form submission */
  const handleAddTableOk = async () => {
    try {
      const values = await addTableForm.validateFields();
      const newTableName = values.tableName.trim();
      if (!newTableName) { message.error("Table name cannot be empty."); return; }
      // Client-side check for duplicate name before API call
      if (tables.includes(newTableName)) {
         message.error(`Table "${newTableName}" already exists.`);
         return;
      }
      setConfirmLoadingAdd(true);
      console.log(`Sidebar: Attempting to create table: ${newTableName}`);
      const response = await api.addTable(newTableName); // API call
      message.success(response?.message || `Table "${newTableName}" created successfully!`);
      setIsAddModalVisible(false);
      await fetchUserTables(); // Await the refresh
    } catch (errorInfo: any) {
      console.error('Sidebar: Create Table Failed:', errorInfo);
       const errorMsg = errorInfo.message || 'Please try again.';
       if (errorInfo.errorFields) { message.error('Validation failed...'); }
       else { message.error(`Failed to create table: ${errorMsg}`); }
    } finally {
      setConfirmLoadingAdd(false);
    }
  };

  /** Handles closing the Add Table modal */
  const handleAddTableCancel = () => {
    setIsAddModalVisible(false);
  };
  // --- End Add Table Modal Handlers ---

  // --- Rename Table Handlers ---
  /** Opens the Rename Table modal, pre-filling the form */
  const showRenameTableModal = (oldTableName: string) => {
    setRenamingTableInfo({ oldName: oldTableName });
    renameTableForm.setFieldsValue({ newTableName: oldTableName }); // Pre-fill with old name
    setIsRenameModalVisible(true);
  };

  /** Handles Rename Table modal form submission */
  const handleRenameTableOk = async () => {
    if (!renamingTableInfo) return; // Should have oldName if modal is open
    const { oldName } = renamingTableInfo;

    try {
      const values = await renameTableForm.validateFields();
      const newTableName = values.newTableName.trim();

      // Validation (handled mostly by form rules now)
      if (newTableName === oldName) {
          message.info("No changes made.");
          setIsRenameModalVisible(false);
          setRenamingTableInfo(null);
          return;
      }

      setConfirmLoadingRename(true);
      console.log(`Sidebar: Attempting to rename table "${oldName}" to "${newTableName}"`);
      const messageKey = `rename-${oldName}`;
      message.loading({ content: `Renaming table to "${newTableName}"...`, key: messageKey, duration: 0 });

      await api.renameTable(oldName, newTableName); // API call

      message.success({ content: `Table renamed to "${newTableName}" successfully!`, key: messageKey, duration: 3 });
      setIsRenameModalVisible(false);
      setRenamingTableInfo(null);

      // Refresh the table list AFTER successful rename
      await fetchUserTables();

      // If the renamed table was the currently selected one, update selection to new name
      if (selectedTable === oldName) {
        onSelectTable(newTableName);
      }

    } catch (errorInfo: any) {
      console.error(`Sidebar: Rename Table Failed for ${oldName}:`, errorInfo);
      const errorMsg = errorInfo.message || 'Please try again.';
      if (errorInfo.errorFields) { message.error('Validation failed...'); }
      else { message.error(`Failed to rename table: ${errorMsg}`); }
      // Keep modal open on error for correction
    } finally {
      setConfirmLoadingRename(false);
      // Ensure loading message is removed even on error
      message.destroy(`rename-${renamingTableInfo?.oldName}`);
    }
  };

  /** Handles closing the Rename Table modal */
  const handleRenameTableCancel = () => {
    setIsRenameModalVisible(false);
    setRenamingTableInfo(null); // Clear the state tracking the table being renamed
  };
  // --- End Rename Table Handlers ---

  // --- Delete Table Handler ---
  /** Handles the deletion of a table after confirmation */
  const handleDeleteTable = (tableNameToDelete: string) => {
    confirm({
        title: `Delete Table "${tableNameToDelete}"?`,
        icon: <DeleteOutlined style={{ color: 'red' }}/>,
        content: 'This will permanently delete the table and all its data. This action cannot be undone.',
        okText: 'Yes, Delete Permanently', okType: 'danger', cancelText: 'Cancel', maskClosable: false,
        onOk: async () => {
            // Use general loading state for delete as it affects the whole list
            setLoading(true);
            setError(null);
            const messageKey = `delete-${tableNameToDelete}`;
            message.loading({ content: `Deleting table "${tableNameToDelete}"...`, key: messageKey, duration: 0 });
            try {
                console.log(`Sidebar: Attempting to delete table: ${tableNameToDelete}`);
                await api.deleteTable(tableNameToDelete); // API Call
                message.success({ content: `Table "${tableNameToDelete}" deleted.`, key: messageKey, duration: 3 });
                // If deleted table was selected, deselect it
                if (selectedTable === tableNameToDelete) onSelectTable(null);
                // Await the refresh to ensure list is updated before loading stops
                await fetchUserTables();
            } catch (err: any) {
                 console.error(`Sidebar: Error during delete/refetch for ${tableNameToDelete}:`, err);
                 const errorMsg = err.message || 'Unknown error during deletion/refresh';
                 setError(`Operation failed: ${errorMsg}`); // Show error in UI
                 message.error({ content: `Operation failed: ${errorMsg}`, key: messageKey, duration: 5 });
                 setLoading(false); // Manually stop loading on error
            }
            // setLoading(false) is handled by fetchUserTables on success
        },
        onCancel() { console.log('Delete table cancelled'); },
    });
  };
  // --- End Delete Table Handler ---

  // --- Create View Handler (Placeholder) ---
  const handleCreateView = (targetTable: string, viewType: 'grid' | 'gallery') => {
      console.log(`Sidebar: Create ${viewType} view for table: ${targetTable}`);
      message.info(`Initiated create ${viewType} view for "${targetTable}".`);
      if (onCreateView) onCreateView(targetTable, viewType);
      onSelectTable(targetTable); // Select table when creating view
  };

  // --- Select Table Handler ---
  /** Handles click on the main area of a table item */
  const handleSelectTable = (tableName: string) => {
    onSelectTable(tableName); // Call parent callback
  };


  /**
   * Renders the main content of the sidebar (loading/error/empty/table list).
   */
  const renderSidebarContent = () => {
    // Handle Loading State
    if (loading && tables.length === 0) {
      return <div style={{ padding: '20px', textAlign: 'center' }}><Spin tip="Loading tables..." /></div>;
    }
    // Handle Error State
    if (error) {
       return <div style={{ padding: '10px' }}>
                <Alert
                    message={error}
                    type="error"
                    showIcon
                    action={ <Button size="small" type="link" onClick={() => fetchUserTables()}> Retry </Button> }
                />
             </div>;
    }
    // Handle Empty State
    if (!loading && tables.length === 0) {
       return <div style={{ padding: '20px', textAlign: 'center' }}>
                <Empty description="No tables found" />
                <Button type="link" onClick={showAddTableModal} style={{marginTop: '10px'}}>Create your first table</Button>
             </div>;
    }

    // --- Define Dropdown Menu Content ---
    const createTableActionMenu = (tableName: string) => (
        <Menu onClick={({ domEvent }) => { domEvent.stopPropagation(); /* Stop menu click from propagating */ }}>
            {/* Create View Submenu */}
            <Menu.SubMenu key="create-view" title="Create View" icon={<PlusOutlined />}>
                <Menu.Item key="view-grid" icon={<TableOutlined />} onClick={() => handleCreateView(tableName, 'grid')} > Grid View </Menu.Item>
                <Menu.Item key="view-gallery" icon={<AppstoreOutlined />} onClick={() => handleCreateView(tableName, 'gallery')} > Gallery View </Menu.Item>
            </Menu.SubMenu>
            <Menu.Divider />
            {/* Rename Action */}
            <Menu.Item key="rename-table" icon={<EditOutlined />} onClick={() => showRenameTableModal(tableName)} > Rename Table </Menu.Item>
            <Menu.Divider />
            {/* Delete Action */}
            <Menu.Item key="delete-table" danger icon={<DeleteOutlined />} onClick={() => handleDeleteTable(tableName)} > Delete Table </Menu.Item>
        </Menu>
    );

    // --- Render Menu List with Dropdowns ---
    return (
       <Menu
         theme="light"
         mode="inline"
         selectedKeys={selectedTable ? [selectedTable] : []}
         // Selection handled by div onClick inside Menu.Item
         style={{ height: '100%', borderRight: 0, overflowY: 'auto', padding: '5px 0' }}
       >
         {tables.map(table => (
           <Menu.Item key={table} style={{ padding: 0, height: 'auto', lineHeight: 'normal' }}>
              {/* Wrapper div for layout and main click handling */}
              <div
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px 8px 24px' }}
                onClick={() => handleSelectTable(table)} // Select table on click
                title={table} // Tooltip for potentially truncated names
              >
                {/* Table Name (takes up space, truncates) */}
                <span style={{ flexGrow: 1, cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: '5px' }}>
                    {table}
                </span>
                {/* Actions Dropdown */}
                <Dropdown
                    overlay={createTableActionMenu(table)} // Menu content
                    trigger={['click']} // Opens on click
                    placement="bottomRight"
                >
                    {/* Ellipsis button to trigger dropdown */}
                    {/* Stop propagation prevents Menu.Item onClick from firing */}
                    <Button
                        type="text"
                        icon={<EllipsisOutlined />}
                        size="small"
                        onClick={(e) => e.stopPropagation()}
                        style={{ flexShrink: 0 }} // Prevent button shrinking
                        aria-label={`Actions for table ${table}`} // Accessibility
                    />
                </Dropdown>
              </div>
           </Menu.Item>
         ))}
       </Menu>
    );
  }; // --- End renderSidebarContent ---


  // --- Component JSX Structure ---
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', borderRight: '1px solid #f0f0f0' }}>
        {/* Header */}
        <div style={{ padding: '10px 16px', borderBottom: '1px solid #f0f0f0', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <strong>Tables</strong>
            {/* Show subtle loading spinner in header when any async op is running */}
            {loading && <Spin size="small" />}
        </div>

        {/* Main Content Area */}
        <div style={{ flexGrow: 1, overflowY: 'auto', overflowX: 'hidden' }}>
            {renderSidebarContent()}
        </div>

        {/* Footer Button */}
        <div style={{ padding: '8px', borderTop: '1px solid #f0f0f0', flexShrink: 0 }}>
            <Button type="primary" icon={<PlusOutlined />} block onClick={showAddTableModal} disabled={loading} > Add Table </Button>
        </div>

        {/* --- Modals --- */}

        {/* Add Table Modal */}
        {isAddModalVisible && (
            <Modal title="Create New Table" visible={isAddModalVisible} onOk={handleAddTableOk} confirmLoading={confirmLoadingAdd} onCancel={handleAddTableCancel} okText="Create" destroyOnClose maskClosable={!confirmLoadingAdd}>
                <p style={{ marginBottom: '15px', fontSize: '13px', color: '#666' }}>
                    Enter a unique name for your new table.
                    <br/>
                    <strong style={{color:'darkred'}}>Warning:</strong> Do not use reserved keywords.
                </p>
                <Form form={addTableForm} layout="vertical" name="add_table_form">
                    <Form.Item name="tableName" label="New Table Name" rules={[{ required: true, message: 'Required' }, { whitespace: true, message: 'Cannot be empty' }, { pattern: /^[a-zA-Z_][a-zA-Z0-9_]*$/, message: 'Invalid format' }, { max: 63, message: 'Too long (max 63)' }]}>
                        <Input placeholder="e.g., projects or user_preferences" />
                    </Form.Item>
                </Form>
            </Modal>
        )}

        {/* Rename Table Modal */}
        {isRenameModalVisible && renamingTableInfo && ( // Render only when visible and oldName is known
            <Modal
                title={`Rename Table "${renamingTableInfo.oldName}"`}
                visible={isRenameModalVisible}
                onOk={handleRenameTableOk}
                confirmLoading={confirmLoadingRename}
                onCancel={handleRenameTableCancel}
                okText="Rename"
                destroyOnClose
                maskClosable={!confirmLoadingRename}
            >
                <p style={{ marginBottom: '15px', fontSize: '13px', color: '#666' }}>
                    Enter a new unique name for this table.
                </p>
                <Form
                    form={renameTableForm}
                    layout="vertical"
                    name="rename_table_form"
                    // Set initial value when modal opens
                    initialValues={{ newTableName: renamingTableInfo.oldName }}
                >
                    <Form.Item
                        name="newTableName"
                        label="New Table Name"
                        rules={[
                            { required: true, message: 'Required' },
                            { whitespace: true, message: 'Cannot be empty' },
                            { pattern: /^[a-zA-Z_][a-zA-Z0-9_]*$/, message: 'Invalid format' },
                            { max: 63, message: 'Too long (max 63)' },
                            // Custom validator to check against old name and other existing names
                             ({ getFieldValue }) => ({
                                validator(_, value) {
                                  const trimmedValue = value?.trim();
                                  if (!trimmedValue) return Promise.resolve(); // Required rule handles empty
                                  if (trimmedValue === renamingTableInfo.oldName) {
                                     return Promise.reject(new Error('New name must be different.'));
                                  }
                                  // Check against other existing table names (client-side quick check)
                                  if (tables.filter(t => t !== renamingTableInfo.oldName).includes(trimmedValue)) {
                                       return Promise.reject(new Error('This table name already exists.'));
                                  }
                                  return Promise.resolve();
                                },
                              }),
                        ]}
                    >
                        <Input placeholder="Enter new table name" />
                    </Form.Item>
                </Form>
            </Modal>
        )}

    </div> // End main container div
  );
};

export default Sidebar;