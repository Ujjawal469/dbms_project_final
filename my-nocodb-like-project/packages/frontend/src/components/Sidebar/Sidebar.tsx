// // src/components/Sidebar/Sidebar.tsx

// import React, { useState, useEffect, useCallback } from 'react';
// import { Menu, Spin, Alert, Empty, Button, Modal, Form, Input, message, Dropdown, Space } from 'antd';
// import { PlusOutlined, MoreOutlined, DeleteOutlined } from '@ant-design/icons';
// import * as api from '../../api'; // Assuming API functions are in src/api/index.ts

// /**
//  * Props for the Sidebar component.
//  */
// interface SidebarProps {
//     /** The name of the currently selected table, or null if none is selected */
//     selectedTable: string | null;
//     /** Callback function triggered when a table is selected from the menu */
//     onSelectTable: (tableName: string) => void;
// }

// /**
//  * Sidebar component that displays a list of user-accessible tables
//  * and provides functionality to add new tables (which creates physical DB tables)
//  * and delete existing tables.
//  */
// const Sidebar: React.FC<SidebarProps> = ({ selectedTable, onSelectTable }) => {
//   // State for the list of tables displayed in the sidebar
//   const [tables, setTables] = useState<string[]>([]);
//   // State to track if tables are currently being loaded
//   const [loading, setLoading] = useState<boolean>(false);
//   // State to store any error message related to fetching tables
//   const [error, setError] = useState<string | null>(null);

//   // State for managing the "Add Table" modal dialog
//   const [isAddModalVisible, setIsAddModalVisible] = useState<boolean>(false);
//   // State to show a loading indicator on the modal's confirmation button
//   const [confirmLoadingAdd, setConfirmLoadingAdd] = useState<boolean>(false);
//   // Ant Design Form instance to manage the state and validation of the modal's input field
//   const [addTableForm] = Form.useForm();

//   // State to track which table's delete operation is currently in progress
//   // Stores the key (table name) of the item being deleted
//   const [deletingTableKey, setDeletingTableKey] = useState<string | null>(null);

//   /**
//    * Fetches the list of tables associated with the current logged-in user from the backend API.
//    * Uses useCallback to memoize the function, preventing unnecessary recreation on re-renders.
//    * Also resets the deletingTableKey state.
//    */
//   const fetchUserTables = useCallback(() => {
//     setDeletingTableKey(null); // Reset deleting state when fetching/refreshing
//     setLoading(true); // Indicate loading started
//     setError(null);   // Clear any previous errors
//     console.log("Sidebar: Fetching tables...");
//     api.fetchTables() // Call the API function
//       .then(data => {
//         console.log("Sidebar: Tables received:", data);
//         // Update state with the fetched tables, sorted alphabetically
//         setTables(data.sort());
//       })
//       .catch(err => {
//         console.error("Sidebar: Fetch tables error:", err);
//         // Set the error state using the message processed by the central API error handler
//         setError(`Failed to load tables: ${err.message || 'Unknown error'}`);
//         setTables([]); // Clear the tables list on error
//       })
//       .finally(() => {
//         setLoading(false); // Ensure loading indicator is turned off
//       });
//   }, []); // No dependencies, as it fetches based on the current session implicitly

//   /**
//    * useEffect hook to fetch the tables when the component first mounts.
//    */
//   useEffect(() => {
//     fetchUserTables();
//   }, [fetchUserTables]); // Depend on the memoized fetch function

//   // --- Add Table Modal Handlers ---

//   /**
//    * Opens the "Add Table" modal and resets any previous input in the form.
//    */
//   const showAddTableModal = () => {
//     addTableForm.resetFields(); // Clear the input field
//     setIsAddModalVisible(true); // Set modal visibility to true
//   };

//   /**
//    * Handles the submission of the "Add Table" modal form.
//    * Validates the input, calls the backend API to create the table,
//    * shows feedback messages, and refreshes the table list.
//    */
//   const handleAddTableOk = async () => {
//     try {
//       // Validate the form input fields based on the rules defined in Form.Item
//       const values = await addTableForm.validateFields();
//       const newTableName = values.tableName.trim(); // Get the trimmed table name from form values

