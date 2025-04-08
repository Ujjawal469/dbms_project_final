// src/components/DataGrid/DataGrid.tsx

import React, { useState, useEffect, useMemo } from 'react';
import {
  Table, Spin, Alert, Empty, Pagination, Button, Input, Space, message, Modal, Form, Select, InputNumber, DatePicker, Checkbox // Added Checkbox
} from 'antd';
import { ColumnsType } from 'antd/es/table';
import * as api from '../../api';
import { ApiColumnSchema, NewColumnPayload } from '../../api/types';
// Optionally import moment if needed for DatePicker pre-processing/rendering
// import moment from 'moment';

const { confirm } = Modal;
const { Option } = Select;

interface DataGridProps {
  tableName: string | null;
}

type EditingRowData = Record<string, any> | null;

// Supported types for the Add Column modal dropdown
const SUPPORTED_COLUMN_TYPES = [
    'TEXT', 'VARCHAR',
    'INTEGER', 'INT', 'BIGINT',
    'NUMERIC', 'DECIMAL', 'FLOAT', 'REAL', 'DOUBLE PRECISION',
    'BOOLEAN', 'BOOL',
    'DATE', 'TIMESTAMP', 'TIMESTAMP WITH TIME ZONE'
];


// --- Component Definition ---
const DataGrid: React.FC<DataGridProps> = ({ tableName }) => {
  // --- Core State ---
  const [schema, setSchema] = useState<ApiColumnSchema[]>([]);
  const [data, setData] = useState<any[]>([]);
  const [totalRows, setTotalRows] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(20);
  const [loadingSchema, setLoadingSchema] = useState<boolean>(false);
  const [loadingData, setLoadingData] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  // Store the name of the actual primary key column (expected to be 'serial_num')
  const [primaryKeyName, setPrimaryKeyName] = useState<string | null>(null);

  // --- Editing State ---
  const [editingKey, setEditingKey] = useState<string>('');
  const [editingRowData, setEditingRowData] = useState<EditingRowData>(null);

  // --- Add Row State ---
  const [isAddModalVisible, setIsAddModalVisible] = useState<boolean>(false);
  const [addForm] = Form.useForm();
  const [confirmLoadingAdd, setConfirmLoadingAdd] = useState<boolean>(false);

  // --- Add Column State ---
  const [isAddColModalVisible, setIsAddColModalVisible] = useState<boolean>(false);
  const [addColForm] = Form.useForm();
  const [confirmLoadingAddCol, setConfirmLoadingAddCol] = useState<boolean>(false);


  // --- Effect for Fetching Schema ---
  useEffect(() => {
    // Reset state when table name changes or becomes null
    if (!tableName) {
      setSchema([]); setData([]); setError(null); setPrimaryKeyName(null);
      setEditingKey(''); setEditingRowData(null); setIsAddModalVisible(false);
      setIsAddColModalVisible(false); addForm.resetFields(); addColForm.resetFields();
      setCurrentPage(1); setTotalRows(0);
      return;
    }

    // Reset state for new table selection
    setLoadingSchema(true); setError(null); setSchema([]); setData([]);
    setCurrentPage(1); setPrimaryKeyName(null); setEditingKey('');
    setEditingRowData(null); setIsAddModalVisible(false); setIsAddColModalVisible(false);
    addForm.resetFields(); addColForm.resetFields();

    console.log(`Fetching schema for: ${tableName}`);
    api.fetchSchema(tableName)
      .then((fetchedSchema) => {
        console.log("Schema fetched:", fetchedSchema);
        if (!Array.isArray(fetchedSchema)) {
             throw new Error("Invalid schema format received.");
        }
        setSchema(fetchedSchema);
        // Find the primary key (expected to be 'serial_num' based on requirement)
        const pk = fetchedSchema.find((col) => col.isPrimaryKey);
        // ** Store the actual primary key name ('serial_num') for internal use (edit/delete/key) **
        setPrimaryKeyName(pk ? pk.name : null);
        if (!pk) {
            console.warn(`Table "${tableName}" has no primary key in schema. Edit/Delete may fail.`);
        } else if (pk.name !== 'serial_num') {
            // If PK is found but isn't 'serial_num', log a warning as our logic assumes it is
             console.warn(`Primary key for table "${tableName}" is "${pk.name}", not the expected "serial_num". Ensure backend handles this correctly.`);
        }
      })
      .catch((err) => {
        console.error(`Schema fetch error for ${tableName}:`, err);
        setError(`Failed to load schema for "${tableName}": ${err.message}`);
        setPrimaryKeyName(null); setSchema([]);
      })
      .finally(() => setLoadingSchema(false));
  }, [tableName, addForm, addColForm]);


  // --- Effect for Fetching Data ---
  useEffect(() => {
    // Prevent fetching if no table, schema is loading, or schema fetch failed
    if (!tableName || loadingSchema || (!loadingSchema && schema.length === 0)) {
        if (!loadingSchema && schema.length === 0 && !error) { // Only clear if no error yet
             setData([]);
             setTotalRows(0);
        }
        return;
    };

    setLoadingData(true);
    console.log(`Fetching data for: ${tableName}, Page: ${currentPage}, Size: ${pageSize}`);
    api.fetchData(tableName, currentPage, pageSize)
      .then((response) => {
        console.log("Data fetched (raw):", response); // Log raw response
        if (!response || !Array.isArray(response.data) || typeof response.total !== 'number') {
            throw new Error("Invalid data format received from server.");
        }

        // Generate unique React keys using the ACTUAL primary key ('serial_num') if available
        const processedData = response.data.map((row, index) => {
          // Use the stored primaryKeyName which should be 'serial_num'
          const pkValue = primaryKeyName ? row[primaryKeyName] : undefined;
          const key = pkValue !== undefined && pkValue !== null
            ? `${tableName}-pk-${pkValue}` // Key based on actual PK
            : `row-${tableName}-${currentPage}-${index}`; // Fallback key

          // *** IMPORTANT: We pass the full row data (including serial_num if present)
          // *** to the state. We filter it out visually in the `columns` generation.
          return { ...row, key };
        });
        console.log("Data processed for state:", processedData); // Log processed data
        setData(processedData);
        setTotalRows(response.total);
        // Clear data loading errors on success
        if (error?.startsWith("Failed to load data")) setError(null);
      })
      .catch((err) => {
        console.error(`Data fetch error for ${tableName}:`, err);
        setError(`Failed to load data for "${tableName}": ${err.message}`);
        setData([]); setTotalRows(0);
      })
      .finally(() => setLoadingData(false));
  // Re-fetch when table, pagination, or schema/PK info changes
  }, [tableName, currentPage, pageSize, loadingSchema, primaryKeyName, schema, error]); // Added error to dependency


  // --- Helper Function: Render Appropriate Form Input Based on Schema Type ---
  const renderFormInput = (col: ApiColumnSchema) => {
    // (This function remains the same as before)
    const numericTypesLC = ['numeric', 'integer', 'int', 'bigint', 'float', 'double', 'decimal', 'real', 'serial', 'bigserial'];
    const dateTypesLC = ['date', 'timestamp', 'datetime', 'timestamptz'];
    const booleanTypesLC = ['boolean', 'bool'];
    const colTypeLC = col.type.toLowerCase().split('(')[0];

    if (numericTypesLC.includes(colTypeLC)) {
      return <InputNumber style={{ width: '100%' }} placeholder={`Enter number`} />;
    } else if (dateTypesLC.includes(colTypeLC)) {
      const showTime = colTypeLC.includes('timestamp') || colTypeLC.includes('datetime');
      // Consider using `value` prop with moment(editingRowData[col.name]) if storing moment objects
      return <DatePicker style={{ width: '100%' }} showTime={showTime} placeholder={`Select date${showTime ? '/time' : ''}`} format={showTime ? "YYYY-MM-DD HH:mm:ss" : "YYYY-MM-DD"} />;
    } else if (booleanTypesLC.includes(colTypeLC)) {
      return <Select style={{ width: '100%'}} placeholder="Select True/False/Null" allowClear>
                <Option value={true}>True</Option>
                <Option value={false}>False</Option>
             </Select>;
    }
    else {
      return <Input placeholder={`Enter text`} />;
    }
  };


  // --- Helper Function: Prepare Payload with Type Conversion ---
  const preparePayload = (
    inputValues: Record<string, any>,
    schemaRef: ApiColumnSchema[],
    isInsert: boolean = false,
    pkName: string | null // pkName is 'serial_num'
): Record<string, any> | null => {
    const payload: Record<string, any> = {};
    let parsingError = false;
    let errors: string[] = [];

    schemaRef.forEach(col => {
        // --- Primary Key Handling ---
        // ** Always skip the primary key ('serial_num') from the payload **
        // For INSERT, the DB generates it.
        // For UPDATE, it's in the URL, not the body.
        if (col.isPrimaryKey || col.name === pkName) { // Explicitly skip PK by name too
            return;
        }

        // --- Process non-PK columns ---
        // (Rest of the logic remains the same: check hasOwnProperty, handle nulls, parse types)
        if (inputValues.hasOwnProperty(col.name)) {
            const rawValue = inputValues[col.name];
            const colTypeLC = col.type.toLowerCase().split('(')[0];
            const numericTypesLC = ['numeric', 'integer', 'int', 'bigint', 'float', 'double', 'decimal', 'real'];
            const dateTypesLC = ['date', 'timestamp', 'datetime', 'timestamptz'];
            const booleanTypesLC = ['boolean', 'bool'];

            if (rawValue === '' || rawValue === null || rawValue === undefined) {
                if (!col.isNullable) {
                    errors.push(`Column "${col.name}" cannot be empty.`);
                    parsingError = true;
                } else {
                    payload[col.name] = null;
                }
            }
            else if (numericTypesLC.includes(colTypeLC)) {
                const numValue = typeof rawValue === 'number' ? rawValue : parseFloat(String(rawValue));
                if (isNaN(numValue)) {
                    errors.push(`Invalid number format for "${col.name}": ${rawValue}`);
                    parsingError = true;
                } else { payload[col.name] = numValue; }
            } else if (dateTypesLC.includes(colTypeLC)) {
                // Expecting moment object from DatePicker
                if (rawValue && typeof rawValue.toISOString === 'function') {
                     payload[col.name] = rawValue.toISOString();
                } else if (rawValue instanceof Date) { // Handle if it's somehow a JS Date
                     payload[col.name] = rawValue.toISOString();
                } else if (typeof rawValue === 'string') { // Handle if already a string (e.g., from initial data)
                     // Basic validation - might need more robust check
                     try {
                         new Date(rawValue).toISOString(); // Check if parsable
                         payload[col.name] = rawValue;
                     } catch {
                         errors.push(`Invalid date string for "${col.name}": ${rawValue}`);
                         parsingError = true;
                     }
                }
                else {
                    errors.push(`Invalid date input for "${col.name}"`);
                    parsingError = true;
                }
            } else if (booleanTypesLC.includes(colTypeLC)) {
                 // Handle boolean conversion carefully from Select (true, false, null/undefined)
                 if (rawValue === true || rawValue === false) {
                      payload[col.name] = rawValue;
                 } else if (rawValue === null || rawValue === undefined) {
                      if (!col.isNullable) {
                           errors.push(`Boolean column "${col.name}" cannot be empty.`);
                           parsingError = true;
                      } else {
                           payload[col.name] = null;
                      }
                 } else { // Handle potential string "true"/"false" if needed, otherwise error
                      errors.push(`Invalid boolean value for "${col.name}": ${rawValue}`);
                      parsingError = true;
                 }

            } else { // Assume text/varchar etc.
                payload[col.name] = String(rawValue);
            }
        }
    });

    if (parsingError) {
        message.error(`Please fix validation errors: ${errors.join(', ')}`);
        console.error("Payload parsing failed.", errors, payload);
        return null;
    }
    console.log("Prepared Payload:", payload);
    return payload;
};


 // --- Add Row Handlers ---
 const showAddModal = () => {
    addForm.resetFields();
    setIsAddModalVisible(true);
 };

 const handleAddOk = async () => {
    if (!tableName) return;
    try {
        setConfirmLoadingAdd(true);
        const values = await addForm.validateFields();

        // Prepare payload, explicitly passing primaryKeyName ('serial_num')
        // The preparePayload function now knows to always ignore this PK
        const payload = preparePayload(values, schema, true, primaryKeyName);

        if (!payload) {
            setConfirmLoadingAdd(false); return;
        }

        console.log("📦 Sending Create Payload:", payload);
        // Call API (backend service ignores serial_num and lets DB generate it)
        await api.createRecord(tableName, payload);
        //await api.fetchData(tableName, currentPage, pageSize);
        message.success('Record added successfully!');
        setIsAddModalVisible(false);

        // Refetch data for the *first page* to likely see the new record
        // setCurrentPage(1); // Set state to trigger data refetch for page 1
        // Data refetch will happen in the useEffect hook for data fetching
        setLoadingData(true);
        setError(null); // Clear previous errors optimisticallly

        // 3. Call the API to fetch data for page 1
        api.fetchData(tableName, currentPage, pageSize) // Fetch page 1
            .then(response => {
                // (Same processing logic as in the useEffect)
                if (!response || !Array.isArray(response.data) || typeof response.total !== 'number') {
                    throw new Error("Invalid data format received after add.");
                }
                const processedData = response.data.map((row, index) => {
                    const pkValue = primaryKeyName ? row[primaryKeyName] : undefined;
                    const key = pkValue !== undefined && pkValue !== null
                        ? `${tableName}-pk-${pkValue}`
                        : `row-${tableName}-1-${index}`; // Use '1' for page number
                    return { ...row, key };
                });
                console.log("Data refetched after add:", processedData);
                setData(processedData);
                setTotalRows(response.total);
            })
            .catch(err => {
                // Handle refetch error specifically
                console.error(`Refetch failed after add for ${tableName}:`, err);
                setError(`Refetch failed after add: ${err.message}`);
                // Optionally clear data/total if refetch fails catastrophically
                // setData([]); setTotalRows(0);
            })
            .finally(() => {
                setLoadingData(false); // Stop loading indicator
            });

    } catch (errorInfo: any) {
        console.error('Add Row Failed:', errorInfo);
        const errorMsg = errorInfo?.response?.data?.message || (errorInfo instanceof Error ? errorInfo.message : null) || 'Unknown error';
        if (errorInfo.errorFields) { message.error('Validation failed.'); }
        else { message.error(`Failed to add record: ${errorMsg}`); }
    } finally {
        setConfirmLoadingAdd(false);
    }
 };

 const handleAddCancel = () => { setIsAddModalVisible(false); };

 // --- Edit Handlers ---
 const isEditing = (record: any) => record.key === editingKey;

 const handleEdit = (record: any) => {
    console.log("Editing record:", record);
    // Potentially convert date strings back to moment objects for DatePicker
    const initialEditData = { ...record };
     schema.forEach(col => {
         const dateTypesLC = ['date', 'timestamp', 'datetime', 'timestamptz'];
         const colTypeLC = col.type.toLowerCase().split('(')[0];
         if (dateTypesLC.includes(colTypeLC) && initialEditData[col.name]) {
             // Assuming moment is imported or available globally/via context
             // initialEditData[col.name] = moment(initialEditData[col.name]);
             // If not using moment, ensure DatePicker can handle ISO string directly
         }
     });
    setEditingRowData(initialEditData);
    setEditingKey(record.key);
 };

 const handleCancel = () => { setEditingKey(''); setEditingRowData(null); };

 const handleSave = async () => {
    // Need actual primaryKeyName and the value from the row being edited
    if (!tableName || !primaryKeyName || !editingRowData) return;

    const keyToSave = editingKey;
    // Get the ACTUAL primary key value from the data we stored for editing
    const pkValue = editingRowData[primaryKeyName];

    if (pkValue === undefined || pkValue === null) {
         message.error("Cannot save row: Primary key value is missing.");
         return;
    }

    // Use the current editing data (user changes)
    const dataToSave = { ...editingRowData };
    delete dataToSave.key; // Remove React key property

    // Prepare payload (will automatically exclude pkName based on the updated helper)
    const payload = preparePayload(dataToSave, schema, false, primaryKeyName);

    if (!payload) { return; } // Payload prep failed

    if (Object.keys(payload).length === 0) {
        message.info("No changes detected to save.");
        handleCancel(); return;
    }

    try {
        setLoadingData(true);
        console.log("📦 Sending Update Payload:", payload);
        await api.updateRecord(tableName, pkValue, payload); // Use actual pkValue

        // Update local state: Find the record by its React key and update its data
        setData((prevData) => {
            const index = prevData.findIndex(item => item.key === keyToSave);
            if (index === -1) return prevData;
            const newData = [...prevData];
            // Merge existing data with the successfully saved payload
            // Ensure the primary key and React key remain consistent
            newData[index] = { ...newData[index], ...payload, key: keyToSave };
            return newData;
        });

        setEditingKey(''); setEditingRowData(null);
        message.success('Record updated successfully!');

    } catch (err: any) {
        console.error('Update Row Failed:', err);
        const errorMsg = err.response?.data?.message || err.message || 'Unknown error';
        setError(`Failed to update record: ${errorMsg}`); // Show error in alert
        message.error(`Failed to update record: ${errorMsg}`);
        // Keep editing state on error
    } finally {
        setLoadingData(false);
    }
 };

 // Update temporary editingRowData state when an inline input changes
 const handleEditingInputChange = (value: any, dataIndex: string ) => {
    if (!editingRowData) return;
    console.log(`Input change: ${dataIndex} =`, value);
    setEditingRowData(prev => ({ ...prev, [dataIndex]: value }));
 };


 // --- Delete Handler ---
 const handleDelete = (primaryKeyValue: string | number) => {
     // Still need the actual primary key value for the API call
    if (!tableName || !primaryKeyName) {
        message.error("Cannot delete row: Table or Primary Key information missing.");
        return;
    }
    const displayValue = String(primaryKeyValue); // Value to show in confirmation

    confirm({
        title: 'Are you sure delete this record?',
        content: `Record with ${primaryKeyName}=${displayValue} will be permanently deleted.`,
        okText: 'Yes, Delete', okType: 'danger', cancelText: 'No', maskClosable: false,
        onOk: async () => {
            const messageKey = `delete-${primaryKeyValue}`;
            try {
                setLoadingData(true);
                message.loading({ content: `Deleting record...`, key: messageKey, duration: 0 });

                // Call API with the actual primary key value
                await api.deleteRecord(tableName, primaryKeyValue);

                message.success({ content: 'Record deleted successfully!', key: messageKey, duration: 2 });
                if (editingKey === `${tableName}-pk-${primaryKeyValue}`) { handleCancel(); }

                // Refetch data for the current page (or previous if last item deleted)
                setError(null);
                const pageToFetch = (data.length === 1 && currentPage > 1) ? currentPage - 1 : currentPage;
                // If page changes, update state to trigger refetch
                if (pageToFetch !== currentPage) {
                    setCurrentPage(pageToFetch);
                } else {
                     // If page doesn't change, manually trigger refetch (useEffect won't run)
                     setLoadingData(true); // Show loading manually
                     api.fetchData(tableName, pageToFetch, pageSize)
                        .then(response => {
                             const processedData = response.data.map((row, index) => ({
                                 ...row,
                                 key: primaryKeyName && row[primaryKeyName] !== undefined ? `${tableName}-pk-${row[primaryKeyName]}` : `row-${tableName}-${pageToFetch}-${index}`
                             }));
                             setData(processedData);
                             setTotalRows(response.total);
                        })
                        .catch(err => setError(`Refetch failed after delete: ${err.message}`))
                        .finally(() => setLoadingData(false));
                }

            } catch (err: any) {
                message.error({ content: `Failed to delete record: ${err.message || 'Unknown error'}`, key: messageKey, duration: 4 });
                console.error('Delete Row Failed:', err);
                setError(`Failed to delete record: ${err.message}`); // Show in alert
            } finally {
                 // Ensure loading indicator stops if refetch wasn't triggered via page change
                 if (currentPage === ((data.length === 1 && currentPage > 1) ? currentPage - 1 : currentPage)) {
                     // setLoadingData(false); // Handled by manual refetch finally block now
                 }
            }
        },
    });
 };


 // --- Add Column Handlers (Remain the same) ---
 const showAddColModal = () => { addColForm.resetFields(); setIsAddColModalVisible(true); };
 const handleAddColOk = async () => { /* ... same as before ... */
    if (!tableName) return;
    try {
        setConfirmLoadingAddCol(true);
        const values = await addColForm.validateFields();
        const payload: NewColumnPayload = { name: values.columnName.trim(), type: values.columnType };
        console.log("📦 Sending Create Column Payload:", payload);
        await api.createColumn(tableName, payload);
        message.success(`Column "${payload.name}" added successfully! Refreshing schema...`);
        setIsAddColModalVisible(false);
        // --- Refresh Schema and Data ---
        setLoadingSchema(true);
        api.fetchSchema(tableName)
            .then(fetchedSchema => {
                setSchema(fetchedSchema);
                const pk = fetchedSchema.find(col => col.isPrimaryKey);
                setPrimaryKeyName(pk ? pk.name : null);
                setCurrentPage(1);
                setLoadingData(true);
                return api.fetchData(tableName, 1, pageSize);
            })
            .then(response => {
                const processedData = response.data.map((row, index) => ({
                    ...row,
                    key: primaryKeyName && row[primaryKeyName] !== undefined ? `${tableName}-pk-${row[primaryKeyName]}` : `row-${tableName}-1-${index}`
                }));
                setData(processedData);
                setTotalRows(response.total);
                setError(null);
            })
            .catch(err => {
                console.error("Error during schema/data refresh after add column:", err);
                setError(`Schema/data refresh failed after adding column: ${err.message}`);
            })
            .finally(() => { setLoadingSchema(false); setLoadingData(false); });
    } catch (errorInfo: any) {
        console.error('Add Column Failed:', errorInfo);
        const errorMsg = errorInfo?.response?.data?.message || (errorInfo instanceof Error ? errorInfo.message : null) || 'Unknown error';
        if (errorInfo.errorFields) { message.error('Validation failed.'); }
        else { message.error(`Failed to add column: ${errorMsg}`); }
    } finally { setConfirmLoadingAddCol(false); }
};
 const handleAddColCancel = () => { setIsAddColModalVisible(false); };


 // --- Build Table Columns Dynamically ---
 const columns = useMemo((): ColumnsType<any> => {
    // Return empty if no schema yet or schema failed loading
    if (!schema || schema.length === 0 || !primaryKeyName) return [];

    // --- 1. Define the "S.No." Column ---
    const serialNumberColumn: ColumnsType<any>[0] = {
        title: 'S.No.',
        key: 'frontend_sno', // Unique key for this virtual column
        width: 70, // Fixed width for serial number
        fixed: 'left', // Optional: make it sticky
        align: 'center',
        render: (text: any, record: any, index: number) => {
            // Calculate serial number based on current page and row index
            return (currentPage - 1) * pageSize + index + 1;
        },
    };

    // --- 2. Generate Columns for Actual Data (excluding serial_num) ---
    const dataColumns: ColumnsType<any> = schema
        // Filter out the actual primary key column ('serial_num') from display
        .filter(col => col.name !== primaryKeyName)
        .map((col) => {
            // Determine if the column is editable (non-PK, non-FK)
            const editable = !col.isPrimaryKey && !col.isForeignKey; // Still prevent PK/FK edit

            return {
                title: col.name,
                dataIndex: col.name,
                key: col.name, // Use actual column name as key
                ellipsis: !isEditing({ key: editingKey }),
                width: 150, // Default width
                // --- Render Function (Display / Edit Input) ---
                render: (text: any, record: any) => {
                    const editing = isEditing(record);

                    // If editing this row AND this column is editable
                    if (editing && editable) {
                        const InputComponent = renderFormInput(col);
                        // Clone element to pass specific props for inline editing
                        return React.cloneElement(InputComponent, {
                            value: editingRowData ? editingRowData[col.name] : undefined,
                            onChange: (eOrValue: any) => {
                                const value = eOrValue?.target?.value ?? eOrValue?.target?.checked ?? eOrValue;
                                handleEditingInputChange(value, col.name);
                            },
                            onPressEnter: handleSave,
                            style: { ...InputComponent.props.style, width: 'calc(100% - 10px)'}
                        });
                    }
                    // --- Display Mode ---
                    else {
                         // (Display logic remains the same: format dates, booleans, NULLs)
                        const colTypeLC = col.type.toLowerCase().split('(')[0];
                        const dateTypesLC = ['date', 'timestamp', 'datetime', 'timestamptz'];
                        const booleanTypesLC = ['boolean', 'bool'];

                        if (text === null || text === undefined) {
                            return <i style={{ color: '#ccc' }}>NULL</i>;
                        } else if (booleanTypesLC.includes(colTypeLC)) {
                            return String(text); // 'true' or 'false'
                        } else if (dateTypesLC.includes(colTypeLC)) {
                            try {
                                // Attempt locale string formatting
                                return new Date(text).toLocaleString();
                            } catch (e) { return String(text); } // Fallback
                        }
                        return String(text); // Default string display
                    }
                }, // End render
            }; // End column definition
        }); // End map

    // --- 3. Define the "Actions" Column ---
    // Added only if a primary key was identified (needed for edit/delete)
    const actionsColumn: ColumnsType<any>[0] | null = primaryKeyName ? {
        title: 'Actions',
        key: 'actions',
        width: 120,
        fixed: 'right',
        render: (_, record) => {
            const editing = isEditing(record);
            // Get the ACTUAL primary key value from the record data
            const pkValue = record[primaryKeyName];

            return (
                <Space size="small">
                    {editing ? (
                        <>
                            <Button type="primary" onClick={handleSave} size="small" loading={loadingData && editingKey === record.key}>Save</Button>
                            <Button onClick={handleCancel} size="small" disabled={loadingData}>Cancel</Button>
                        </>
                    ) : (
                        <>
                            <Button type="link" size="small" disabled={editingKey !== '' || loadingData} onClick={() => handleEdit(record)}>Edit</Button>
                            {/* Pass the actual primary key value to handleDelete */}
                            <Button type="link" size="small" danger disabled={editingKey !== '' || loadingData} onClick={() => handleDelete(pkValue)}>Delete</Button>
                        </>
                    )}
                </Space>
            );
        },
    } : null; // No actions column if no PK

    // --- 4. Combine Columns ---
    return [
        serialNumberColumn, // Add "S.No." first
        ...dataColumns,     // Add the actual data columns
        ...(actionsColumn ? [actionsColumn] : []) // Add actions column if it exists
    ];

 }, [schema, primaryKeyName, editingKey, editingRowData, loadingData, currentPage, pageSize]); // Dependencies


 // --- Component Render ---
 if (!tableName && !error && !loadingSchema) {
    return <Empty description="Select a table from the sidebar" style={{ marginTop: 50 }} />;
 }

 return (
    <div style={{ padding: '15px', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <h2 style={{ marginBottom: '10px', flexShrink: 0 }}>
         {tableName ? `Table: ${tableName}` : 'Select a Table'}
         {loadingSchema && <Spin size="small" style={{ marginLeft: '10px' }} />}
      </h2>

      {/* Error Alert */}
      {error && (
         <Alert message={error} type={schema.length === 0 ? "error" : "warning"} showIcon closable onClose={() => setError(null)} style={{ marginBottom: '10px', flexShrink: 0 }} />
      )}

      {/* Toolbar */}
      <div style={{ marginBottom: '10px', flexShrink: 0 }}>
         <Space>
            {/* Disable Add Row if no PK */}
            <Button type="primary" onClick={showAddModal} disabled={!tableName || !schema.length || !primaryKeyName || loadingSchema || loadingData || editingKey !== ''}>Add Row</Button>
            <Button onClick={showAddColModal} disabled={!tableName || !schema.length || loadingSchema || loadingData || editingKey !== ''}>Add Column</Button>
         </Space>
      </div>

       {/* Table Area */}
       <div style={{ flexGrow: 1, overflow: 'hidden', border: '1px solid #f0f0f0' }}>
         <Spin spinning={loadingData && !error} tip="Loading data...">
            <Table
               columns={columns}
               // Use data state which includes the actual serial_num for internal use
               dataSource={loadingSchema ? [] : data}
               rowKey="key" // Use the generated React key
               pagination={false} // Use external pagination component
               scroll={{ x: 'max-content', y: 'calc(100vh - 300px)' }} // Adjust height calculation
               size="small"
               bordered
               locale={{ emptyText: (loadingSchema || loadingData) ? <Spin size="small"/> : <Empty description={error ? "Error loading data" : "No data found"} /> }} // Show error in emptyText too
            />
         </Spin>
       </div>

      {/* Pagination Area */}
      <div style={{ marginTop: '16px', textAlign: 'right', flexShrink: 0 }}>
         {totalRows > 0 && !loadingSchema && (
            <Pagination
               current={currentPage} pageSize={pageSize} total={totalRows}
               onChange={(page, size) => {
                  if (editingKey) { message.warning('Please save or cancel edit first.'); return; }
                  setCurrentPage(page);
                  if (size && size !== pageSize) {
                     setPageSize(size);
                     if (currentPage !== 1) setCurrentPage(1);
                  }
               }}
               showSizeChanger showQuickJumper pageSizeOptions={['10', '20', '50', '100']}
               showTotal={(total, range) => `${range[0]}-${range[1]} of ${total} items`}
               disabled={loadingData || editingKey !== ''}
            />
         )}
      </div>

      {/* --- Modals --- */}
      {/* Add Row Modal */}
      {isAddModalVisible && (
          <Modal title={`Add New Row to ${tableName}`} visible={isAddModalVisible} onOk={handleAddOk} confirmLoading={confirmLoadingAdd} onCancel={handleAddCancel} okText="Add Row" destroyOnClose maskClosable={false} width={600} >
            <Form form={addForm} layout="vertical" name="add_row_form">
              {schema
                 // Filter out the primary key ('serial_num') from the Add Row form
                 // The backend service is responsible for ignoring it anyway, but good UX to hide it.
                .filter(col => !col.isPrimaryKey) // Simple filter by PK flag
                .map(col => (
                  <Form.Item key={`add-${col.name}`} name={col.name} label={`${col.name} (${col.type})`} rules={[{ required: !col.isNullable, message: `${col.name} is required` }]} >
                    {renderFormInput(col)}
                  </Form.Item>
                ))}
            </Form>
          </Modal>
      )}

      {/* Add Column Modal (Remains the same) */}
       {isAddColModalVisible && (
           <Modal title={`Add New Column to ${tableName}`} visible={isAddColModalVisible} onOk={handleAddColOk} confirmLoading={confirmLoadingAddCol} onCancel={handleAddColCancel} okText="Add Column" destroyOnClose maskClosable={false} >
              <Form form={addColForm} layout="vertical" name="add_column_form">
                  <Form.Item name="columnName" label="Column Name" rules={[ { required: true }, { pattern: /^[a-zA-Z_][a-zA-Z0-9_]*$/ }, ]} >
                      <Input placeholder="e.g., email or user_status"/>
                  </Form.Item>
                  <Form.Item name="columnType" label="Column Type" rules={[{ required: true }]} >
                      <Select placeholder="Select data type">
                          {SUPPORTED_COLUMN_TYPES.map(type => ( <Option key={type} value={type}>{type}</Option> ))}
                      </Select>
                  </Form.Item>
                  {/* Optional constraints example: */}
                  {/* <Form.Item name="isNullable" label="Allow Null?" valuePropName="checked" initialValue={true}><Checkbox/></Form.Item> */}
              </Form>
           </Modal>
       )}

    </div> // End main div
  );
};

export default DataGrid;