// src/components/DataGrid/DataGrid.tsx

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
Table, Spin, Alert, Empty, Pagination, Button, Input, Modal, Form, Select, InputNumber, DatePicker, Checkbox, Space, message, Upload, Tooltip, Typography, Dropdown, Menu // Added Upload, Tooltip, Typography, Dropdown, Menu
} from 'antd';
import { ColumnsType, TablePaginationConfig, SorterResult, SortOrder, Key } from 'antd/es/table/interface'; // Added SorterResult, SortOrder, Key
import * as api from '../../api';
import {
FilterOutlined, SearchOutlined, UploadOutlined, GroupOutlined, ClearOutlined, DownOutlined, PlusOutlined, DeleteOutlined, InboxOutlined // Added new icons
} from '@ant-design/icons';
import { ApiColumnSchema, NewColumnPayload } from '../../api/types'; // Assuming NewColumnPayload exists
import type { UploadFile, UploadProps, RcFile } from 'antd'; // For CSV Upload
import dayjs from 'dayjs'; // Import dayjs for DatePicker compatibility
import { debounce } from 'lodash'; // Import debounce

const { confirm } = Modal;
const { Option } = Select;
const { Title, Text } = Typography; // For table title and text ellipsis
const { Dragger } = Upload; // Import Dragger for upload area

interface DataGridProps {
tableName: string | null;
}

type EditingRowData = Record<string, any> | null;

// Define state structures for new features
interface SortConfig {
    field: Key | null;
    order: SortOrder | null;
}

// Define Filter Condition structure
interface FilterCondition {
    id: number; // Unique ID for React key prop
    column?: string;
    operator?: string;
    value?: any;
    logicalOperator?: 'AND' | 'OR'; // Operator connecting this condition to the NEXT one
}

// Supported types for the Add Column modal dropdown
const SUPPORTED_COLUMN_TYPES = [
    'TEXT', 'VARCHAR',
    'INTEGER', 'INT', 'BIGINT',
    'NUMERIC', 'DECIMAL', 'FLOAT', 'REAL', 'DOUBLE PRECISION',
    'BOOLEAN', 'BOOL',
    'DATE', 'TIMESTAMP', 'TIMESTAMP WITH TIME ZONE'
];

// Define operators for filtering
const FILTER_OPERATORS = [
    { label: 'Equals (=)', value: '=' },
    { label: 'Not Equals (!=)', value: '!=' },
    { label: 'Greater Than (>)', value: '>' },
    { label: 'Greater Than or Equals (>=)', value: '>=' },
    { label: 'Less Than (<)', value: '<' },
    { label: 'Less Than or Equals (<=)', value: '<=' },
    { label: 'Contains (LIKE)', value: 'LIKE' },
    { label: 'Does Not Contain (NOT LIKE)', value: 'NOT LIKE' },
    { label: 'Is Null', value: 'IS NULL' },
    { label: 'Is Not Null', value: 'IS NOT NULL' },
];

// Accepted file types for upload
const ACCEPTED_UPLOAD_TYPES = [
    '.csv',
    'text/csv', // Standard CSV MIME type
    'application/vnd.ms-excel', // .xls
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    // Add other types if needed, e.g., application/json, text/plain
];
const ACCEPTED_UPLOAD_EXTENSIONS_STRING = ".csv, .xls, .xlsx"; // For user display

const DataGrid: React.FC<DataGridProps> = ({ tableName }) => {
const [schema, setSchema] = useState<ApiColumnSchema[]>([]);
const [data, setData] = useState<any[]>([]); // Raw data from backend for the current page
const [totalRows, setTotalRows] = useState<number>(0);
const [currentPage, setCurrentPage] = useState<number>(1);
const [pageSize, setPageSize] = useState<number>(20);
const [loadingSchema, setLoadingSchema] = useState<boolean>(false);
const [loadingData, setLoadingData] = useState<boolean>(false);
const [error, setError] = useState<string | null>(null);

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

// --- Search State ---
const [searchQuery, setSearchQuery] = useState<string>('');

// --- Sort State ---
// NOW used for FRONTEND sorting of the current page data
const [sortConfig, setSortConfig] = useState<SortConfig>({ field: null, order: null });

const [refetchTrigger, setRefetchTrigger] = useState<number>(0);

// --- Filter State ---
// NOTE: Backend filters remain unchanged.
const [filterConfig, setFilterConfig] = useState<FilterCondition[]>([]);
const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);
const [filterForm] = Form.useForm(); // Form instance for the filter modal

// --- Grouping State ---
// NOTE: Backend grouping remains unchanged.
const [groupingColumn, setGroupingColumn] = useState<string | null>(null);

// --- Upload State ---
const [uploading, setUploading] = useState(false);
const [isUploadModalVisible, setIsUploadModalVisible] = useState(false); // State for upload modal

// --- Debounced Search Handler (for Frontend Filtering) ---
const debouncedSearch = useCallback(
    debounce((query: string) => {
    setSearchQuery(query);
    }, 200), // Reduced delay for better responsiveness with frontend filtering
    []
);

// --- Effect for Fetching Schema ---
useEffect(() => {
    if (!tableName) {
    // Reset everything if no table is selected
        setSchema([]); setData([]); setError(null); setPrimaryKeyName(null);
        setEditingKey(''); setEditingRowData(null); setIsAddModalVisible(false);
        setIsAddColModalVisible(false); addForm.resetFields(); addColForm.resetFields();
        setCurrentPage(1); setTotalRows(0);
        setSearchQuery(''); // Reset frontend search query
        setSortConfig({ field: null, order: null }); // Reset frontend sort
        setFilterConfig([]); filterForm.resetFields(); setGroupingColumn(null);
        setIsUploadModalVisible(false); // Close upload modal if open
        return;
    }
    // Reset state when table name changes
    setLoadingSchema(true); setError(null); setSchema([]); setData([]);
    setCurrentPage(1); setPrimaryKeyName(null); setEditingKey('');
    setEditingRowData(null); setIsAddModalVisible(false); setIsAddColModalVisible(false);
    addForm.resetFields(); addColForm.resetFields();
    setSearchQuery(''); // Reset frontend search query
    setSortConfig({ field: null, order: null }); // Reset frontend sort
    setFilterConfig([]); filterForm.resetFields(); setGroupingColumn(null);
    setIsUploadModalVisible(false); // Close upload modal if open

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
        console.warn(`Table "${tableName}" has no primary key in schema. Edit/Delete may fail.`);
    }
    })
    .catch((err) => {
    console.error(`Schema fetch error for ${tableName}:`, err);
    setError(`Failed to load schema for "${tableName}": ${err.message}`);
    setPrimaryKeyName(null); setSchema([]);
    })
    .finally(() => setLoadingSchema(false));

}, [tableName, addForm, addColForm, filterForm]); // Dependencies for schema fetching