//       // Extra safety check (though validation rules should catch this)
//       if (!newTableName) {
//           message.error("Table name cannot be empty.");
//           return;
//       }

//       setConfirmLoadingAdd(true); // Show loading indicator on the "Create" button
//       console.log(`Sidebar: Attempting to create table: ${newTableName}`);

//       // Call the API function responsible for creating the physical table and association
//       const response = await api.addTable(newTableName);

//       // Display a success message (prefer backend message if available)
//       message.success(response?.message || `Table "${newTableName}" created successfully!`);
//       setIsAddModalVisible(false); // Close the modal

//       // Refresh the list of tables in the sidebar to include the new one
//       fetchUserTables();

//     } catch (errorInfo: any) {
//       // Log the detailed error for debugging purposes
//       console.error('Sidebar: Create Table Failed:', errorInfo);

//       // Check if the error originated from Ant Design form validation
//       if (errorInfo.errorFields) {
//           message.error('Validation failed. Please check the table name.');
//       } else {
//           // Otherwise, assume it's an error from the API call (already processed)
//           // Display the error message provided in the error object
//           message.error(`Failed to create table: ${errorInfo.message || 'Please try again.'}`);
//       }
//     } finally {
//       // Always turn off the loading indicator on the modal button
//       setConfirmLoadingAdd(false);
//     }
//   };

//   /**
//    * Handles closing the "Add Table" modal via the cancel button or the 'X' icon.
//    */
//   const handleAddTableCancel = () => {
//     setIsAddModalVisible(false); // Set modal visibility to false
//   };

//   // --- End Add Table Modal Handlers ---

//   // --- Delete Table Handler ---

//    /**
//    * Handles the request to delete a table. Shows a confirmation modal.
//    * If confirmed, calls the backend API to delete the table and its association,
//    * shows feedback messages, and refreshes the table list.
//    * @param {string} tableName - The name of the table to delete.
//    * @param {React.MouseEvent} event - The click event (used to stop propagation).
//    */
//    const handleDeleteTable = (tableName: string, event: React.MouseEvent) => {
//     event.stopPropagation(); // Prevent the underlying Menu.Item's onClick from firing
//     console.log("Sidebar: Delete requested for", tableName);

//     // Show a confirmation dialog before proceeding
//     Modal.confirm({
//       title: `Delete Table "${tableName}"?`,
//       icon: <DeleteOutlined style={{ color: 'red' }}/>, // Optional: Add delete icon to modal
//       content: (
//         <div>
//           <p>Are you sure you want to permanently delete the table <strong style={{ color: 'darkred' }}>"{tableName}"</strong> and all its data?</p>
//           <p style={{ color: 'darkred', fontWeight: 'bold' }}>This action cannot be undone.</p>
//         </div>
//       ),
//       okText: 'Yes, Delete',
//       okType: 'danger', // Style the OK button as dangerous
//       cancelText: 'No',
//       maskClosable: true, // Allow closing by clicking outside
//       // Function to execute when the user confirms deletion
//       onOk: async () => {
//         console.log(`Sidebar: Confirmed deletion for ${tableName}`);
//         setDeletingTableKey(tableName); // Set state to indicate deletion is in progress for this item
//         const messageKey = `delete-${tableName}`; // Unique key for the Ant Design message
//         // Show an indefinite loading message while the operation happens
//         message.loading({ content: `Deleting table "${tableName}"...`, key: messageKey, duration: 0 });

