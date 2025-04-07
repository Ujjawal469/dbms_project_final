import React, { useState, useEffect, useMemo } from 'react';
import { Table, Spin, Alert, Empty, Pagination, Button } from 'antd';
import { ColumnsType } from 'antd/es/table';
import * as api from '../../api';
import { ApiColumnSchema } from '../../api/types';

interface DataGridProps {
  tableName: string | null;
}

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

  // Fetch table schema
  useEffect(() => {
    if (!tableName) {
      setSchema([]);
      setData([]);
      setError(null);
      setPrimaryKeyName(null);
      return;
    }

    setLoadingSchema(true);
    setError(null);
    setSchema([]);
    setData([]);
    setCurrentPage(1);
    setPrimaryKeyName(null);

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

  // Fetch table data
  useEffect(() => {
    if (!tableName || loadingSchema) return;

    setLoadingData(true);

    api
      .fetchData(tableName, currentPage, pageSize)
      .then((response) => {
        const processedData = response.data.map((row, index) => ({
          ...row,
          key: primaryKeyName && row[primaryKeyName] !== undefined
            ? `${row[primaryKeyName]}` // make sure it's a string key
            : `row-${currentPage}-${index}`, // predictable, not random
        }));
        setData(processedData);
        setTotalRows(response.total);
      })
      .catch((err) => {
        setError(`Failed to load data for "${tableName}": ${err.message}`);
        setData([]);
        setTotalRows(0);
      })
      .finally(() => setLoadingData(false));
  }, [tableName, currentPage, pageSize, loadingSchema, primaryKeyName]);


    //handle delete
    const handleDelete = (primaryKeyValue: string | number) => {
      if (!tableName || !primaryKeyName) return;
  
      confirm({
        title: 'Are you sure you want to delete this record?',
        onOk: () => {
          api
            .deleteRecord(tableName, primaryKeyValue)
            .then(() => {
              setData((prevData) => prevData.filter((item) => item[primaryKeyName] !== primaryKeyValue));
              setTotalRows((prevTotal) => prevTotal - 1);
            })
            .catch((err) => {
              setError(`Failed to delete record: ${err.message}`);
            });
        },
      });
    };

  // Build table columns
  const columns = useMemo((): ColumnsType<any> => {
    if (!schema || schema.length === 0) return [];

    const generatedCols = schema.map((col) => ({
      title: col.name,
      dataIndex: col.name,
      key: col.name,
      render: (text: any) =>
        text === null ? <i style={{ color: '#ccc' }}>NULL</i> : String(text),
      ellipsis: true,
    }));

    if (primaryKeyName) {
      generatedCols.push({
        title: 'Actions',
        key: 'actions',
        width: 100,
        fixed: 'right',
        render: (_, record) => (
          <span>
            <Button
              type="link"
              size="small"
              onClick={() => {
                console.log('Editing', record[primaryKeyName]);
                alert(`Edit ${primaryKeyName}=${record[primaryKeyName]}`);
              }}
            >
              Edit
            </Button>
            <Button
              type="link"
              size="small"
              danger
              danger
              onClick={() => handleDelete(record[primaryKeyName])}
            >
              Delete
            </Button>
          </span>
        ),
      });
    }

  // --- Render ---

  if (!tableName) {
    return <Empty description="Select a table from the sidebar" />;
  }

  if (loadingSchema) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin tip={`Loading schema for ${tableName}...`} />
      </div>
    );
  }

  if (error && !loadingData) {
    return (
      <Alert
        message={error}
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

      {error && loadingData && (
        <Alert
          message={error}
          type="warning"
          showIcon
          style={{ marginBottom: '10px' }}
        />
      )}

      <Button style={{ marginBottom: '10px' }} disabled={!primaryKeyName}>
        Add Row (Not Implemented)
      </Button>

      <Spin spinning={loadingData} tip="Loading data...">
        <Table
          columns={columns}
          dataSource={data}
          rowKey="key"
          pagination={false}
          scroll={{ x: 'max-content', y: 'calc(100vh - 300px)' }}
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
            setCurrentPage(page);
            setPageSize(size);
          }}
          showSizeChanger
          showQuickJumper
          pageSizeOptions={['10', '20', '50', '100']}
          showTotal={(total) => `Total ${total} items`}
          disabled={loadingData}
        />
      )}
    </div>
  );
});

export default DataGrid;