// --- Effect for Fetching Data ---
useEffect(() => {
    // Don't fetch if schema is loading, or table name is missing, or schema is empty (and not due to an error)
    if (!tableName || loadingSchema || (!loadingSchema && schema.length === 0 && !error)) {
        if (!loadingSchema && schema.length === 0 && !error) {
            setData([]);
            setTotalRows(0);
        }
        return;
    };

    // Prevent data refetch while a row is being edited to avoid losing unsaved changes
    if (editingKey) {
        console.log("Data fetch skipped: Row editing in progress.");
        return;
    }

    setLoadingData(true);
    console.log(`Fetching data for: ${tableName}, Page: ${currentPage}, Size: ${pageSize}, Filter: ${filterConfig.length}, Group: ${groupingColumn}`);

    // Prepare parameters for the API call - NO search or sort params here
    const fetchParams: Record<string, any> = {
        page: currentPage,
        limit: pageSize,
        // Send parameters only if they have values
        ...(filterConfig.length > 0 && { filters: filterConfig }), // Backend filters still sent
        ...(groupingColumn && { group_by: groupingColumn }),       // Backend grouping still sent
    };

    // Call the API
    api.fetchData(tableName, fetchParams)
    .then((response) => {
        console.log("Data fetched (raw):", response);
        if (!response || !Array.isArray(response.data) || typeof response.total !== 'number') {
            throw new Error("Invalid data format received from server.");
        }

        // Process data for the table (add unique keys)
        const processedData = response.data.map((row, index) => {
            const pkValue = primaryKeyName ? row[primaryKeyName] : undefined;
            // Generate a robust key using PK if available, otherwise use row index within the page
            const key = pkValue !== undefined && pkValue !== null
                ? `${tableName}-pk-${pkValue}`
                : `row-${tableName}-${currentPage}-${pageSize}-${index}`; // Include page/size for better uniqueness
            return { ...row, key };
        });
        console.log("Data processed for state:", processedData);
        setData(processedData); // Store the raw data for the current page
        setTotalRows(response.total);
        if (error?.startsWith("Failed to load data")) setError(null); // Clear previous data loading errors on success
    })
    .catch((err) => {
        console.error(`Data fetch error for ${tableName}:`, err);
        setError(`Failed to load data for "${tableName}": ${err.message}`);
        setData([]); setTotalRows(0); // Clear data on error
    })
    .finally(() => setLoadingData(false));

// REMOVED searchQuery and sortConfig from dependencies - fetch is independent of them now
}, [
    tableName,
    currentPage,
    pageSize,
    // searchQuery, // REMOVED: Search is frontend only
    // sortConfig,  // REMOVED: Sort is frontend only
    filterConfig,// Dependency: Refetch when backend filter changes
    groupingColumn,// Dependency: Refetch when backend group changes
    loadingSchema, // Dependency: Wait for schema to load
    primaryKeyName,// Dependency: Needed for key generation
    schema,        // Dependency: Ensure schema is loaded
    error,         // Dependency: Avoid fetch loops if error occurs? (Maybe remove if error doesn't block subsequent tries)
    editingKey,    // Dependency: Prevent fetch during edit
    refetchTrigger // <-- ADD THIS DEPENDENCY
]);

// --- Frontend Data Processing (Search & Sort) ---
const displayedData = useMemo(() => {
    let filteredData = [...data]; // Start with the raw data fetched for the current page

    // 1. Apply Frontend Search Filter
    if (searchQuery) {
        const lowerCaseQuery = searchQuery.toLowerCase();
            filteredData = filteredData.filter(row =>
            schema.some(col => {
            const value = row[col.name];
            // Check if any column value (converted to string) contains the search query
            return value !== null && value !== undefined && String(value).toLowerCase().includes(lowerCaseQuery);
            })
        );
    }

    // 2. Apply Frontend Sorting
    if (sortConfig.field && sortConfig.order) {
            const { field, order } = sortConfig;
            const sortField = String(field); // Ensure field is a string for indexing

            filteredData.sort((a, b) => {
            const valueA = a[sortField];
            const valueB = b[sortField];

            // Basic comparison logic (can be enhanced for specific types like dates if needed)
            let comparison = 0;
            if (valueA === null || valueA === undefined) comparison = -1;
            else if (valueB === null || valueB === undefined) comparison = 1;
            else if (valueA < valueB) comparison = -1;
            else if (valueA > valueB) comparison = 1;

            return order === 'descend' ? comparison * -1 : comparison;
        });
    }

    return filteredData;
}, [data, searchQuery, sortConfig, schema]); // Dependencies: raw data, search query, sort config, and schema (for search)


// --- Table Change Handler (Handles Sorting via Table Header Clicks - FRONTEND) ---
const handleTableChange = (
    pagination: TablePaginationConfig, // Still ignored
    filters: Record<string, (Key | boolean)[] | null>, // Still ignored
    sorter: SorterResult<any> | SorterResult<any>[] // This contains the sort info
    ) => {
        // Prevent changes during editing
        if (editingKey) {
            message.warning('Please save or cancel edit first.');
            return;
        }
    console.log("Table change event (sorter for frontend):", sorter);

    // AntD might pass an array for multi-sort, but we handle single sort
    const currentSorter = Array.isArray(sorter) ? sorter[0] : sorter;

    let newSortConfig: SortConfig = { field: null, order: null };

    if (currentSorter && currentSorter.columnKey && currentSorter.order) {
        newSortConfig = { field: currentSorter.columnKey, order: currentSorter.order };
    }
    if (newSortConfig.field !== sortConfig.field || newSortConfig.order !== sortConfig.order) {
        console.log("Updating frontend sort config:", newSortConfig);
        setSortConfig(newSortConfig);
    }
};

// --- Helper Function: Render Appropriate Form Input Based on Schema Type ---
const renderFormInput = (col: ApiColumnSchema, isFilterInput: boolean = false) => {
const numericTypesLC = ['numeric', 'integer', 'int', 'bigint', 'float', 'double', 'decimal', 'real', 'serial', 'bigserial'];
const dateTypesLC = ['date', 'timestamp', 'datetime', 'timestamptz'];
const booleanTypesLC = ['boolean', 'bool'];
const colTypeLC = col.type.toLowerCase().split('(')[0];

if (numericTypesLC.includes(colTypeLC)) {
    return <InputNumber style={{ width: '100%' }} placeholder={"Enter number"} />;
}
else if (dateTypesLC.includes(colTypeLC)) {
    const showTime = colTypeLC.includes('timestamp') || colTypeLC.includes('datetime');
    return <DatePicker style={{ width: '100%' }} showTime={showTime} placeholder={`Select date${showTime ? '/time' : ''}`} format={showTime ? "YYYY-MM-DD HH:mm:ss" : "YYYY-MM-DD"} />;
} else if (booleanTypesLC.includes(colTypeLC)) {
    return <Select style={{ width: '100%' }} placeholder="Select True/False/Null" allowClear={isFilterInput} >
    <Option value={true}>True</Option>
    <Option value={false}>False</Option>
    {isFilterInput && <Option value={null}>Null</Option>} {/* Allow explicit Null selection in filters */}
    </Select>;
}
else {
    return <Input placeholder={"Enter text"} />;
}
};