//         try {
//           // Call the backend API to delete the table
//           await api.deleteTable(tableName);
//           // Replace loading message with success message
//           message.success({ content: `Table "${tableName}" deleted successfully!`, key: messageKey, duration: 3 });
//           // Fetch the updated list of tables from the backend (safer than optimistic UI update)
//           fetchUserTables();
//           // If the deleted table was the selected one, clear the selection (optional)
//           if (selectedTable === tableName) {
//             onSelectTable(''); // Or null, depending on parent component expectation
//           }
//         } catch (error: any) {
//           console.error(`Sidebar: Delete Table Failed for ${tableName}:`, error);
//           // Replace loading message with error message
//           message.error({ content: `Failed to delete table "${tableName}": ${error.message || 'Please try again.'}`, key: messageKey, duration: 5 });
//           setDeletingTableKey(null); // Reset the deleting state on error
//         }
//         // Note: fetchUserTables() will also reset deletingTableKey on success
//         // because it's called at the start of that function.
//       },
//       // Function to execute if the user cancels deletion
//       onCancel: () => {
//         console.log(`Sidebar: Cancelled deletion for ${tableName}`);
//       }
//     });
//   };
//   // --- End Delete Table Handler ---

//   /**
//    * Handles the click event on a table name in the sidebar menu.
//    * Prevents selection if a delete operation is in progress for the clicked item.
//    * @param {object} info - The event object from Ant Design Menu, containing the key (table name).
//    */
//   const handleSelect = ({ key }: { key: string }) => {
//      // Do not select if this item is currently being deleted
//      if (deletingTableKey === key) return;
//      onSelectTable(key); // Call the callback prop passed from the parent component
//   };


//   /**
//    * Renders the appropriate content within the sidebar based on the current state
//    * (loading, error, empty list, or the list of tables with action menus).
//    * @returns {React.ReactNode} The JSX element to render in the main sidebar area.
//    */
//   const renderSidebarContent = () => {
//     // Show spinner while loading
//     if (loading) {
//       return <div style={{ padding: '20px', textAlign: 'center' }}><Spin tip="Loading tables..." /></div>;
//     }
//     // Show error alert if fetching failed
//     if (error) {
//       return <div style={{ padding: '10px' }}><Alert message={error} type="error" showIcon /></div>;
//     }
//     // Show empty state message if not loading and no tables exist
//     if (!loading && tables.length === 0) {
//        return <div style={{ padding: '20px' }}><Empty description="No tables found" /></div>;
//     }

//     /**
//      * Generates the dropdown menu content for a given table.
//      * Currently contains only the "Delete Table" option.
//      * @param {string} tableName - The name of the table for which to generate the menu.
//      * @returns {React.ReactElement} The Menu component for the dropdown.
//      */
//     const getMenuItems = (tableName: string): React.ReactElement => (
//         <Menu>
//             <Menu.Item
//                 key="delete"
//                 danger // Apply red styling to the text
//                 icon={<DeleteOutlined />}
//                 // Pass the event to the handler to stop propagation
//                 onClick={(e) => handleDeleteTable(tableName, e.domEvent as unknown as React.MouseEvent)}
//                 // Disable the delete option if this specific table is currently being deleted
//                 disabled={deletingTableKey === tableName}
//             >
//                  {/* Show different text while deleting */}
//                  {deletingTableKey === tableName ? 'Deleting...' : 'Delete Table'}
//             </Menu.Item>
//             {/* Add other actions here later if needed (e.g., Rename, Settings) */}
//         </Menu>
//     );


//     // Render the menu with table items, each having a dropdown
//     return (
//        <Menu
//          theme="light" // Adjust theme as needed
//          mode="inline" // Vertical menu style
//          // Highlight the currently selected table
//          selectedKeys={selectedTable ? [selectedTable] : []}
//          onClick={handleSelect} // Handler for clicking the main menu item area
//          style={{ height: '100%', borderRight: 0, overflowY: 'auto' }} // Style for layout and scrolling
//        >
//          {tables.map(table => (
//            // Use display:flex on Menu.Item to position name and dropdown
//            <Menu.Item key={table} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
//                 {/* Table Name Section */}
//                 {/* flexGrow allows name to take available space */}
//                 {/* overflow/ellipsis handles long names */}
//                 <span style={{ flexGrow: 1, overflow: 'hidden', textOverflow: 'ellipsis', marginRight: '8px' }}>
//                     {table}
//                 </span>

