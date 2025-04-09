
import React, { useState, useEffect, useCallback } from 'react';
import { Menu, Spin, Alert, Empty, Button, Modal, Form, Input, message, Dropdown, Space } from 'antd';
import { PlusOutlined, EllipsisOutlined, AppstoreOutlined, TableOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons';
import * as api from '../../api';
import { UserOutlined,LogoutOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { LoggedInUser } from '../../api/types';
const { confirm } = Modal;

/**
 * Props for the Sidebar component.
 */
interface SidebarProps {

    selectedTable: string | null;
   
    onSelectTable: (tableName: string | null) => void;
   
    onCreateView?: (tableName: string, viewType: 'grid' | 'gallery') => void;
   
    onTableListChange?: () => void;
}

/**
 * Sidebar component that displays tables, allows adding/renaming/deleting tables,
 * and provides actions per table (e.g., Create View).
 */
const Sidebar: React.FC<SidebarProps> = ({ selectedTable, onSelectTable, onCreateView, onTableListChange }) => {

  const [tables, setTables] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [isAddModalVisible, setIsAddModalVisible] = useState<boolean>(false);
  const [confirmLoadingAdd, setConfirmLoadingAdd] = useState<boolean>(false);
  const [addTableForm] = Form.useForm();

  const [isRenameModalVisible, setIsRenameModalVisible] = useState<boolean>(false);
  const [confirmLoadingRename, setConfirmLoadingRename] = useState<boolean>(false);
  const [renameTableForm] = Form.useForm();
  const [renamingTableInfo, setRenamingTableInfo] = useState<{ oldName: string } | null>(null);

  const [deletingTableKey, setDeletingTableKey] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<LoggedInUser | null>(null);
  const [loadingUser, setLoadingUser] = useState<boolean>(true);

  const stringToColor = (str: string): string => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
      hash = hash & hash; // Convert to 32bit integer
    }
    const colors = [
      '#F56A00', '#7265E6', '#FFBF00', '#00A2AE', '#1890ff', '#f5222d',
      '#52c41a', '#faad14', '#eb2f96', '#2f54eb', '#fa8c16', '#a0d911'
    ]; // Example palette
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  };
  
  const getInitials = (name: string): string => {
    if (!name) return '?';
    const trimmedName = name.trim();
    if (trimmedName.length === 0) return '?';
    const parts = trimmedName.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    if (trimmedName.length >= 2) {
      return trimmedName.substring(0, 2).toUpperCase();
    }
    return trimmedName.substring(0, 1).toUpperCase();
  };

  useEffect(() => {
    let isMounted = true;
    setLoadingUser(true);
    api.checkLoginStatus()
      .then(status => { if (isMounted) { setCurrentUser(status.user); setLoadingUser(false); } })
      .catch(err => { if (isMounted) { console.error("Login check failed", err); setError("Failed login check"); setCurrentUser(null); setLoadingUser(false); } });
    return () => { isMounted = false; };
  }, []);

  const fetchUserTables = useCallback(async (): Promise<void> => {
    setDeletingTableKey(null); 
    setLoading(true);
    setError(null);
    console.log("Sidebar: Fetching tables...");
    try {
        const data = await api.fetchTables();
        if (!Array.isArray(data)) {
            throw new Error("Invalid table list format received.");
        }
        setTables(data.sort()); 
        setError(null);
  
        if (onTableListChange) onTableListChange();
    } catch (err: any) {
        console.error("Sidebar: Fetch tables error:", err);
        const errorMsg = err.message || 'Unknown error';
        setError(`Failed to load tables: ${errorMsg}`);
        setTables([]); // Clear list on error

    } finally {
        setLoading(false); 
    }
 }, [onTableListChange]); 


 /**
  * useEffect hook to perform the initial table fetch when the component mounts.
  */
 useEffect(() => {
    
    console.log("Sidebar: Mount/fetchUserTables dependency changed. Fetching...");
    fetchUserTables().catch(() => {
        console.error("Initial table fetch failed and was caught by useEffect.");
    });
 }, [fetchUserTables]);



  const showAddTableModal = () => {
    addTableForm.resetFields();
    setIsAddModalVisible(true);
  };


  const handleAddTableOk = async () => {
    try {
      const values = await addTableForm.validateFields();
      const newTableName = values.tableName.trim();
      if (!newTableName) { message.error("Table name cannot be empty."); return; }

      if (tables.includes(newTableName)) {
         message.error(`Table "${newTableName}" already exists.`);
         return;
      }
      setConfirmLoadingAdd(true);
      console.log(`Sidebar: Attempting to create table: ${newTableName}`);
      const response = await api.addTable(newTableName); // API call
      message.success(response?.message || `Table "${newTableName}" created successfully!`);
      setIsAddModalVisible(false);
      await fetchUserTables(); 
    } catch (errorInfo: any) {
      console.error('Sidebar: Create Table Failed:', errorInfo);
       const errorMsg = errorInfo.message || 'Please try again.';
       if (errorInfo.errorFields) { message.error('Validation failed...'); }
       else { message.error(`Failed to create table: ${errorMsg}`); }
    } finally {
      setConfirmLoadingAdd(false);
    }
  };
  const navigate = useNavigate();

  const handleAddTableCancel = () => {
    setIsAddModalVisible(false);
  };
 
  const showRenameTableModal = (oldTableName: string) => {
    setRenamingTableInfo({ oldName: oldTableName });
    renameTableForm.setFieldsValue({ newTableName: oldTableName }); 
    setIsRenameModalVisible(true);
  };

  const handleRenameTableOk = async () => {
    if (!renamingTableInfo) return; 
    const { oldName } = renamingTableInfo;

    try {
      const values = await renameTableForm.validateFields();
      const newTableName = values.newTableName.trim();

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

      await fetchUserTables();

      if (selectedTable === oldName) {
        onSelectTable(newTableName);
      }

    } catch (errorInfo: any) {
      console.error(`Sidebar: Rename Table Failed for ${oldName}:`, errorInfo);
      const errorMsg = errorInfo.message || 'Please try again.';
      if (errorInfo.errorFields) { message.error('Validation failed...'); }
      else { message.error(`Failed to rename table: ${errorMsg}`); }
    } finally {
      setConfirmLoadingRename(false);
      message.destroy(`rename-${renamingTableInfo?.oldName}`);
    }
  };

  const handleRenameTableCancel = () => {
    setIsRenameModalVisible(false);
    setRenamingTableInfo(null);
  };

  const handleDeleteTable = (tableNameToDelete: string) => {
    confirm({
        title: `Delete Table "${tableNameToDelete}"?`,
        icon: <DeleteOutlined style={{ color: 'red' }}/>,
        content: 'This will permanently delete the table and all its data. This action cannot be undone.',
        okText: 'Yes, Delete Permanently', okType: 'danger', cancelText: 'Cancel', maskClosable: false,
        onOk: async () => {
            setLoading(true);
            setError(null);
            const messageKey = `delete-${tableNameToDelete}`;
            message.loading({ content: `Deleting table "${tableNameToDelete}"...`, key: messageKey, duration: 0 });
            try {
                console.log(`Sidebar: Attempting to delete table: ${tableNameToDelete}`);
                await api.deleteTable(tableNameToDelete); // API Call
                message.success({ content: `Table "${tableNameToDelete}" deleted.`, key: messageKey, duration: 3 });
                if (selectedTable === tableNameToDelete) onSelectTable(null);
                await fetchUserTables();
            } catch (err: any) {
                 console.error(`Sidebar: Error during delete/refetch for ${tableNameToDelete}:`, err);
                 const errorMsg = err.message || 'Unknown error during deletion/refresh';
                 setError(`Operation failed: ${errorMsg}`); // Show error in UI
                 message.error({ content: `Operation failed: ${errorMsg}`, key: messageKey, duration: 5 });
                 setLoading(false); // Manually stop loading on error
            }
        },
        onCancel() { console.log('Delete table cancelled'); },
    });
  };

  const handleCreateView = (targetTable: string, viewType: 'grid' | 'gallery') => {
      console.log(`Sidebar: Create ${viewType} view for table: ${targetTable}`);
      message.info(`Initiated create ${viewType} view for "${targetTable}".`);
      if (onCreateView) onCreateView(targetTable, viewType);
      onSelectTable(targetTable);
  };

  const handleSelectTable = (tableName: string) => {
    onSelectTable(tableName);
  };


  /**
   * Renders the main content of the sidebar (loading/error/empty/table list).
   */
  const renderSidebarContent = () => {
    if (loading && tables.length === 0) {
      return <div style={{ padding: '20px', textAlign: 'center' }}><Spin tip="Loading tables..." /></div>;
    }
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
    if (!loading && tables.length === 0) {
       return <div style={{ padding: '20px', textAlign: 'center' }}>
                <Empty description="No tables found" />
                <Button type="link" onClick={showAddTableModal} style={{marginTop: '10px'}}>Create your first table</Button>
             </div>;
    }

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

    return (
       <Menu
         theme="light"
         mode="inline"
         selectedKeys={selectedTable ? [selectedTable] : []}
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


  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', borderRight: '1px solid #f0f0f0' }}>

        {/* -------- User Header (MODIFIED) -------- */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* Conditional Avatar/Icon */}
            {loadingUser ? (
                 <Spin size="small" /> // Show spinner while loading user
            ) : currentUser ? (
                 <span
                    aria-label={`Avatar for ${currentUser.username}`}
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '28px', // Adjust size as needed
                        height: '28px',
                        borderRadius: '6px', // Slightly rounded corners
                        backgroundColor: stringToColor(currentUser.username || 'default'), // Generate color
                        color: '#fff', // White text
                        fontSize: '12px', // Adjust font size
                        fontWeight: '600', // Semi-bold
                        flexShrink: 0, // Prevent shrinking
                    }}>
                     {getInitials(currentUser.username || '?')} {/* Get initials */}
                 </span>
            ) : (
                 <UserOutlined style={{ fontSize: '16px', color: '#bfbfbf' }} /> // Fallback icon
            )}

            {/* Greeting Text */}
            <span style={{ fontWeight: 'bold', fontSize: '14px', color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {loadingUser ? 'Loading...' : (currentUser ? `Hi, ${currentUser.username}` : 'Not logged in')}
            </span>
        </div>

        {/* Main Content Area */}
        <div style={{ flexGrow: 1, overflowY: 'auto', overflowX: 'hidden' }}>
            {renderSidebarContent()}
        </div>

        
        {/* Footer Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        
        {/* All your top content including Add Table goes here */}
        <div style={{ padding: '8px', borderTop: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            block
            onClick={showAddTableModal}
            disabled={loading}
            style={{ flexGrow: 1 }}
          >
            Add Table
          </Button>
        </div>

        {/* Spacer to push profile to bottom */}
        <div style={{ flexGrow: 1 }} />

        {/* Profile button at the bottom */}
        <div style={{ padding: '8px', borderTop: '1px solid #f0f0f0' }}>
          <Dropdown
            overlay={
              <Menu>
                <Menu.Item
                  key="logout"
                  danger
                  icon={<LogoutOutlined />}
                  onClick={async () => {
                    try {
                      await api.logoutUser(); // imported from your index.ts
                      message.success('Logged out');
                      window.location.href = '/login';
                    } catch (error) {
                      message.error('Failed to logout');
                    }
                  }}
                >
                  Logout
                </Menu.Item>
              </Menu>
            }
            trigger={['click']}
            placement="topCenter"
          >
            <Button
              type="text"
              icon={<UserOutlined />}
              block
              style={{ textAlign: 'left' }}
            >
              Profile
            </Button>
          </Dropdown>
        </div>
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
                             ({ getFieldValue }) => ({
                                validator(_, value) {
                                  const trimmedValue = value?.trim();
                                  if (!trimmedValue) return Promise.resolve(); // Required rule handles empty
                                  if (trimmedValue === renamingTableInfo.oldName) {
                                     return Promise.reject(new Error('New name must be different.'));
                                  }
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