// --- Helper Function: Render Filter Value Input ---
const renderFilterValueInput = (columnIndex?: number) => {
    if (columnIndex === undefined) return <Input disabled placeholder="Select column first" />;

    const field = filterForm.getFieldValue(['conditions', columnIndex, 'column']);
    const operator = filterForm.getFieldValue(['conditions', columnIndex, 'operator']);
    const selectedColumn = schema.find(col => col.name === field);

    if (operator === 'IS NULL' || operator === 'IS NOT NULL') {
        return <Input disabled placeholder="No value needed" style={{ width: 200 }}/>;
    }

    if (!selectedColumn) return <Input disabled placeholder="Select column first" style={{ width: 200 }}/>;

    const InputComponent = renderFormInput(selectedColumn, true);
    return React.cloneElement(InputComponent, { style: { ...InputComponent.props.style, width: 200 } });
};

// --- Helper Function: Prepare Payload with Type Conversion ---
const preparePayload = (
    inputValues: Record<string, any>,
    schemaRef: ApiColumnSchema[],
    isInsert: boolean = false,
    pkName: string | null
    ): Record<string, any> | null => {
        const payload: Record<string, any> = {};
        let parsingError = false;
        let errors: string[] = [];

        schemaRef.forEach(col => {
            if (col.isPrimaryKey || col.name === pkName) {
            return; // Skip primary key from payload
            }

            if (inputValues.hasOwnProperty(col.name)) {
                const rawValue = inputValues[col.name];
                const colTypeLC = col.type.toLowerCase().split('(')[0];
                const numericTypesLC = ['numeric', 'integer', 'int', 'bigint', 'float', 'double', 'decimal', 'real'];
                const dateTypesLC = ['date', 'timestamp', 'datetime', 'timestamptz'];
                const booleanTypesLC = ['boolean', 'bool'];

            if (rawValue === '' || rawValue === null || rawValue === undefined) {
                if (!col.isNullable && isInsert && !col.hasDefault) { // Stricter check for insert
                    errors.push(`Column "${col.name}" cannot be empty.`);
                    parsingError = true;
                } else {
                    payload[col.name] = null; // Allow sending null if nullable or for update
                }
            }
            else if (numericTypesLC.includes(colTypeLC)) {
                const numValue = typeof rawValue === 'number' ? rawValue : parseFloat(String(rawValue).replace(/,/g, ''));
                if (isNaN(numValue)) {
                    errors.push(`Invalid number format for "${col.name}": ${rawValue}`);
                    parsingError = true;
                } else { payload[col.name] = numValue; }
            } else if (dateTypesLC.includes(colTypeLC)) {
                if (dayjs.isDayjs(rawValue)) { // Expecting dayjs object from DatePicker
                    payload[col.name] = rawValue.toISOString();
                } else if (typeof rawValue === 'string') { // Handle pre-formatted strings (e.g., during edit)
                    try {
                        const parsedDate = dayjs(rawValue);
                        if (parsedDate.isValid()) {
                            payload[col.name] = parsedDate.toISOString();
                        } else { throw new Error("Invalid date string"); }
                    } catch {
                        errors.push(`Invalid date string for "${col.name}": ${rawValue}`);
                        parsingError = true;
                    }
                } else if (rawValue instanceof Date) { // Handle native Date object just in case
                    payload[col.name] = rawValue.toISOString();
                } else {
                    errors.push(`Invalid date input for "${col.name}"`);
                    parsingError = true;
                }
            } else if (booleanTypesLC.includes(colTypeLC)) {
                if (rawValue === true || rawValue === false) {
                    payload[col.name] = rawValue;
                } else if (rawValue === null || rawValue === undefined) { // Checkbox might return undefined if unchecked initially?
                    if (!col.isNullable && isInsert && !col.hasDefault) {
                        errors.push(`Boolean column "${col.name}" cannot be empty.`);
                        parsingError = true;
                    } else {
                        payload[col.name] = null;
                    }
                } else {
                    errors.push(`Invalid boolean value for "${col.name}": ${rawValue}`);
                    parsingError = true;
                }
            } else { // Text types
                payload[col.name] = String(rawValue);
            }
            } else if (isInsert && !col.isNullable && !col.hasDefault && !col.isPrimaryKey) {
                errors.push(`Column "${col.name}" is required.`);
                parsingError = true;
            }
        });

        if (parsingError) {
        message.error(`Please fix validation errors: ${errors.join('; ')}`);
        console.error("Payload parsing failed.", errors, inputValues);
        return null;
        }
        console.log("Prepared Payload:", payload);
        return payload;
        };

        // --- Add Row Handlers ---
        const showAddModal = () => { addForm.resetFields(); setIsAddModalVisible(true); };
        const handleAddOk = async () => {
            if (!tableName) return;
            try {
                setConfirmLoadingAdd(true); // Use modal's loading state
                const values = await addForm.validateFields();
                const payload = preparePayload(values, schema, true, primaryKeyName);

                if (!payload) { setConfirmLoadingAdd(false); return; }

                console.log("📦 Sending Create Payload:", payload);
                await api.createRecord(tableName, payload);
                message.success('Record added successfully!');
                setIsAddModalVisible(false);

                // Refetch data logic: Always go to page 1 after adding.
                const wasAlreadyOnPage1 = currentPage === 1;

                if (!wasAlreadyOnPage1) {
                    // If not on page 1, setting it will trigger useEffect
                    console.log("Setting current page to 1 after add.");
                    setCurrentPage(1);
                } else {
                    // If already on page 1, force refetch using the trigger state
                    console.log("Forcing refetch on page 1 after add via trigger.");
                    setRefetchTrigger(c => c + 1);
                }
                // Loading state for the *data grid* will be handled by the triggered useEffect

            } catch (errorInfo: any) {
                console.error('Add Row Failed:', errorInfo);
                const errorMsg = errorInfo?.response?.data?.message || (errorInfo instanceof Error ? errorInfo.message : null) || 'Unknown error';
                if (errorInfo.errorFields) { message.error('Validation failed. Check the form.'); }
                else { message.error(`Failed to add record: ${errorMsg}`); }
            } finally {
                setConfirmLoadingAdd(false); // Stop modal's loading indicator
            }
        };
        // handleAddCancel remains the same
        const handleAddCancel = () => { setIsAddModalVisible(false); };
        // --- Edit Handlers ---
        const isEditing = (record: any) => record.key === editingKey;
        const handleEdit = (record: any) => {
            console.log("Editing record:", record);
            const initialEditData = { ...record };
            schema.forEach(col => {
                const dateTypesLC = ['date', 'timestamp', 'datetime', 'timestamptz'];
                const colTypeLC = col.type.toLowerCase().split('(')[0];
                if (dateTypesLC.includes(colTypeLC) && initialEditData[col.name]) {
                    const parsedDate = dayjs(initialEditData[col.name]);
                    if (parsedDate.isValid()) {
                        initialEditData[col.name] = parsedDate; // Use dayjs object for DatePicker
                    } else {
                        console.warn(`Could not parse date string "${initialEditData[col.name]}" for column "${col.name}" during edit.`);
                    initialEditData[col.name] = null; // Or set to null/undefined if parsing fails
                    }
                }
            });
            setEditingRowData(initialEditData);
            setEditingKey(record.key);
    };
    const handleCancel = () => { setEditingKey(''); setEditingRowData(null); };
    const handleSave = async () => {
        if (!tableName || !primaryKeyName || !editingRowData) return;

        const keyToSave = editingKey;
        // Find original record in the RAW data, not displayedData
        const originalRecord = data.find(item => item.key === keyToSave);
        if (!originalRecord) {
            message.error("Cannot save row: Original record not found in current page data.");
            return;
        }
        const pkValue = originalRecord[primaryKeyName];

        if (pkValue === undefined || pkValue === null) {
            message.error("Cannot save row: Primary key value is missing.");
            return;
        }

        const dataToSave = { ...editingRowData };
        delete dataToSave.key;

        const payload = preparePayload(dataToSave, schema, false, primaryKeyName);
        if (!payload) { return; }

        // Simple change detection (more robust deep comparison might be needed)
        let changed = false;
        for (const key in payload) {
            const originalValue = originalRecord[key];
            const newValue = payload[key];
            const dateTypesLC = ['date', 'timestamp', 'datetime', 'timestamptz'];
            const col = schema.find(c => c.name === key);
            const colTypeLC = col?.type.toLowerCase().split('(')[0] || '';

            if (dateTypesLC.includes(colTypeLC)) {
                // Compare ISO strings for dates coming from payload
                const originalDateStr = originalValue ? dayjs(originalValue).toISOString() : null;
                if (originalDateStr !== newValue) { changed = true; break; }
            } else { // Handle null/undefined comparison carefully
                if ((originalValue === null || originalValue === undefined) && (newValue === null || newValue === undefined)) {
                    continue; // Both are null/undefined, no change
                }
                // Use string comparison as a fallback, might need refinement for numeric types
                if (String(originalValue) !== String(newValue)) {
                    changed = true;
                    break;
                }
            }
        }

        if (!changed && Object.keys(payload).length > 0) {
            console.log("Payload generated, but simple change check shows no difference. Proceeding with save.");
        } else if (Object.keys(payload).length === 0) {
            message.info("No changes detected to save.");
            handleCancel();
            return;
        }

        try {
            setLoadingData(true); // Use general data loading for now
            console.log("📦 Sending Update Payload:", payload);
            await api.updateRecord(tableName, pkValue, payload);
            setData((prevData) => {
                const index = prevData.findIndex(item => item.key === keyToSave);
                if (index === -1) return prevData; // Should not happen if originalRecord was found
                const newData = [...prevData];
                const updatedRecord = { ...originalRecord, ...payload, key: keyToSave };
                schema.forEach(col => {
                    if (payload.hasOwnProperty(col.name)) {
                        updatedRecord[col.name] = payload[col.name];
                    }
                });
                newData[index] = updatedRecord;
                console.log("Optimistically updated raw data state:", newData[index]);
                return newData;
            });
            message.success('Record updated successfully!');
            setEditingKey(''); setEditingRowData(null);
        } catch (err: any) {
            console.error('Update Row Failed:', err);
            const errorMsg = err.response?.data?.message || err.message || 'Unknown error';
            setError(`Failed to update record: ${errorMsg}`);
            message.error(`Failed to update record: ${errorMsg}`);
            // Keep editing state on failure
        } finally {
            setLoadingData(false); // Stop loading indicator
        }
    };
    const handleEditingInputChange = (value: any, dataIndex: string ) => {
        if (!editingRowData) return;
        console.log(`Input change: ${dataIndex} =`, value);
        if (typeof value === 'object' && value?.target?.type === 'checkbox') {
            value = value.target.checked;
        }
        const colSchema = schema.find(col => col.name === dataIndex);
        const dateTypesLC = ['date', 'timestamp', 'datetime', 'timestamptz'];
        if (colSchema && dateTypesLC.includes(colSchema.type.toLowerCase().split('(')[0])) {
            if (dayjs.isDayjs(value) || value === null) {
                setEditingRowData(prev => ({ ...prev, [dataIndex]: value }));
            } else {
                console.warn("Non-dayjs value received for date field:", value);
                const parsed = dayjs(value);
                setEditingRowData(prev => ({ ...prev, [dataIndex]: parsed.isValid() ? parsed : null }));
            }
        } else {
            setEditingRowData(prev => ({ ...prev, [dataIndex]: value }));
        }
    };

    // --- Delete Handler ---
    const handleDelete = (primaryKeyValue: string | number) => {
        if (!tableName || !primaryKeyName) {
            message.error("Cannot delete row: Table or Primary Key information missing."); return;
        }
        const displayValue = String(primaryKeyValue);

        confirm({
            title: 'Are you sure delete this record?',
            content: `Record with ${primaryKeyName}=${displayValue} will be permanently deleted.`,
            okText: 'Yes, Delete', okType: 'danger', cancelText: 'No', maskClosable: false,
            onOk: async () => {
                const messageKey = `delete-${primaryKeyValue}`;
                // Keep track if setLoadingData was set within this specific operation
                let operationLoading = false;
                try {
                    setLoadingData(true);
                    operationLoading = true;
                    message.loading({ content: `Deleting record...`, key: messageKey, duration: 0 });
                    await api.deleteRecord(tableName, primaryKeyValue);
                    message.success({ content: 'Record deleted successfully!', key: messageKey, duration: 2 });
                    if (editingKey === `${tableName}-pk-${primaryKeyValue}`) { handleCancel(); }
                    setError(null);

                    // Refetch data logic:
                    // Check if it was the last item on a page > 1
                    const isLastItemOnPage = data.length === 1 && totalRows > 1; // Ensure totalRows is considered
                    const pageToFetch = (isLastItemOnPage && currentPage > 1) ? currentPage - 1 : currentPage;

                    if (pageToFetch !== currentPage) {
                        // If page changes, setting currentPage will trigger the useEffect
                        console.log(`Delete caused page change to: ${pageToFetch}`);
                        setCurrentPage(pageToFetch);
                        // Loading will be handled by the triggered useEffect
                        operationLoading = false; // useEffect will take over loading state
                    } else {
                        // If page doesn't change, force refetch using the trigger state
                        console.log("Forcing refetch on current page after delete via trigger.");
                        setRefetchTrigger(c => c + 1);
                        // Loading will be handled by the triggered useEffect
                        operationLoading = false; // useEffect will take over loading state
                    }
                } catch (err: any) {
                    message.error({ content: `Failed to delete record: ${err.message || 'Unknown error'}`, key: messageKey, duration: 4 });
                    console.error('Delete Row Failed:', err);
                    setError(`Failed to delete record: ${err.message}`);
                    // *** Crucial: Stop loading indicator ONLY on error ***
                    // If successful, the useEffect triggered by state change handles loading
                    if (operationLoading) {
                        setLoadingData(false);
                    }
                }
                // No finally block needed for setLoadingData here - it's handled by success path (useEffect) or error path (catch)
            },
            onCancel: () => {
                console.log('Delete cancelled');
            },
        });
    };

    // --- Add Column Handlers ---
    // (No changes needed here - still uses backend API and refreshes schema/data)
    const showAddColModal = () => { addColForm.resetFields(); setIsAddColModalVisible(true); };
    const handleAddColOk = async () => {
        if (!tableName) return;
        try {
            setConfirmLoadingAddCol(true);
            const values = await addColForm.validateFields();
            // Basic validation for column name format (adjust regex if needed)
            if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(values.columnName.trim())) {
                message.error('Invalid column name. Use letters, numbers, underscores, starting with a letter or underscore.');
                setConfirmLoadingAddCol(false);
                return;
            }
            const payload: NewColumnPayload = {
                name: values.columnName.trim(),
                type: values.columnType,
            // Add other potential fields like nullable, default etc. if API supports them
            };
            console.log("📦 Sending Create Column Payload:", payload);
            await api.createColumn(tableName, payload);
            message.success(`Column "${payload.name}" added successfully! Refreshing schema...`);
            setIsAddColModalVisible(false);
            // --- Refresh Schema (which will trigger data refetch via useEffect) ---
            setLoadingSchema(true);
            // Reset states potentially affected by schema change
            setSortConfig({ field: null, order: null }); // Reset frontend sort
            setFilterConfig([]); filterForm.resetFields(); // Reset backend filters
            setGroupingColumn(null); // Reset backend grouping
            setSearchQuery(''); // Reset frontend search
            api.fetchSchema(tableName)
            .then(fetchedSchema => {
                setSchema(fetchedSchema);
                const pk = fetchedSchema.find(col => col.isPrimaryKey);
                setPrimaryKeyName(pk ? pk.name : null);
                setCurrentPage(1); // Go to page 1 after schema change
            })
            .catch(err => {
                console.error("Error during schema refresh after add column:", err);
                setError(`Schema refresh failed after adding column: ${err.message}`);
            })
            .finally(() => { setLoadingSchema(false); }); // This will trigger data fetch useEffect
        } catch (errorInfo: any) {
            console.error('Add Column Failed:', errorInfo);
            const errorMsg = errorInfo?.response?.data?.message || (errorInfo instanceof Error ? errorInfo.message : null) || 'Unknown error';
            if (errorInfo.errorFields) { message.error('Validation failed.'); }
            else { message.error(`Failed to add column: ${errorMsg}`); }
        } finally { setConfirmLoadingAddCol(false); }
    };
    const handleAddColCancel = () => { setIsAddColModalVisible(false); };

    // --- Filter Modal Handlers ---
    // (No changes needed here - still uses backend API)
    const showFilterModal = () => {
        const initialValues = { conditions: filterConfig.map((cond, index) => ({ ...cond, id: cond.id || Date.now() + index })) };
        // Ensure all conditions have an ID for the Form.List keys
        initialValues.conditions.forEach((cond, index) => { if (cond.id === undefined) cond.id = Date.now() + index; });
        filterForm.setFieldsValue(initialValues);
        setIsFilterModalVisible(true);
    };
    const handleFilterOk = async () => {
        try {
            const values = await filterForm.validateFields();
            console.log("Filter form values:", values);
            const newFilterConfig = (values.conditions || [])
            .filter((cond: FilterCondition) => cond.column && cond.operator)
            .map((cond: FilterCondition) => {
            // Ensure ID is preserved or generated if missing
                const id = cond.id || Date.now() + Math.random();
                let finalValue = cond.value;
                if (cond.operator === 'IS NULL' || cond.operator === 'IS NOT NULL') {
                    finalValue = undefined; // Or explicit null based on API expectation
                } else if (cond.operator === 'LIKE' || cond.operator === 'NOT LIKE') {
                finalValue = String(finalValue ?? '');
                } else if (dayjs.isDayjs(cond.value)) {
                    finalValue = cond.value.toISOString();
                }
                return {
                    id: id, column: cond.column, operator: cond.operator,
                    value: finalValue,
                    logicalOperator: cond.logicalOperator || 'AND'
                };
            });
            console.log("Applying Backend Filter Config:", newFilterConfig);
            setFilterConfig(newFilterConfig);
            setCurrentPage(1); // Reset page when backend filters change
            setIsFilterModalVisible(false);
            // useEffect will handle data fetch with new filters
        } catch (errorInfo) {
            console.log('Filter validation failed:', errorInfo);
            message.error("Please fill all required filter fields.");
        }
    };
    const handleFilterCancel = () => { setIsFilterModalVisible(false); };
    const handleClearFilters = () => {
        setFilterConfig([]); // Clear backend filters
        filterForm.resetFields();
        setCurrentPage(1); // Reset page
        setIsFilterModalVisible(false);
        // useEffect will handle data fetch without filters
    };

    // --- Grouping Handler ---
    const handleGroupingChange = (value: string | null) => {
    if (editingKey) { message.warning('Please save or cancel edit first.'); return; }
        setGroupingColumn(value);
        setCurrentPage(1);
    };

    // --- Upload Modal and Handlers ---
    const showUploadModal = () => setIsUploadModalVisible(true);
    const handleUploadModalCancel = () => setIsUploadModalVisible(false);

    const handleUploadChange: UploadProps['onChange'] = (info) => {
        if (info.file.status === 'uploading') {
            setUploading(true);
            return;
        }
        if (info.file.status === 'done') {
            setUploading(false);
            message.success(`${info.file.name} uploaded successfully. Refreshing data...`);
            handleUploadModalCancel();
            const needsRefetch = currentPage === 1;
            setCurrentPage(1);
            // Force refetch if already on page 1
            if (needsRefetch) {
                console.log("Forcing refetch on current page after upload.");
                if (groupingColumn === null) setGroupingColumn(null); else setFilterConfig([...filterConfig]);
            }
        } else if (info.file.status === 'error') {
            setUploading(false);
            // Error message is handled by customRequest's onError -> message.error
            console.error("Upload failed (onChange):", info.file.error);
            // Maybe keep modal open on error? Or display error more prominently?
            // message.error(`${info.file.name} file upload failed.`); // Already shown in customRequest
        }
    };

    const customUploadRequest = async (options: any) => {
        const { onSuccess, onError, file, onProgress } = options;
        if (!tableName) {
            const err = new Error("Table name not selected");
            message.error(err.message); // Show message
            onError(err); // Reject promise
            return;
        }

        const formData = new FormData();
        formData.append('file', file as RcFile);

        try {
            setUploading(true); // Ensure uploading state is true
            console.log(`Uploading file ${file.name} to table ${tableName}`);
            const response = await api.uploadData(tableName, formData, (event) => {
                if (event.lengthComputable && event.total > 0) {
                    const percent = Math.floor((event.loaded / event.total) * 100);
                    onProgress({ percent });
                } else {
                    // Indicate progress without percentage if total is unknown
                    onProgress({ percent: 50 }); // Or some other indicator
                }
            });

            onSuccess(response, file); // Trigger onChange 'done' status
        } catch (err: any) {
            setUploading(false); // Stop uploading on error
            console.error("Upload failed (customRequest):", err);
            const errorMsg = err?.response?.data?.message || err.message || 'Upload failed';
            message.error(`Upload Failed: ${errorMsg}`); // Show error message clearly
            onError(new Error(errorMsg), { message: errorMsg }); // Trigger onChange 'error' status
        }
    };

    const beforeUploadCheck = (file: RcFile): boolean | Promise<void> => {
        const fileExtension = `.${file.name.split('.').pop()?.toLowerCase()}`;
        const isAcceptedType = ACCEPTED_UPLOAD_TYPES.includes(file.type) || ACCEPTED_UPLOAD_EXTENSIONS_STRING.toLowerCase().includes(fileExtension);

        if (!isAcceptedType) {
            message.error(`Invalid file type. Allowed types: ${ACCEPTED_UPLOAD_EXTENSIONS_STRING}. Detected: ${file.type || fileExtension}`);
            return Upload.LIST_IGNORE; // Prevent upload
        }
        const isLt50M = file.size / 1024 / 1024 < 50; // Example: Limit size to 50MB
        if (!isLt50M) {
            message.error('File must be smaller than 50MB!');
            return Upload.LIST_IGNORE; // Prevent upload
        }
        console.log("File check OK:", file.name, file.type);
        return true; // Proceed with upload
    };
    const columns = useMemo((): ColumnsType<any> => {
        if (!schema || schema.length === 0) return [];

        // Serial Number Column (Frontend generated, based on filtered/sorted index)
        const serialNumberColumn: ColumnsType<any>[0] = {
            title: 'S.No.', key: 'frontend_sno', width: 70, fixed: 'left', align: 'center',
            render: (_, __, index) => index + 1, // Index within the *displayedData* array
        };

        // Data Columns from Schema
        const dataColumns: ColumnsType<any> = schema.map((col) => {
            const editable = !col.isPrimaryKey && !col.isForeignKey; // Basic editability rule
            const isDate = ['date', 'timestamp', 'datetime', 'timestamptz'].includes(col.type.toLowerCase().split('(')[0]);
            const isBoolean = ['boolean', 'bool'].includes(col.type.toLowerCase().split('(')[0]);

            return {
                title: col.name,
                dataIndex: col.name,
                key: col.name, // Essential for sorter/filter matching (used as columnKey)
                ellipsis: true, // Enable ellipsis by default
                width: col.name === primaryKeyName ? 120 : 180, // Adjust width
                sorter: true, // Enable frontend sorting via header click (triggers handleTableChange)
                sortOrder: sortConfig.field === col.name ? sortConfig.order : null, // Reflect current frontend sort state
                render: (text: any, record: any) => {
                    const editing = isEditing(record);
                    if (editing && editable) {
                        const InputComponent = renderFormInput(col);
                        return (
                            // No need for Form.Item wrapper here if we manage edit state directly
                            React.cloneElement(InputComponent, {
                                value: editingRowData ? editingRowData[col.name] : undefined,
                                onChange: (eOrValue: any) => {
                                    // Handle different event types (direct value, event object, dayjs object)
                                    let value = eOrValue;
                                    if (eOrValue && eOrValue.target) {
                                    value = eOrValue.target.type === 'checkbox' ? eOrValue.target.checked : eOrValue.target.value;
                                    } else if (dayjs.isDayjs(eOrValue)) {
                                        value = eOrValue; // Keep dayjs object for DatePicker
                                    }
                                    handleEditingInputChange(value, col.name);
                                },
                                onPressEnter: handleSave,
                            style: { ...InputComponent.props.style }
                        })
                    );
                    } else {
                        // Display formatting
                        let displayText = text;
                        if (text === null || text === undefined) {
                            return <i style={{ color: '#ccc' }}>NULL</i>;
                        }
                        if (isBoolean) {
                            displayText = String(text); // Display 'true' or 'false'
                        } else if (isDate) {
                            try {
                                // Format date consistently, handle potential invalid dates gracefully
                                const date = dayjs(text);
                                displayText = date.isValid() ? date.format(col.type.toLowerCase().includes('timestamp') ? 'YYYY-MM-DD HH:mm:ss' : 'YYYY-MM-DD') : 'Invalid Date';
                            } catch { displayText = String(text); } // Fallback if dayjs fails
                        } else {
                            displayText = String(text);
                        }
                        return (
                            <Tooltip title={displayText} placement="topLeft">
                                <Text ellipsis={true} style={{ maxWidth: '100%' /* Ensure ellipsis works */ }}>
                                    {displayText}
                                </Text>
                            </Tooltip>
                        );
                    }
                },
            };
        });

        const actionsColumn: ColumnsType<any>[0] | null = primaryKeyName ? {
            title: 'Actions', key: 'actions', width: 120, fixed: 'right',
            render: (_, record) => {
                const editing = isEditing(record);
                const pkValue = record[primaryKeyName];
                // Disable actions if PK missing, data loading, uploading, or another row is being edited
                const actionsDisabled = pkValue === undefined || pkValue === null || loadingData || uploading || (!editing && editingKey !== '');
                // Disable Save button only if data is loading during the save operation itself (handled inside handleSave)
                const saveButtonLoading = loadingData && editingKey === record.key;
                return (
                    <Space size="small">
                    {editing ? (
                    <>
                    <Button type="primary" onClick={handleSave} size="small" loading={saveButtonLoading}>Save</Button>
                    <Button onClick={handleCancel} size="small" disabled={loadingData || uploading}>Cancel</Button>
                    </>
                    ) : (
                    <>
                    <Button type="link" size="small" disabled={actionsDisabled} onClick={() => handleEdit(record)}>Edit</Button>
                    <Button type="link" size="small" danger disabled={actionsDisabled} onClick={() => handleDelete(pkValue)}>Delete</Button>
                    </>
                    )}
                </Space>
                );
            },
        } : null;

        return [ serialNumberColumn, ...dataColumns, ...(actionsColumn ? [actionsColumn] : []) ];
    }, [schema, primaryKeyName, editingKey, editingRowData, loadingData, sortConfig, currentPage, pageSize, data, searchQuery]); // Added data and searchQuery as dependencies for displayedData/S.No

    // --- Component Render ---
    if (!tableName && !error && !loadingSchema) {
        return <Empty description="Select a table from the sidebar" style={{ marginTop: 50 }} />;
    }

    return (

        <div style={{ padding: '15px', height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ marginBottom: '10px', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={4} style={{ margin: 0 }}>
        {tableName ? `Table: ${tableName}` : 'Select a Table'}
        {loadingSchema && <Spin size="small" style={{ marginLeft: '10px' }} />}
        </Title>
        {/* Grouping Dropdown (Backend Grouping - Unchanged) */}
        {schema.length > 0 && !loadingSchema && (
            <Space>
            <GroupOutlined title="Group By (backend operation)" />
            <Select
            allowClear placeholder="Group By" style={{ width: 150 }}
            value={groupingColumn}
            onChange={handleGroupingChange} // Triggers backend fetch
            disabled={loadingData || editingKey !== '' || uploading}
            title="Group By (backend operation)"
                >
            {schema.map(col => ( <Option key={col.name} value={col.name}>{col.name}</Option> ))}
            </Select>
            </Space>
        )}
        </div>


        {/* Error Alert */}
        {error && (
        <Alert message={error} type="error" showIcon closable onClose={() => setError(null)} style={{ marginBottom: '10px', flexShrink: 0 }} />
        )}

        {/* Toolbar */}
        <div style={{ marginBottom: '15px', flexShrink: 0, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
        {/* Left Side Actions */}
        <Space wrap>
            <Button type="primary" onClick={showAddModal} disabled={!tableName || !schema.length || !primaryKeyName || loadingSchema || loadingData || editingKey !== '' || uploading}>Add Row</Button>
            <Button onClick={showAddColModal} disabled={!tableName /* Allow even if schema empty? */ || loadingSchema || loadingData || editingKey !== '' || uploading}>Add Column</Button>
            <Button icon={<UploadOutlined />} onClick={showUploadModal} disabled={!tableName || loadingSchema || loadingData || uploading || editingKey !== ''}>Upload Data</Button>
        </Space>
        {/* Right Side Actions */}
        <Space wrap>
        <Input.Search
            placeholder="Search current page" // Updated placeholder
            allowClear
            // Use defaultValue and onChange with debounce for frontend search
            defaultValue={searchQuery}
            onChange={(e) => debouncedSearch(e.target.value)} // Update state via debounce for frontend filtering
            onSearch={(value) => { // Trigger search immediately on Enter/Click for frontend filtering
                    debouncedSearch.cancel(); // Cancel previous debounce timer
                    setSearchQuery(value); // Set search query directly
            }}
            style={{ width: 250 }}
            disabled={!tableName || loadingSchema || loadingData || editingKey !== '' || uploading}
            enterButton
        />
        {/* Backend Filter Button - Unchanged */}
        <Tooltip title="Filter Data (backend)">
            <Button icon={<FilterOutlined />} onClick={showFilterModal} disabled={!tableName || !schema.length || loadingSchema || loadingData || editingKey !== '' || uploading}>
                Filters {filterConfig.length > 0 ? `(${filterConfig.length})` : ''}
            </Button>
        </Tooltip>
        {/* Backend Filter Clear Button - Unchanged */}
        {filterConfig.length > 0 && (
            <Tooltip title="Clear All Backend Filters">
                <Button danger icon={<ClearOutlined />} onClick={handleClearFilters} disabled={loadingData || editingKey !== '' || uploading} />
            </Tooltip>
        )}
        </Space>
        </div>

        {/* Table Area */}
        <div style={{ flexGrow: 1, overflow: 'hidden', border: '1px solid #f0f0f0' }}>
            {/* Spin covers the Table for data loading, but not schema loading */}
            <Spin spinning={loadingData && !error && !uploading} tip="Loading page data...">
                <Table
                    columns={columns}
                    // dataSource={loadingSchema ? [] : data} // OLD: Used raw data
                    dataSource={loadingSchema ? [] : displayedData} // NEW: Use filtered and sorted data
                    rowKey="key"
                    pagination={false} // Use external pagination controls
                    // Adjust scroll height based on typical layout elements
                    scroll={{ x: 'max-content', y: 'calc(100vh - 350px)' }} // Fine-tune this value as needed
                    size="small"
                    bordered
                    locale={{ emptyText: (loadingSchema || loadingData) ? <Spin size="small" /> : <Empty description={error ? "Error loading data" : (searchQuery ? "No matching data on this page" : "No data found")} /> }}
                    onChange={handleTableChange} // Handles sorting clicks (now frontend)
                    // Table's internal loading indicator might be redundant with the Spin wrapper
                    loading={false /* loadingData */} // Controlled by Spin wrapper
                />
            </Spin>
        </div>

        {/* Pagination Area */}
        <div style={{ marginTop: '16px', textAlign: 'right', flexShrink: 0 }}>
            {/* Pagination is still driven by totalRows from backend */}
            {totalRows > 0 && !loadingSchema && (
                <Pagination
                    current={currentPage} pageSize={pageSize} total={totalRows}
                    onChange={(page, size) => {
                        // Prevent pagination change during edit
                        if (editingKey) { message.warning('Please save or cancel edit first.'); return; }

                        let needsPageReset = false;
                        // Handle page size change
                        if (size && size !== pageSize) {
                            setPageSize(size);
                            // Go to page 1 when page size changes to avoid inconsistent views
                            if (currentPage !== 1) {
                                setCurrentPage(1);
                                needsPageReset = true; // Flag that page is reset due to size change
                            }
                            // The main useEffect will refetch page 1 with the new size
                        }
                        // Handle page number change (only if not already reset by size change)
                        if (!needsPageReset && page !== currentPage) {
                            setCurrentPage(page);
                            // The main useEffect will refetch the new page data
                        }
                        // Reset frontend search/sort when changing page? Optional, decided against for now.
                        // setSearchQuery('');
                        // setSortConfig({ field: null, order: null });
                    }}
                    showSizeChanger showQuickJumper pageSizeOptions={['10', '20', '50', '100']}
                    showTotal={(total, range) => {
                        // Show total based on backend count, range is adjusted for display
                        const start = (currentPage - 1) * pageSize + 1;
                        const end = start + displayedData.length - 1; // End based on displayed data length
                        return displayedData.length > 0 ? `${start}-${end} of ${total} items` : `0 of ${total} items`;
                    }}
                    disabled={loadingData || editingKey !== '' || uploading}
                />
            )}
        </div>

        {/* --- Modals --- */}
        {/* Add Row Modal - Unchanged */}
        {isAddModalVisible && ( <Modal title={`Add New Row to ${tableName}`} visible={isAddModalVisible} onOk={handleAddOk} confirmLoading={confirmLoadingAdd} onCancel={handleAddCancel} okText="Add Row" destroyOnClose maskClosable={false} width={600} >
            <Form form={addForm} layout="vertical" name="add_row_form">
            {schema.filter(col => !col.isPrimaryKey).map(col => (
                <Form.Item key={`add-${col.name}`} name={col.name} label={`${col.name} (${col.type})`} rules={[{ required: !col.isNullable && !col.hasDefault, message: `${col.name} is required` }]} >
                    {renderFormInput(col)}
                </Form.Item>
            ))}
            </Form>
        </Modal> )}

        {/* Add Column Modal - Unchanged */}
        {isAddColModalVisible && ( <Modal title={`Add New Column to ${tableName}`} visible={isAddColModalVisible} onOk={handleAddColOk} confirmLoading={confirmLoadingAddCol} onCancel={handleAddColCancel} okText="Add Column" destroyOnClose maskClosable={false} >
            <Form form={addColForm} layout="vertical" name="add_column_form">
                <Form.Item name="columnName" label="Column Name" rules={[ { required: true, message: 'Column name is required' }, { pattern: /^[a-zA-Z_][a-zA-Z0-9_]*$/, message: 'Invalid name (letters, numbers, _, starting with letter or _)'} ]} >
                    <Input placeholder="e.g., email or user_status"/>
                </Form.Item>
                <Form.Item name="columnType" label="Column Type" rules={[{ required: true, message: 'Column type is required' }]} >
                    <Select placeholder="Select data type">
                        {SUPPORTED_COLUMN_TYPES.map(type => ( <Option key={type} value={type}>{type}</Option> ))}
                    </Select>
                </Form.Item>
            </Form>
        </Modal> )}

        {/* Filter Modal (Backend Filters) - Unchanged */}
        {isFilterModalVisible && ( <Modal title="Apply Filters (backend)" visible={isFilterModalVisible} onOk={handleFilterOk} onCancel={handleFilterCancel} okText="Apply" width={850} destroyOnClose maskClosable={false} footer={
            <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                <Button danger onClick={handleClearFilters} disabled={filterConfig.length === 0}>Clear All Filters</Button>
                <Space>
                    <Button onClick={handleFilterCancel}>Cancel</Button>
                    <Button type="primary" onClick={handleFilterOk}>Apply</Button>
                </Space>
            </Space>}
            >
            <Form form={filterForm} name="filter_form" autoComplete="off">
                <Form.List name="conditions">
                {(fields, { add, remove }) => ( <>
                    {fields.map(({ key, name, ...restField }, index) => (
                        <Space key={key} style={{ display: 'flex', marginBottom: 8, alignItems: 'baseline', flexWrap: 'nowrap' }} align="baseline">
                            {index > 0 && ( <Form.Item {...restField} name={[name, 'logicalOperator']} initialValue="AND" rules={[{ required: true, message: 'AND/OR?' }]} >
                                <Select style={{ width: 70 }}> <Option value="AND">AND</Option> <Option value="OR">OR</Option> </Select>
                            </Form.Item> )}
                            {/* Add hidden field to store unique ID for key prop */}
                            <Form.Item {...restField} name={[name, 'id']} hidden noStyle initialValue={filterForm.getFieldValue(['conditions', name, 'id']) || Date.now() + index} ><Input /></Form.Item>
                            <Form.Item {...restField} name={[name, 'column']} rules={[{ required: true, message: 'Column?' }]} >
                                <Select placeholder="Select Column" style={{ width: 150 }} onChange={() => { /* Reset operator/value when column changes */ const conds = filterForm.getFieldValue('conditions'); if(conds && conds[index]) { conds[index].operator = undefined; conds[index].value = undefined; filterForm.setFieldsValue({ conditions: conds }); } }} >
                                    {schema.filter(c => !['json', 'jsonb', 'bytea', 'blob'].some(t => c.type.toLowerCase().includes(t)) /* Exclude complex types from filter */).map(col => ( <Option key={col.name} value={col.name}>{col.name}</Option> ))}
                                </Select>
                            </Form.Item>
                            <Form.Item noStyle shouldUpdate={(prev, cur) => prev.conditions?.[index]?.column !== cur.conditions?.[index]?.column } >
                                {({ getFieldValue }) => {
                                    const colName = getFieldValue(['conditions', index, 'column']);
                                    const selCol = schema.find(c=>c.name===colName);
                                    // Determine allowed operators based on column type (simple example)
                                    const isNumeric = selCol && ['int', 'bigint', 'numeric', 'decimal', 'float', 'real', 'double'].some(t => selCol.type.toLowerCase().includes(t));
                                    const isDate = selCol && ['date', 'timestamp'].some(t => selCol.type.toLowerCase().includes(t));
                                    const isBoolean = selCol && ['bool'].some(t => selCol.type.toLowerCase().includes(t));
                                    let ops = FILTER_OPERATORS;
                                    if (isNumeric || isDate || isBoolean) { // For non-text types, remove LIKE/NOT LIKE
                                        ops = ops.filter(op => op.value !== 'LIKE' && op.value !== 'NOT LIKE');
                                    }
                                    if (isBoolean) { // For boolean, maybe only allow Equals/Not Equals/Is Null/Is Not Null?
                                        ops = ops.filter(op => ['=', '!=', 'IS NULL', 'IS NOT NULL'].includes(op.value));
                                    }

                                    return ( <Form.Item {...restField} name={[name, 'operator']} rules={[{ required: true, message: 'Op?' }]} >
                                        <Select placeholder="Operator" style={{ width: 180 }} disabled={!colName} onChange={() => { /* Reset value when operator changes */ const conds = filterForm.getFieldValue('conditions'); if(conds && conds[index]) { conds[index].value = undefined; filterForm.setFieldsValue({ conditions: conds }); } }} >
                                            {ops.map(op => ( <Option key={op.value} value={op.value}>{op.label}</Option> ))}
                                        </Select>
                                    </Form.Item> );
                                }}
                            </Form.Item>
                            {/* Value Input - depends on selected column and operator */}
                            <Form.Item noStyle shouldUpdate={(prev, cur) =>
                                prev.conditions?.[index]?.column !== cur.conditions?.[index]?.column ||
                                prev.conditions?.[index]?.operator !== cur.conditions?.[index]?.operator
                            }>
                                {({ getFieldValue }) => {
                                    const operator = getFieldValue(['conditions', index, 'operator']);
                                    const needsValue = operator && !['IS NULL', 'IS NOT NULL'].includes(operator);
                                    return ( <Form.Item
                                        {...restField}
                                        name={[name, 'value']}
                                        rules={[{ required: needsValue, message: 'Value?' }]}
                                    >
                                        {/* Render input based on column type, disable if no value needed */}
                                        {needsValue ? renderFilterValueInput(index) : <Input disabled placeholder="No value needed" style={{ width: 200 }}/>}
                                    </Form.Item> );
                                }}
                            </Form.Item>
                            <DeleteOutlined onClick={() => remove(name)} style={{ color: 'red', cursor: 'pointer', fontSize: '16px' }}/>
                        </Space>
                    ))}
                    <Form.Item>
                        <Button type="dashed" onClick={() => add({ id: Date.now(), logicalOperator: 'AND' })} block icon={<PlusOutlined />}> Add Filter Condition </Button>
                    </Form.Item>
                </> )}
                </Form.List>
            </Form>
        </Modal> )}

        {/* Upload Data Modal - Unchanged */}
        <Modal
            title={`Upload Data to ${tableName}`}
            visible={isUploadModalVisible}
            onCancel={handleUploadModalCancel}
            footer={null} // Footer is not needed as Dragger has its own actions
            destroyOnClose // Reset state when closed
            maskClosable={false}
        >
            <Dragger
                name="file" // Needs to match the key expected by the backend (used in customRequest)
                multiple={false} // Allow only single file upload
                accept={ACCEPTED_UPLOAD_TYPES.join(',')} // Accepted MIME types/extensions
                customRequest={customUploadRequest} // Handle the upload logic
                onChange={handleUploadChange} // Handle status changes (uploading, done, error)
                beforeUpload={beforeUploadCheck} // Validate file before upload starts
                disabled={uploading || !tableName || loadingData} // Also disable if loading data
                style={{ padding: '20px' }}
                height={200} // Set a fixed height for the drag area
            >
                <p className="ant-upload-drag-icon">
                    <InboxOutlined />
                </p>
                <p className="ant-upload-text">Click or drag file to this area to upload</p>
                <p className="ant-upload-hint">
                    Supports single file upload. Strictly prohibited from uploading company data or other
                    band files. Allowed types: {ACCEPTED_UPLOAD_EXTENSIONS_STRING}. Max size: 50MB.
                </p>
            </Dragger>
            {uploading && <Spin tip="Uploading..." style={{ display: 'block', marginTop: '15px' }} />}
        </Modal>

    </div> // End main div

);

};

export default DataGrid;