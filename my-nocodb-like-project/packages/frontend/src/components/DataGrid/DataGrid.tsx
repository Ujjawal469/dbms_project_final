import React, { useState, useEffect, useMemo } from 'react';
import {
  Table, Spin, Alert, Empty, Pagination, Button, Input, Space, message, Modal, Form, Select, InputNumber, DatePicker, Checkbox
} from 'antd';
import { ColumnsType } from 'antd/es/table';
import * as api from '../../api'; 
import { ApiColumnSchema, NewColumnPayload } from '../../api/types';

const { confirm } = Modal;
const { Option } = Select;

interface DataGridProps {
  tableName: string | null;
}

type EditingRowData = Record<string, any> | null;

// List of supported column types for the "Add Column" dropdown
// Customize this list based on your actual backend database support
const SUPPORTED_COLUMN_TYPES = [
    'TEXT', 'VARCHAR',
    'INTEGER', 'INT', 'BIGINT', 
    'NUMERIC', 'DECIMAL', 'FLOAT', 'REAL', 'DOUBLE PRECISION',
    'BOOLEAN', 'BOOL',
    'DATE', 'TIMESTAMP', 'TIMESTAMP WITH TIME ZONE'
    // Add others as needed (e.g., JSON, JSONB, UUID)
];


// --- Component Definition ---
const DataGrid: React.FC<DataGridProps> = ({ tableName }) => {
  // --- Core State ---
  const [schema, setSchema] = useState<ApiColumnSchema[]>([]);
  const [data, setData] = useState<any[]>([]);
  const [totalRows, setTotalRows] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(20); // Default page size
  const [loadingSchema, setLoadingSchema] = useState<boolean>(false);
  const [loadingData, setLoadingData] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [primaryKeyName, setPrimaryKeyName] = useState<string | null>(null);

  // --- Editing State ---
  const [editingKey, setEditingKey] = useState<string>(''); // Unique key (usually PK string) of the row being edited
  const [editingRowData, setEditingRowData] = useState<EditingRowData>(null); // Data copy for editing inputs

  // --- Add Row State ---
  const [isAddModalVisible, setIsAddModalVisible] = useState<boolean>(false);
  const [addForm] = Form.useForm(); // Form instance for Add Row modal
  const [confirmLoadingAdd, setConfirmLoadingAdd] = useState<boolean>(false);

  // --- Add Column State ---
  const [isAddColModalVisible, setIsAddColModalVisible] = useState<boolean>(false);
  const [addColForm] = Form.useForm(); // Form instance for Add Column modal
  const [confirmLoadingAddCol, setConfirmLoadingAddCol] = useState<boolean>(false);


  // --- Effect for Fetching Schema ---
  useEffect(() => {
    // Reset state when table name changes or becomes null
    if (!tableName) {
      setSchema([]);
      setData([]);
      setError(null);
      setPrimaryKeyName(null);
      setEditingKey('');
      setEditingRowData(null);
      setIsAddModalVisible(false);
      setIsAddColModalVisible(false);
      addForm.resetFields();
      addColForm.resetFields();
      setCurrentPage(1); // Reset page when table changes
      setTotalRows(0);
      return;
    }

    // Start loading schema
    setLoadingSchema(true);
    setError(null); // Clear previous errors
    setSchema([]);
    setData([]);
    setCurrentPage(1); // Reset page for new table
    setPrimaryKeyName(null);
    setEditingKey('');
    setEditingRowData(null);
    setIsAddModalVisible(false);
    setIsAddColModalVisible(false);
    addForm.resetFields();
    addColForm.resetFields();

    console.log(`Fetching schema for: ${tableName}`);
    api.fetchSchema(tableName)
      .then((fetchedSchema) => {
        console.log("Schema fetched:", fetchedSchema);
        if (!Array.isArray(fetchedSchema)) {
             throw new Error("Invalid schema format received.");
        }
        setSchema(fetchedSchema);
        const pk = fetchedSchema.find((col) => col.isPrimaryKey);
        setPrimaryKeyName(pk ? pk.name : null);
        if (!pk) {
            console.warn(`Table "${tableName}" does not appear to have a primary key defined in the fetched schema. Edit/Delete/Add functionality might be limited.`);
            // You might want to set an error or disable certain features if no PK
            // setError(`Schema for "${tableName}" is missing primary key information.`);
        }
      })
      .catch((err) => {
        console.error(`Schema fetch error for ${tableName}:`, err);
        setError(`Failed to load schema for "${tableName}": ${err.message}`);
        setPrimaryKeyName(null); // Ensure PK is null on error
        setSchema([]); // Ensure schema is empty on error
      })
      .finally(() => setLoadingSchema(false));
  // Add form instances to dependencies to satisfy linting, though their reset is handled above
  }, [tableName, addForm, addColForm]);


  // --- Effect for Fetching Data ---
  useEffect(() => {
    // Conditions to prevent fetching data unnecessarily
    if (!tableName || loadingSchema || (!loadingSchema && schema.length === 0)) {
        // If schema loading finished but schema is empty (likely due to an error handled above),
        // ensure data is also empty.
        if (!loadingSchema && schema.length === 0) {
             setData([]);
             setTotalRows(0);
        }
        return;
    };

    setLoadingData(true);
    console.log(`Fetching data for: ${tableName}, Page: ${currentPage}, Size: ${pageSize}`);
    api.fetchData(tableName, currentPage, pageSize)
      .then((response) => {
        console.log("Data fetched:", response);
        if (!response || !Array.isArray(response.data) || typeof response.total !== 'number') {
            throw new Error("Invalid data format received from server.");
        }
        // Generate unique keys for React list rendering
        const processedData = response.data.map((row, index) => {
          const key = primaryKeyName && row[primaryKeyName] !== undefined && row[primaryKeyName] !== null
            ? `${tableName}-pk-${row[primaryKeyName]}` // More robust key using PK
            : `row-${tableName}-${currentPage}-${index}`; // Fallback key
          return { ...row, key };
        });
        setData(processedData);
        setTotalRows(response.total);
        // Clear previous data fetching errors if successful now
        if (error && error.startsWith("Failed to load data")) setError(null);
      })
      .catch((err) => {
        console.error(`Data fetch error for ${tableName}:`, err);
        setError(`Failed to load data for "${tableName}": ${err.message}`);
        setData([]); // Clear data on error
        setTotalRows(0);
      })
      .finally(() => setLoadingData(false));
  // Re-fetch when table, pagination, or schema (which determines PK for keys) changes
  }, [tableName, currentPage, pageSize, loadingSchema, primaryKeyName, schema]);


  // --- Helper Function: Render Appropriate Form Input Based on Schema Type ---
  const renderFormInput = (col: ApiColumnSchema) => {
    // Define lowercase type sets for case-insensitive matching
    const numericTypesLC = ['numeric', 'integer', 'int', 'bigint', 'float', 'double', 'decimal', 'real', 'serial', 'bigserial'];
    const dateTypesLC = ['date', 'timestamp', 'datetime', 'timestamptz'];
    const booleanTypesLC = ['boolean', 'bool'];
    const colTypeLC = col.type.toLowerCase().split('(')[0]; // Get base type like 'numeric' from 'numeric(10,2)'

    if (numericTypesLC.includes(colTypeLC)) {
      return <InputNumber style={{ width: '100%' }} placeholder={`Enter number`} />;
    } else if (dateTypesLC.includes(colTypeLC)) {
      const showTime = colTypeLC.includes('timestamp') || colTypeLC.includes('datetime');
      return <DatePicker style={{ width: '100%' }} showTime={showTime} placeholder={`Select date${showTime ? '/time' : ''}`} />;
    } else if (booleanTypesLC.includes(colTypeLC)) {
      return <Select style={{ width: '100%'}} placeholder="Select True/False/Null" allowClear>
                <Option value={true}>True</Option>
                <Option value={false}>False</Option>
             </Select>;
    }
    // Add logic here for a Select dropdown if col.isForeignKey and you have fetched related data
    // else if (col.isForeignKey) { ... return <Select>...</Select> ... }
    else {
      // Default to text input for TEXT, VARCHAR, etc.
      return <Input placeholder={`Enter text`} />;
    }
  };


  // --- Helper Function: Prepare Payload with Type Conversion ---
  // Takes form values (or editingRowData), the relevant schema, flags, and PK name
  const preparePayload = (
    inputValues: Record<string, any>,
    schemaRef: ApiColumnSchema[],
    isInsert: boolean = false,
    pkName: string | null
): Record<string, any> | null => {
    const payload: Record<string, any> = {};
    let parsingError = false;
    let errors: string[] = []; // Collect specific errors

    schemaRef.forEach(col => {
        // --- Primary Key Handling ---
        if (col.isPrimaryKey) {
            // For INSERT: Only include PK if it exists in inputValues (meaning it's user-provided, not auto-gen)
            if (isInsert && inputValues.hasOwnProperty(col.name)) {
                // Continue to common processing below...
            }
            // For UPDATE: Never include PK in the payload body (it's in the URL)
            else if (!isInsert) {
                 return; // Skip PK for update payload
            }
            // For INSERT with auto-gen PK: Skip if not in inputValues
            else if (isInsert && !inputValues.hasOwnProperty(col.name)) {
                 return; // Skip auto-gen PK for insert payload
            }
        }

        // --- Process non-PK columns, or user-provided PK for INSERT ---
        // Check if the input object actually has a value for this column
        if (inputValues.hasOwnProperty(col.name)) {
            const rawValue = inputValues[col.name];
            const colTypeLC = col.type.toLowerCase().split('(')[0];
            const numericTypesLC = ['numeric', 'integer', 'int', 'bigint', 'float', 'double', 'decimal', 'real', 'serial', 'bigserial'];
            const dateTypesLC = ['date', 'timestamp', 'datetime', 'timestamptz'];
            const booleanTypesLC = ['boolean', 'bool'];

            // Handle NULL assignment based on nullability and input value
            if (rawValue === '' || rawValue === null || rawValue === undefined) {
                if (!col.isNullable) {
                    errors.push(`Column "${col.name}" cannot be empty.`);
                    parsingError = true;
                } else {
                    payload[col.name] = null; // Set explicitly to null if allowed
                }
            }
            // Process non-null values based on type
            else if (numericTypesLC.includes(colTypeLC)) {
                const numValue = typeof rawValue === 'number' ? rawValue : parseFloat(String(rawValue));
                if (isNaN(numValue)) {
                    errors.push(`Invalid number format for "${col.name}": ${rawValue}`);
                    parsingError = true;
                } else {
                    // TODO: Add precision/scale validation here if needed, comparing against col.type string
                    payload[col.name] = numValue;
                }
            } else if (dateTypesLC.includes(colTypeLC)) {
                 // Assuming Antd DatePicker value is a moment object or compatible
                 if (typeof rawValue.toISOString !== 'function') { // Basic check
                     errors.push(`Invalid date format for "${col.name}"`);
                     parsingError = true;
                 } else {
                    payload[col.name] = rawValue.toISOString(); // Convert moment/Date to ISO string
                 }
            } else if (booleanTypesLC.includes(colTypeLC)) {
                payload[col.name] = Boolean(rawValue); // Convert to boolean
            } else { // Assume text/varchar etc.
                 // Add length checks here if schema provides max length
                payload[col.name] = String(rawValue); // Ensure it's a string
            }
        }
        // If inputValues doesn't have the key, it means it wasn't in the form/data provided.
        // For UPDATE, this means the field wasn't changed.
        // For INSERT, this might mean it should be DEFAULT or NULL if nullable (handle based on DB).
        // The current logic only includes fields present in inputValues.
    });

    if (parsingError) {
        message.error(`Please fix validation errors: ${errors.join(', ')}`);
        console.error("Payload parsing failed.", errors, payload);
        return null; // Indicate failure
    }
    console.log("Prepared Payload:", payload);
    return payload;
};


 // --- Add Row Handlers ---
 const showAddModal = () => {
    addForm.resetFields(); // Clear previous form data
    setIsAddModalVisible(true);
 };

 const handleAddOk = async () => {
    if (!tableName) return;
    try {
        setConfirmLoadingAdd(true);
        const values = await addForm.validateFields(); // Validate form first

        // Prepare payload using the helper, indicating it's an INSERT
        const payload = preparePayload(values, schema, true, primaryKeyName);

        if (!payload) { // Payload preparation failed (error message already shown)
            setConfirmLoadingAdd(false);
            return;
        }

        console.log("📦 Sending Create Payload:", payload);
        await api.createRecord(tableName, payload); // Call API

        message.success('Record added successfully!');
        setIsAddModalVisible(false);

        // Refetch data (Fetch page 1 to likely see the new record)
        setCurrentPage(prev => { // Use functional update if refetch depends on current page
            const targetPage = 1; // Go to page 1 after adding
            setLoadingData(true);
            api.fetchData(tableName, targetPage, pageSize)
                .then(response => {
                    const processedData = response.data.map((row, index) => ({
                        ...row,
                        key: primaryKeyName && row[primaryKeyName] !== undefined ? `${tableName}-pk-${row[primaryKeyName]}` : `row-${tableName}-${targetPage}-${index}`,
                    }));
                    setData(processedData);
                    setTotalRows(response.total);
                    setError(null); // Clear previous fetch errors
                })
                .catch(err => setError(`Refetch failed after add: ${err.message}`))
                .finally(() => setLoadingData(false));
            return targetPage; // Return the new page number for the state setter
        });

    } catch (errorInfo: any) {
        console.error('Add Row Failed:', errorInfo);
        const errorMsg = errorInfo?.response?.data?.message || (errorInfo instanceof Error ? errorInfo.message : null) || 'Unknown error';
        if (errorInfo.errorFields) {
            message.error('Validation failed. Please check form fields.');
        } else {
            message.error(`Failed to add record: ${errorMsg}`);
        }
    } finally {
        setConfirmLoadingAdd(false);
    }
 };

 const handleAddCancel = () => {
    setIsAddModalVisible(false);
 };

 // --- Edit Handlers ---
 const isEditing = (record: any) => record.key === editingKey;

 const handleEdit = (record: any) => {
    console.log("Editing record:", record);
    // Initialize editingRowData with existing values
    // Potentially pre-process values here if needed for form components (e.g., dates to moment objects)
    setEditingRowData({ ...record });
    setEditingKey(record.key);
 };

 const handleCancel = () => {
    setEditingKey('');
    setEditingRowData(null);
 };

 const handleSave = async () => {
    if (!tableName || !primaryKeyName || !editingRowData) return;

    const keyToSave = editingKey;
    const pkValue = editingRowData[primaryKeyName];

    // Extract only the data fields (excluding the React key)
    const dataToSave = { ...editingRowData };
    delete dataToSave.key;

    // Prepare payload using the helper, indicating it's NOT an insert
    const payload = preparePayload(dataToSave, schema, false, primaryKeyName);

    if (!payload) { // Payload preparation failed
        return;
    }

    // Don't proceed if payload is empty (no changes made - though maybe allow saving anyway?)
    if (Object.keys(payload).length === 0) {
        message.info("No changes detected to save.");
        handleCancel(); // Exit editing mode
        return;
    }

    try {
        setLoadingData(true); // Show loading indicator on the grid
        console.log("📦 Sending Update Payload:", payload);
        await api.updateRecord(tableName, pkValue, payload);

        // Update local data state more reliably after save
        setData((prevData) => {
            const indexToUpdate = prevData.findIndex(item => item.key === keyToSave);
            if (indexToUpdate === -1) return prevData; // Should not happen
            const newData = [...prevData];
            // Merge the original row data with the *successfully saved* (and parsed) payload data
            newData[indexToUpdate] = { ...newData[indexToUpdate], ...payload, key: keyToSave };
            return newData;
        });

        setEditingKey('');
        setEditingRowData(null);
        message.success('Record updated successfully!');

    } catch (err: any) {
        console.error('Update Row Failed:', err);
        const errorMsg = err.response?.data?.message || err.message || 'Unknown error';
        setError(`Failed to update record: ${errorMsg}`);
        message.error(`Failed to update record: ${errorMsg}`);
        // Keep editing state active on error
    } finally {
        setLoadingData(false);
    }
 };

 // Update temporary editingRowData state when an inline input changes
 const handleEditingInputChange = (
    value: any, // Value can be string, number, moment object, boolean etc.
    dataIndex: string
 ) => {
    if (!editingRowData) return;
    console.log(`Input change: ${dataIndex} =`, value);
    setEditingRowData(prev => ({ ...prev, [dataIndex]: value }));
 };


 // --- Delete Handler ---
 const handleDelete = (primaryKeyValue: string | number) => {
    if (!tableName || !primaryKeyName) return;
    const displayValue = String(primaryKeyValue);

    confirm({
        title: 'Are you sure delete this record?',
        content: `Record with ${primaryKeyName}=${displayValue} will be permanently deleted.`,
        okText: 'Yes, Delete',
        okType: 'danger',
        cancelText: 'No',
        maskClosable: false,
        onOk: async () => {
            try {
                setLoadingData(true); // Show loading indicator
                await api.deleteRecord(tableName, primaryKeyValue);
                message.success('Record deleted successfully!');
                if (editingKey === `${tableName}-pk-${primaryKeyValue}`) { // Reset editing if deleted row was being edited
                    handleCancel();
                }
                // Refetch data to get accurate total and current page contents
                setError(null);
                 // Refetch logic (similar to add/update success) - fetch current or page 1?
                 // Fetching current page might lead to empty page if last item deleted. Fetch page 1?
                 const pageToFetch = (data.length === 1 && currentPage > 1) ? currentPage - 1 : currentPage; // Go back a page if deleting last item
                 if(pageToFetch !== currentPage) setCurrentPage(pageToFetch);

                 api.fetchData(tableName, pageToFetch, pageSize)
                    .then(response => { /* ... update data and totalRows ... */
                        const processedData = response.data.map((row, index) => ({/*...generate keys...*/
                            ...row,
                            key: primaryKeyName && row[primaryKeyName] !== undefined ? `${tableName}-pk-${row[primaryKeyName]}` : `row-${tableName}-${pageToFetch}-${index}`
                        }));
                        setData(processedData);
                        setTotalRows(response.total);
                    })
                    .catch(err => setError(`Refetch failed after delete: ${err.message}`));


            } catch (err: any) {
                console.error('Delete Row Failed:', err);
                const errorMsg = err.response?.data?.message || err.message || 'Unknown error';
                setError(`Failed to delete record: ${errorMsg}`);
                message.error(`Failed to delete record: ${errorMsg}`);
            } finally {
                setLoadingData(false);
            }
        },
    });
 };


 // --- Add Column Handlers ---
 const showAddColModal = () => {
    addColForm.resetFields();
    setIsAddColModalVisible(true);
 };

 const handleAddColOk = async () => {
    if (!tableName) return;
    try {
        setConfirmLoadingAddCol(true);
        const values = await addColForm.validateFields();

        // Use the defined interface for type safety
        const payload: NewColumnPayload = {
            name: values.columnName.trim(), // Trim whitespace
            type: values.columnType,
            // Add optional fields from form if they exist
            // isNullable: values.isNullable ?? true, // Default to nullable if checkbox not added
            // defaultValue: values.defaultValue || null,
        };

        console.log("📦 Sending Create Column Payload:", payload);
        await api.createColumn(tableName, payload);

        message.success(`Column "${payload.name}" added successfully! Refreshing schema...`);
        setIsAddColModalVisible(false);

        // --- Refresh Schema and Data ---
        setLoadingSchema(true); // Indicate schema reload
        api.fetchSchema(tableName)
            .then(fetchedSchema => {
                setSchema(fetchedSchema); // Update schema state
                const pk = fetchedSchema.find(col => col.isPrimaryKey);
                setPrimaryKeyName(pk ? pk.name : null);
                // Data refetch is needed as table structure changed
                setCurrentPage(1); // Go back to page 1
                setLoadingData(true);
                return api.fetchData(tableName, 1, pageSize); // Return promise
            })
            .then(response => { // Chain the data fetch
                const processedData = response.data.map((row, index) => ({/*...generate keys...*/
                    ...row,
                    key: primaryKeyName && row[primaryKeyName] !== undefined ? `${tableName}-pk-${row[primaryKeyName]}` : `row-${tableName}-1-${index}`
                }));
                setData(processedData);
                setTotalRows(response.total);
                setError(null); // Clear previous errors
            })
            .catch(err => {
                console.error("Error during schema/data refresh after add column:", err);
                setError(`Schema/data refresh failed after adding column: ${err.message}`);
            })
            .finally(() => {
                setLoadingSchema(false);
                setLoadingData(false);
            });
        // --- END Refresh ---

    } catch (errorInfo: any) {
        console.error('Add Column Failed:', errorInfo);
        const errorMsg = errorInfo?.response?.data?.message || (errorInfo instanceof Error ? errorInfo.message : null) || 'Unknown error';
        if (errorInfo.errorFields) {
            message.error('Validation failed. Please check column details.');
        } else {
            message.error(`Failed to add column: ${errorMsg}`);
        }
    } finally {
        setConfirmLoadingAddCol(false);
    }
 };

 const handleAddColCancel = () => {
    setIsAddColModalVisible(false);
 };


 // --- Build Table Columns Dynamically ---
 const columns = useMemo((): ColumnsType<any> => {
    if (!schema || schema.length === 0) return [];

    // Map schema to Ant Design Table columns
    const generatedCols: ColumnsType<any> = schema.map((col) => {
        // Determine if the column should be editable in inline mode
        const editable = !col.isPrimaryKey && !col.isForeignKey; // Prevent editing PKs and FKs inline

        return {
            title: col.name,
            dataIndex: col.name,
            key: col.name, // Use column name as key for the column definition
            ellipsis: !isEditing({ key: editingKey }), // Ellipsis only when not editing
            // Enable sorting UI (backend needs to handle it for server-side sorting)
            // sorter: true, // For client-side: (a, b) => handleSort(a[col.name], b[col.name], col.type)
            width: 150, // Default width, adjust as needed or make dynamic
            render: (text: any, record: any) => {
                const editing = isEditing(record);

                if (editing && editable) {
                    // Render the appropriate input using the helper
                    const InputComponent = renderFormInput(col);
                    // Clone to control value and onChange specifically for inline editing
                    return React.cloneElement(InputComponent, {
                        // Use value from the temporary editingRowData state
                        value: editingRowData ? editingRowData[col.name] : undefined,
                        onChange: (eOrValue: any) => {
                            // Handle Antd component variations in onChange signature
                            const value = eOrValue?.target?.value ?? eOrValue?.target?.checked ?? eOrValue;
                            handleEditingInputChange(value, col.name);
                        },
                        // Optionally add auto-save on Enter for Inputs
                        onPressEnter: handleSave, // Works for Input, InputNumber
                        // onBlur: handleSave, // Careful with onBlur, might trigger too often
                        style: { ...InputComponent.props.style, width: 'calc(100% - 10px)'} // Ensure inputs fit
                    });
                } else {
                    // Render display text - format based on type if needed
                    const colTypeLC = col.type.toLowerCase().split('(')[0];
                    const dateTypesLC = ['date', 'timestamp', 'datetime', 'timestamptz'];
                    const booleanTypesLC = ['boolean', 'bool'];

                    if (text === null || text === undefined) {
                        return <i style={{ color: '#ccc' }}>NULL</i>;
                    } else if (booleanTypesLC.includes(colTypeLC)) {
                        return String(text); // Display 'true' or 'false'
                    } else if (dateTypesLC.includes(colTypeLC)) {
                        // Basic date formatting, consider using moment or Intl.DateTimeFormat for better results
                        try {
                            return new Date(text).toLocaleString();
                        } catch (e) {
                            return String(text); // Fallback if parsing fails
                        }
                    }
                    return String(text); // Default string conversion
                }
            },
        };
    });

    // Add "Actions" column if a primary key is identified
    if (primaryKeyName) {
        generatedCols.push({
            title: 'Actions',
            key: 'actions',
            width: 120,
            fixed: 'right', // Keep actions visible
            render: (_, record) => {
                const editing = isEditing(record);
                return (
                    <Space size="small">
                        {editing ? (
                            <>
                                <Button type="primary" onClick={handleSave} size="small" loading={loadingData && editingKey === record.key}> {/* Show loading on save button */}
                                    Save
                                </Button>
                                <Button onClick={handleCancel} size="small" disabled={loadingData}>
                                    Cancel
                                </Button>
                            </>
                        ) : (
                            <>
                                <Button
                                    type="link"
                                    size="small"
                                    disabled={editingKey !== '' || loadingData}
                                    onClick={() => handleEdit(record)}
                                >
                                    Edit
                                </Button>
                                <Button
                                    type="link"
                                    size="small"
                                    danger
                                    disabled={editingKey !== '' || loadingData}
                                    onClick={() => handleDelete(record[primaryKeyName])}
                                >
                                    Delete
                                </Button>
                            </>
                        )}
                    </Space>
                );
            },
        });
    }

    return generatedCols;
 // Dependencies that trigger column regeneration
 }, [schema, primaryKeyName, editingKey, editingRowData, loadingData, currentPage, pageSize]); // Added pagination, loadingData


 // --- Component Render ---
 if (!tableName && !error && !loadingSchema) { // Check loadingSchema too
    return <Empty description="Select a table from the sidebar" style={{ marginTop: 50 }} />;
 }

 return (
    <div style={{ padding: '15px', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <h2 style={{ marginBottom: '10px', flexShrink: 0 }}>
         {tableName ? `Table: ${tableName}` : 'Select a Table'}
         {loadingSchema && <Spin size="small" style={{ marginLeft: '10px' }} />}
      </h2>

      {/* Display Errors */}
      {error && (
         <Alert
            message={error} // Display the specific error message
            type={schema.length === 0 ? "error" : "warning"} // Error if schema failed, warning otherwise
            showIcon
            closable
            onClose={() => setError(null)}
            style={{ marginBottom: '10px', flexShrink: 0 }}
         />
      )}

      {/* Toolbar Area */}
      <div style={{ marginBottom: '10px', flexShrink: 0 }}>
         <Space>
            <Button
               type="primary"
               onClick={showAddModal}
               disabled={!tableName || !schema.length || loadingSchema || loadingData || editingKey !== ''}
            >
               Add Row
            </Button>
            <Button
               onClick={showAddColModal}
               disabled={!tableName || !schema.length || loadingSchema || loadingData || editingKey !== ''}
            >
               Add Column
            </Button>
            {/* Placeholder for Filter/Sort/Group */}
         </Space>
      </div>

       {/* Table Area - Make it grow */}
       <div style={{ flexGrow: 1, overflow: 'hidden', border: '1px solid #f0f0f0' }}>
         <Spin spinning={loadingData && !error} tip="Loading data..."> {/* Show spinner overlay only when loading and no error */}
            <Table
               columns={columns}
               dataSource={loadingSchema ? [] : data} // Show empty data source while schema loads
               rowKey="key"
               pagination={false}
               scroll={{ x: 'max-content', y: 'calc(100vh - 280px)' }} // Adjust Y dynamically - may need fine-tuning
               size="small"
               bordered
               locale={{ emptyText: (loadingSchema || loadingData) ? <Spin size="small"/> : <Empty description="No data found" /> }}
               // Add sorter state handling here eventually
               // onChange={handleTableChange} // For pagination, filters, sorters
            />
         </Spin>
       </div>

      {/* Pagination Area */}
      <div style={{ marginTop: '16px', textAlign: 'right', flexShrink: 0 }}>
         {totalRows > 0 && !loadingSchema && (
            <Pagination
               current={currentPage}
               pageSize={pageSize}
               total={totalRows}
               onChange={(page, size) => {
                  if (editingKey) {
                     message.warning('Please save or cancel the current edit first.');
                     return;
                  }
                  setCurrentPage(page);
                  if (size && size !== pageSize) {
                     setPageSize(size);
                     if (currentPage !== 1) setCurrentPage(1); // Go to page 1 on size change
                  }
               }}
               showSizeChanger
               showQuickJumper
               pageSizeOptions={['10', '20', '50', '100']}
               showTotal={(total, range) => `${range[0]}-${range[1]} of ${total} items`}
               disabled={loadingData || editingKey !== ''}
            />
         )}
      </div>

      {/* --- Modals --- */}
      {/* Add Row Modal */}
      {isAddModalVisible && ( // Conditionally render modal to ensure form gets schema
          <Modal
            title={`Add New Row to ${tableName}`}
            visible={isAddModalVisible}
            onOk={handleAddOk}
            confirmLoading={confirmLoadingAdd}
            onCancel={handleAddCancel}
            okText="Add Row"
            destroyOnClose
            maskClosable={false}
            width={600} // Adjust width as needed
          >
            <Form form={addForm} layout="vertical" name="add_row_form">
              {schema
                .filter(col => !(col.isPrimaryKey && (col.isAutoGenerated || ['serial', 'bigserial'].includes(col.type.toLowerCase())))) // Filter auto-gen PKs
                .map(col => (
                  <Form.Item
                    key={`add-${col.name}`}
                    name={col.name}
                    label={`${col.name} (${col.type})`} // Show type
                    rules={[{ required: !col.isNullable, message: `${col.name} is required` }]}
                  >
                    {renderFormInput(col)}
                  </Form.Item>
                ))}
            </Form>
          </Modal>
      )}

      {/* Add Column Modal */}
       {isAddColModalVisible && (
           <Modal
              title={`Add New Column to ${tableName}`}
              visible={isAddColModalVisible}
              onOk={handleAddColOk}
              confirmLoading={confirmLoadingAddCol}
              onCancel={handleAddColCancel}
              okText="Add Column"
              destroyOnClose
              maskClosable={false}
           >
              <Form form={addColForm} layout="vertical" name="add_column_form">
                  <Form.Item
                      name="columnName"
                      label="Column Name"
                      rules={[
                          { required: true, message: 'Column name is required' },
                          { pattern: /^[a-zA-Z_][a-zA-Z0-9_]*$/, message: 'Invalid column name format (letters, numbers, underscores, must start with letter or underscore)' }
                      ]}
                  >
                      <Input placeholder="e.g., email or user_status"/>
                  </Form.Item>
                  <Form.Item
                      name="columnType"
                      label="Column Type"
                      rules={[{ required: true, message: 'Column type is required' }]}
                  >
                      <Select placeholder="Select data type">
                          {SUPPORTED_COLUMN_TYPES.map(type => (
                              <Option key={type} value={type}>{type}</Option>
                          ))}
                      </Select>
                  </Form.Item>
                  {/* Example for optional constraints: */}
                  {/* <Form.Item name="isNullable" label="Allow Null?" valuePropName="checked" initialValue={true}><Checkbox/></Form.Item> */}
                  {/* <Form.Item name="defaultValue" label="Default Value"><Input /></Form.Item> */}
              </Form>
           </Modal>
       )}

    </div> // End main div
  );
};

export default DataGrid;