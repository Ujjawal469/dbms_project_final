import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Table, Spin, Alert, Empty, Pagination, Button, Input, Space, message, Modal } from 'antd'; // Added Input, Space, message, Modal
import { ColumnsType } from 'antd/es/table';
import * as api from '../../api';
import { ApiColumnSchema } from '../../api/types';

const { confirm } = Modal; // Destructure confirm

interface DataGridProps {
  tableName: string | null;
}

// Helper type for the row data being edited
type EditingRowData = Record<string, any> | null;

const DataGrid: React.FC<DataGridProps> = ({ tableName }) => {
  const [schema, setSchema] = useState<ApiColumnSchema[]>([]);
  const [data, setData] = useState<any[]>([]);
  const [totalRows, setTotalRows] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(20);
  const [loadingSchema, setLoadingSchema] = useState<boolean>(false);
  const [loadingData, setLoadingData] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [primaryKeyName, setPrimaryKeyName] = useState<string | null>(null);

  // --- State for Editing ---
  const [editingKey, setEditingKey] = useState<string>(''); // Key of the row being edited
  const [editingRowData, setEditingRowData] = useState<EditingRowData>(null); // Temporary data for the row being edited

  // --- Fetch table schema ---
  useEffect(() => {
    if (!tableName) {
      setSchema([]);
      setData([]);
      setError(null);
      setPrimaryKeyName(null);
      setEditingKey(''); // Reset editing state
      setEditingRowData(null);
      return;
    }

    setLoadingSchema(true);
    setError(null);
    setSchema([]);
    setData([]);
    setCurrentPage(1);
    setPrimaryKeyName(null);
    setEditingKey(''); // Reset editing state on table change
    setEditingRowData(null);

    api
      .fetchSchema(tableName)
      .then((fetchedSchema) => {
        setSchema(fetchedSchema);
        const pk = fetchedSchema.find((col) => col.isPrimaryKey);
        setPrimaryKeyName(pk ? pk.name : null);
      })
      .catch((err) => {
        setError(`Failed to load schema for "${tableName}": ${err.message}`);
        setPrimaryKeyName(null);
      })
      .finally(() => setLoadingSchema(false));
  }, [tableName]);

  // --- Fetch table data ---
  useEffect(() => {
    if (!tableName || loadingSchema) return;

    setLoadingData(true);
    // Don't reset error here if schema loading failed previously
    // setError(null);

    api
      .fetchData(tableName, currentPage, pageSize)
      .then((response) => {
        const processedData = response.data.map((row, index) => {
          const key = primaryKeyName && row[primaryKeyName] !== undefined
            ? `${row[primaryKeyName]}` // Use PK as key if available
            : `row-${currentPage}-${index}`; // Fallback key
          return { ...row, key };
        });
        setData(processedData);
        setTotalRows(response.total);
        setError(null); // Clear error on successful data load
      })
      .catch((err) => {
        setError(`Failed to load data for "${tableName}": ${err.message}`);
        setData([]);
        setTotalRows(0);
      })
      .finally(() => setLoadingData(false));
  }, [tableName, currentPage, pageSize, loadingSchema, primaryKeyName]); // primaryKeyName dependency is important for key generation

  // --- Edit Handlers ---
  const isEditing = (record: any) => record.key === editingKey;

  const handleEdit = (record: any) => {
    setEditingRowData({ ...record }); // Store a copy of the record data for editing
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

    // Prepare data payload, parsing numeric types
    const payload: Record<string, any> = {};
    let parsingError = false; // Flag to track parsing issues

    schema.forEach(col => {
      if (editingRowData.hasOwnProperty(col.name)) {
        // Exclude PK from payload unless API requires it
        if (!col.isPrimaryKey) {
           const rawValue = editingRowData[col.name];

           // --- Type Conversion Logic ---
           // Adjust these type checks based on the actual strings your API returns for numeric types
           const numericTypes = ['numeric', 'integer', 'int', 'bigint', 'float', 'double', 'decimal', 'real'];
           if (numericTypes.includes(col.type.toLowerCase())) {
               // Handle empty string for numeric fields - treat as null or show error?
               // Here, we'll attempt to parse, potentially resulting in NaN or null
               if (rawValue === '' || rawValue === null || rawValue === undefined) {
                  payload[col.name] = null; // Or handle as needed, maybe prevent save?
               } else {
                 const parsedValue = parseFloat(String(rawValue)); // Use parseFloat for decimals
                 if (isNaN(parsedValue)) {
                    // Handle invalid number input
                    message.error(`Invalid number format for column "${col.name}": ${rawValue}`);
                    parsingError = true; // Set the flag
                    // Decide how to proceed: maybe set payload[col.name] = null or skip?
                    // For now, we'll just flag the error and stop the save later.
                 } else {
                    payload[col.name] = parsedValue;
                 }
               }
           }
           // Add similar checks for boolean, date types if necessary
           // else if (col.type.toLowerCase() === 'boolean') { ... }
           else {
              // Keep as string (or original type if not string) for other types
              payload[col.name] = rawValue;
           }
           // --- End Type Conversion ---

        }
      }
    });

    // If parsing failed for any numeric field, stop the save process
    if (parsingError) {
        setLoadingData(false); // Ensure spinner stops if we bail early
        return;
    }

    // If your API expects the PK in the payload, add it here (outside the !col.isPrimaryKey check)
    // if (editingRowData.hasOwnProperty(primaryKeyName)) {
    //     payload[primaryKeyName] = editingRowData[primaryKeyName]; // Adjust type if needed
    // }


    try {
      setLoadingData(true);
      console.log("📦 Sending Update Payload:", payload); // Log the payload before sending
      await api.updateRecord(tableName, pkValue, payload);

      // Update local data state
      setData((prevData) => {
         // Find the index to update reliably
         const indexToUpdate = prevData.findIndex(item => item.key === keyToSave);
         if (indexToUpdate === -1) return prevData; // Should not happen ideally

         const newData = [...prevData];
         // Create the updated item merging original non-edited fields with parsed payload
         // Important: Use the *parsed* values from the payload for the updated item
         const originalItem = newData[indexToUpdate];
         newData[indexToUpdate] = {
             ...originalItem, // Keep original non-edited values
             ...payload,      // Overwrite with parsed edited values
             key: keyToSave  // Ensure the key remains consistent
         };
         return newData;
      });


      setEditingKey('');
      setEditingRowData(null);
      message.success('Record updated successfully!');

    } catch (err: any) {
      setError(`Failed to update record: ${err.message}`);
      message.error(`Failed to update record: ${err.message}`);
      // Keep editing state active
    } finally {
       setLoadingData(false);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    dataIndex: string
  ) => {
    if (!editingRowData) return;
    const { value } = e.target;
    setEditingRowData({ ...editingRowData, [dataIndex]: value });
  };


  // --- Delete Handler ---
  const handleDelete = (primaryKeyValue: string | number) => {
    if (!tableName || !primaryKeyName) return;

    confirm({
      title: 'Are you sure delete this record?',
      content: `Record with ${primaryKeyName}=${primaryKeyValue} will be permanently deleted.`,
      okText: 'Yes, Delete',
      okType: 'danger',
      cancelText: 'No',
      onOk: async () => { // Make async
        try {
          setLoadingData(true); // Indicate loading
          await api.deleteRecord(tableName, primaryKeyValue);
          // Update state after successful deletion
          setData((prevData) => prevData.filter((item) => item[primaryKeyName] !== primaryKeyValue));
          setTotalRows((prevTotal) => prevTotal - 1);
          message.success('Record deleted successfully!');
          // If the deleted row was being edited, cancel editing
          if (String(primaryKeyValue) === editingKey || (editingRowData && editingRowData[primaryKeyName] === primaryKeyValue)) {
              handleCancel();
          }
        } catch (err: any) {
          setError(`Failed to delete record: ${err.message}`);
          message.error(`Failed to delete record: ${err.message}`);
        } finally {
           setLoadingData(false);
        }
      },
      onCancel() {
        console.log('Delete cancelled');
      },
    });
  };

  // --- Build table columns ---
  const columns = useMemo((): ColumnsType<any> => {
    if (!schema || schema.length === 0) return [];

    const generatedCols: ColumnsType<any> = schema.map((col) => {
      const editable =  !col.isPrimaryKey && !col.isForeignKey;// Generally, don't edit primary keys inline

      return {
        title: col.name,
        dataIndex: col.name,
        key: col.name,
        ellipsis: !isEditing({ key: editingKey }), // Allow seeing full text when editing
        render: (text: any, record: any) => {
          const editing = isEditing(record);
          if (editing && editable) {
            // Render Input for editable columns in the editing row
            return (
              <Input
                value={editingRowData ? editingRowData[col.name] : ''}
                onChange={(e) => handleInputChange(e, col.name)}
                // Consider adding onPressEnter={handleSave} for convenience
              />
            );
          } else {
            // Render text for non-editing rows or non-editable columns
            return text === null || text === undefined ? (
              <i style={{ color: '#ccc' }}>NULL</i>
            ) : (
              String(text) // Ensure it's a string for display
            );
          }
        },
      };
    });

    // Add Actions column if there's a primary key
    if (primaryKeyName) {
      generatedCols.push({
        title: 'Actions',
        key: 'actions',
        width: 120, // Adjusted width for Save/Cancel
        fixed: 'right',
        render: (_, record) => {
          const editing = isEditing(record);
          if (editing) {
            return (
              <Space size="small">
                <Button type="primary" onClick={handleSave} size="small">
                  Save
                </Button>
                <Button onClick={handleCancel} size="small">
                  Cancel
                </Button>
              </Space>
            );
          } else {
            return (
              <Space size="small">
                <Button
                  type="link"
                  size="small"
                  disabled={editingKey !== ''} // Disable edit if another row is being edited
                  onClick={() => handleEdit(record)}
                >
                  Edit
                </Button>
                <Button
                  type="link"
                  size="small"
                  danger
                  disabled={editingKey !== ''} // Disable delete if a row is being edited
                  onClick={() => handleDelete(record[primaryKeyName])}
                >
                  Delete
                </Button>
              </Space>
            );
          }
        },
      });
    }

    return generatedCols;
    // Add dependencies that affect column rendering
  }, [schema, primaryKeyName, editingKey, editingRowData]); // Added editing state dependencies


  // --- Render ---

  if (!tableName) {
    return <Empty description="Select a table from the sidebar" style={{ marginTop: 50 }} />;
  }

  if (loadingSchema) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin tip={`Loading schema for ${tableName}...`} />
      </div>
    );
  }

  // Show persistent error if schema failed, even if data loading starts/fails
  if (error && !loadingSchema && schema.length === 0) {
     return (
       <Alert
         message={error}
         description="Cannot proceed without table schema."
         type="error"
         showIcon
         closable
         onClose={() => setError(null)}
       />
     );
  }


  return (
    <div>
      <h2 style={{ marginBottom: '16px' }}>Table: {tableName}</h2>

      {/* Show non-blocking errors (e.g., data load failure after schema success) */}
      {error && (schema.length > 0 || loadingData) && (
         <Alert
           message={error}
           type={loadingData ? "warning" : "error"} // Show as warning if data is still loading despite error
           showIcon
           closable
           onClose={() => setError(null)}
           style={{ marginBottom: '10px' }}
         />
      )}

      <Button
        style={{ marginBottom: '10px' }}
        disabled={!primaryKeyName || editingKey !== ''} // Disable if no PK or if editing
        onClick={() => alert('Add Row functionality not implemented.')}
      >
        Add Row
      </Button>

      <Spin spinning={loadingData} tip="Loading data...">
        <Table
          columns={columns}
          dataSource={data}
          rowKey="key" // Use the generated key
          pagination={false}
          scroll={{ x: 'max-content', y: 'calc(100vh - 300px)' }} // Adjust height as needed
          size="small"
          bordered
          locale={{ emptyText: <Empty description="No data found" /> }}
        />
      </Spin>

      {totalRows > 0 && (
        <Pagination
          style={{ marginTop: '16px', textAlign: 'right' }}
          current={currentPage}
          pageSize={pageSize}
          total={totalRows}
          onChange={(page, size) => {
            if (editingKey) {
                message.warning('Please save or cancel the current edit before changing pages.');
                return;
            }
            setCurrentPage(page);
            setPageSize(size);
          }}
          showSizeChanger
          showQuickJumper
          pageSizeOptions={['10', '20', '50', '100']}
          showTotal={(total) => `Total ${total} items`}
          disabled={loadingData || editingKey !== ''} // Disable pagination while loading or editing
        />
      )}
    </div>
  );
};

export default DataGrid;