//                 {/* Actions Dropdown Section */}
//                 {/* flexShrink prevents button from shrinking */}
//                 <Dropdown
//                     overlay={getMenuItems(table)} // Provide the menu content
//                     trigger={['click']} // Open dropdown on click
//                     placement="bottomRight" // Position the dropdown
//                     // Disable the dropdown trigger itself if deleting this item
//                     disabled={deletingTableKey === table}
//                  >
//                     {/* Button that triggers the dropdown */}
//                     {/* IMPORTANT: Stop propagation here prevents the Menu.Item's onClick from firing when dots are clicked */}
//                     <Button
//                         type="text" // Button without background/border
//                         size="small"
//                         icon={<MoreOutlined />} // '...' icon
//                         onClick={(e) => e.stopPropagation()}
//                         // Show loading spinner on the button if this item is deleting
//                         loading={deletingTableKey === table}
//                         style={{ flexShrink: 0 }} // Prevent button shrinking
//                     />
//                 </Dropdown>
//            </Menu.Item>
//          ))}
//        </Menu>
//     );
//   };


//   // --- Component JSX Structure (Overall layout remains the same) ---
//   return (
//     // Use flexbox for overall vertical layout
//     <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
//         {/* Header/Title Area */}
//         <div style={{ padding: '10px 16px', borderBottom: '1px solid #f0f0f0', flexShrink: 0 }}>
//             <strong>Tables</strong>
//         </div>

//         {/* Main Content Area (grows to fill space) */}
//         <div style={{ flexGrow: 1, overflow: 'hidden' }}> {/* overflow: hidden helps contain the scrolling menu */}
//             {renderSidebarContent()}
//         </div>

//         {/* Fixed Button Area at the Bottom */}
//         <div style={{ padding: '8px', borderTop: '1px solid #f0f0f0', flexShrink: 0 }}>
//             <Button
//                 type="primary"
//                 icon={<PlusOutlined />}
//                 block // Full width button
//                 onClick={showAddTableModal} // Show the add modal
//                 disabled={loading} // Disable while loading initial list
//             >
//                 Add Table
//             </Button>
//         </div>

//         {/* Add Table Modal (definition remains the same) */}
//         {isAddModalVisible && (
//              <Modal
//                 title="Create New Table"
//                 visible={isAddModalVisible}
//                 onOk={handleAddTableOk}
//                 confirmLoading={confirmLoadingAdd}
//                 onCancel={handleAddTableCancel}
//                 okText="Create"
//                 destroyOnClose
//                 maskClosable={!confirmLoadingAdd} >
//                 {/* Modal informational text */}
//                 <p style={{ marginBottom: '15px', fontSize: '13px', color: '#666' }}>
//                    Enter a name to create a new table in the database.
//                    This table will automatically have a <code style={{ background:'#eee', padding:'1px 3px', borderRadius:'3px' }}>serial_num</code> primary key column.
//                    <br/>
//                    <strong style={{color:'darkred'}}>Warning:</strong> This creates a physical table outside of standard schema management tools.
//                 </p>
//                 {/* Modal Form */}
//                 <Form form={addTableForm} layout="vertical" name="add_table_form">
//                     <Form.Item
//                         name="tableName"
//                         label="New Table Name"
//                         rules={[
//                             { required: true, message: 'Please enter a table name!' },
//                             { whitespace: true, message: 'Table name cannot be just spaces!' },
//                             { pattern: /^[a-zA-Z_][a-zA-Z0-9_]*$/, message: 'Invalid format (letters, numbers, underscores, start with letter or underscore)'},
//                             { max: 63, message: 'Table name is too long (max 63 characters)' }
//                         ]}
//                     >
//                         <Input placeholder="e.g., projects or user_preferences" />
//                     </Form.Item>
//                 </Form>
//             </Modal>
//         )}
//     </div>
//   );
// };

// export default Sidebar;

// src/components/Sidebar/Sidebar.tsx

import React, { useState, useEffect, useCallback } from 'react';
import { Menu, Spin, Alert, Empty, Button, Modal, Form, Input, message, Dropdown, Space } from 'antd';
import { PlusOutlined, EllipsisOutlined, AppstoreOutlined, TableOutlined, DeleteOutlined } from '@ant-design/icons';
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
    /** Optional callback function to notify parent when table list changes (e.g., after add/delete) */
    onTableListChange?: () => void;
}

/**
 * Sidebar component that displays tables, allows adding tables,
 * and provides actions per table (Delete, Create View).
 */
const Sidebar: React.FC<SidebarProps> = ({ selectedTable, onSelectTable, onCreateView, onTableListChange }) => {
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
   * Updates the component's state and returns a Promise indicating success or failure.
   */
  const fetchUserTables = useCallback(async (): Promise<void> => {
    // setLoading(true) should be outside the check for existing loading state
    setLoading(true);
    setError(null);
    console.log("Sidebar: Fetching tables...");
    try {
        const data = await api.fetchTables();
        console.log("Sidebar: Tables received:", data);
        if (!Array.isArray(data)) {
            throw new Error("Invalid table list format received.");
        }
        setTables(data);
        setError(null);
        // Notify parent AFTER successful fetch and state update
        if (onTableListChange) onTableListChange();
    } catch (err: any) {
        console.error("Sidebar: Fetch tables error:", err);
        const errorMsg = err.message || 'Unknown error';
        setError(`Failed to load tables: ${errorMsg}`);
        setTables([]);
        // Re-throw error if needed for caller like handleDeleteTable
        // throw err; // Comment out if useEffect shouldn't crash on initial load fail
    } finally {
        setLoading(false);
    }
 }, [onTableListChange]); // Only depend on external props/state it USES, not state it SETS.
                         // If fetchTables needed userId from props/context, add it here.


 useEffect(() => {
    console.log("Sidebar: Mount/fetchUserTables dependency changed. Fetching...");
    fetchUserTables().catch(() => {
        console.error("Initial table fetch failed and was caught by useEffect.");
        // Error state is already set by fetchUserTables
    });
 }, [fetchUserTables]); // Now this dependency is stable unless onTableListChange changes.


  // --- Add Table Modal Handlers ---
  const showAddTableModal = () => {
    addTableForm.resetFields();
    setIsAddModalVisible(true);
  };

  const handleAddTableOk = async () => {
    try {
      const values = await addTableForm.validateFields();
      const newTableName = values.tableName.trim();
      if (!newTableName) { message.error("Table name cannot be empty."); return; }
      if (tables.includes(newTableName)) { // Prevent duplicate names
         message.error(`Table "${newTableName}" already exists.`);
         return;
      }

      setConfirmLoadingAdd(true);
      console.log(`Sidebar: Attempting to create table: ${newTableName}`);

      // Make sure api.addTable exists and is correctly implemented
      const response = await api.addTable(newTableName);

      message.success(response?.message || `Table "${newTableName}" created successfully!`);
      setIsAddModalVisible(false);

      // Refresh the list of tables
      await fetchUserTables(); // Await the refresh before proceeding

      // Optionally select the newly created table
      // onSelectTable(newTableName);

    } catch (errorInfo: any) {
      console.error('Sidebar: Create Table Failed:', errorInfo);
       const errorMsg = errorInfo.message || 'Please try again.';
       if (errorInfo.errorFields) {
           message.error('Validation failed. Please check the table name.');
       } else {
           message.error(`Failed to create table: ${errorMsg}`);
       }
    } finally {
      setConfirmLoadingAdd(false);
    }
  };

  const handleAddTableCancel = () => {
    setIsAddModalVisible(false);
  };
  // --- End Add Table Modal Handlers ---


  // --- Table Action Handlers ---

  /**
   * Handles the deletion of a table after confirmation.
   */
  const handleDeleteTable = (tableNameToDelete: string) => {
    confirm({
        title: `Delete Table "${tableNameToDelete}"?`,
        content: 'This will permanently delete the table and all its data. This action cannot be undone.',
        okText: 'Yes, Delete Permanently',
        okType: 'danger',
        cancelText: 'Cancel',
        maskClosable: false, // Prevent accidental close while thinking
        // Make onOk async to handle asynchronous operations
        onOk: async () => {
            // Set loading state specifically for this operation
            setLoading(true);
            setError(null); // Clear previous errors
            try {
                console.log(`Sidebar: Attempting to delete table: ${tableNameToDelete}`);
                // 1. Await the API call to delete the table on the backend
                await api.deleteTable(tableNameToDelete);
                message.success(`Table "${tableNameToDelete}" deleted. Refreshing list...`);

                // 2. If the currently selected table was the one deleted,
                //    notify the parent component to deselect it. Do this *before* refetch.
                if (selectedTable === tableNameToDelete) {
                    console.log("Sidebar: Deselecting the deleted table.");
                    onSelectTable(null);
                }

                // 3. Await the table list refresh *after* successful deletion
                console.log("Sidebar: Refetching tables after delete...");
                // fetchUserTables handles setting loading to false in its finally block
                await fetchUserTables();
                console.log("Sidebar: Table list refreshed after delete.");

            } catch (err: any) {
                 // Handle errors from either the deleteTable API call OR the fetchUserTables call
                 console.error(`Sidebar: Error during delete/refetch for ${tableNameToDelete}:`, err);
                 const errorMsg = err.message || 'Unknown error during deletion/refresh';
                 // Set the main error state for display
                 setError(`Operation failed: ${errorMsg}`);
                 message.error(`Operation failed: ${errorMsg}`);
                 // Ensure loading is turned off if an error occurred before fetchUserTables finally block ran
                 setLoading(false);
            }
             // setLoading(false) is handled by fetchUserTables on success path
        },
        onCancel() {
            console.log('Delete table cancelled');
        },
    });
  };

  /**
   * Placeholder handler for creating different views (Grid/Gallery).
   */
  const handleCreateView = (targetTable: string, viewType: 'grid' | 'gallery') => {
     console.log(`Sidebar: Create ${viewType} view for table: ${targetTable}`);
     message.info(`Initiated create ${viewType} view for "${targetTable}".`);
     // Call the callback prop if provided to notify the parent component
     if (onCreateView) {
         onCreateView(targetTable, viewType);
     }
     // Select the table when initiating view creation (optional UX choice)
     onSelectTable(targetTable);
  };
  // --- End Table Action Handlers ---


  /**
   * Handles the click event on the main area of a table menu item.
   */
  const handleSelectTable = (tableName: string) => {
    // Prevent re-selecting the same table unnecessarily if needed
    // if (tableName !== selectedTable) {
       onSelectTable(tableName);
    // }
  };


  /**
   * Renders the sidebar content (loading, error, empty, or table list).
   */
  const renderSidebarContent = () => {
    // Show main loading spinner only on initial load or full refresh
    if (loading && tables.length === 0) {
      return <div style={{ padding: '20px', textAlign: 'center' }}><Spin tip="Loading tables..." /></div>;
    }
    // Show error if fetching failed
    if (error) {
      // Offer a retry button
       return <div style={{ padding: '10px' }}>
                <Alert
                    message={error}
                    type="error"
                    showIcon
                    action={
                        <Button size="small" type="link" onClick={() => fetchUserTables()}>
                           Retry
                        </Button>
                     }
                />
             </div>;
    }
    // Show empty state if not loading/error and no tables
    if (!loading && tables.length === 0) {
       return <div style={{ padding: '20px', textAlign: 'center' }}>
                <Empty description="No tables found" />
                <Button type="link" onClick={showAddTableModal} style={{marginTop: '10px'}}>Create your first table</Button>
             </div>;
    }

    // --- Create Dropdown Menu Overlay ---
    const createTableActionMenu = (tableName: string) => (
        <Menu onClick={({ key }) => { /* Can handle here if needed, but item onClick is used */ }}>
            <Menu.SubMenu key="create-view" title="Create View" icon={<PlusOutlined />}>
                <Menu.Item
                    key="view-grid"
                    icon={<TableOutlined />}
                    onClick={(e) => { e.domEvent.stopPropagation(); handleCreateView(tableName, 'grid'); }} // Stop propagation
                >
                    Grid View
                </Menu.Item>
                <Menu.Item
                    key="view-gallery"
                    icon={<AppstoreOutlined />}
                    onClick={(e) => { e.domEvent.stopPropagation(); handleCreateView(tableName, 'gallery'); }} // Stop propagation
                >
                    Gallery View
                </Menu.Item>
            </Menu.SubMenu>
            <Menu.Divider />
            <Menu.Item
                key="delete-table"
                danger
                icon={<DeleteOutlined />}
                onClick={(e) => { e.domEvent.stopPropagation(); handleDeleteTable(tableName); }} // Stop propagation
            >
                Delete Table
            </Menu.Item>
        </Menu>
    );

    // --- Render Main Menu List ---
    return (
       <Menu
         theme="light"
         mode="inline"
         // Set selected keys based on the prop
         selectedKeys={selectedTable ? [selectedTable] : []}
         // Selection is handled by onClick within the rendered div now
         style={{ height: '100%', borderRight: 0, overflowY: 'auto', padding: '5px 0' }}
       >
         {tables.map(table => (
           <Menu.Item key={table} style={{ padding: 0, height: 'auto', lineHeight: 'normal' }}>
              <div
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    // Adjust padding for better alignment with icon button
                    padding: '8px 10px 8px 24px'
                }}
                onClick={() => handleSelectTable(table)} // Select on clicking the main area
                title={table} // Tooltip for long names
              >
                <span style={{ flexGrow: 1, cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: '5px' }}>
                    {table}
                </span>
                {/* Dropdown Action Menu */}
                <Dropdown
                    overlay={createTableActionMenu(table)}
                    trigger={['click']}
                    placement="bottomRight"
                >
                    {/* Stop propagation is crucial here */}
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
  };


  // --- Component JSX Structure ---
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', borderRight: '1px solid #f0f0f0' /* Add border */ }}>
        {/* Header Area */}
        <div style={{ padding: '10px 16px', borderBottom: '1px solid #f0f0f0', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <strong>Tables</strong>
             {/* Show spinner next to title only when actively fetching */}
            {loading && <Spin size="small" />}
        </div>

        {/* Main Content Area (Scrollable Menu/Loading/Error/Empty) */}
        <div style={{ flexGrow: 1, overflowY: 'auto', overflowX: 'hidden' }}>
            {renderSidebarContent()}
        </div>

        {/* Footer Area (Add Table Button) */}
        <div style={{ padding: '8px', borderTop: '1px solid #f0f0f0', flexShrink: 0 }}>
            <Button
                type="primary"
                icon={<PlusOutlined />}
                block
                onClick={showAddTableModal}
                disabled={loading} // Disable button only during fetch/delete operations
            >
                Add Table
            </Button>
        </div>

        {/* Modal Dialog for Adding a New Table */}
        {isAddModalVisible && (
            <Modal
                title="Create New Table"
                visible={isAddModalVisible}
                onOk={handleAddTableOk}
                confirmLoading={confirmLoadingAdd}
                onCancel={handleAddTableCancel}
                okText="Create"
                destroyOnClose
                maskClosable={!confirmLoadingAdd}
            >
                {/* Keep existing Add Table Form */}
                <p style={{ marginBottom: '15px', fontSize: '13px', color: '#666' }}>
                    Enter a unique name for your new table.
                    <br/>
                    <strong style={{color:'darkred'}}>Warning:</strong> Do not use reserved keywords.
                </p>
                <Form form={addTableForm} layout="vertical" name="add_table_form">
                    <Form.Item
                        name="tableName"
                        label="New Table Name"
                        rules={[
                            { required: true, message: 'Please enter a table name!' },
                            { whitespace: true, message: 'Table name cannot be just spaces!' },
                            { pattern: /^[a-zA-Z_][a-zA-Z0-9_]*$/, message: 'Invalid format (letters, numbers, underscores, start with letter or underscore)' },
                            { max: 63, message: 'Table name is too long (max 63 characters)' }
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