// src/components/GalleryView.tsx

import React, { useState, useEffect } from 'react';
import { Card, Spin, Alert, Empty, Pagination, Row, Col, Typography, Tooltip, Tag } from 'antd';
import * as api from '../api';
import { ApiColumnSchema } from '../api/types';
import dayjs from 'dayjs';

const { Text, Paragraph, Title } = Typography;

interface GalleryViewProps {
    dbId: number;
    tableName: string;
}

const GALLERY_PAGE_SIZE = 8;

const GalleryView: React.FC<GalleryViewProps> = ({ dbId, tableName }) => {
    const [schema, setSchema] = useState<ApiColumnSchema[]>([]);
    const [data, setData] = useState<any[]>([]);
    const [totalRows, setTotalRows] = useState<number>(0);
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [loadingSchema, setLoadingSchema] = useState<boolean>(true);
    const [loadingData, setLoadingData] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [primaryKeyName, setPrimaryKeyName] = useState<string | null>(null);
    useEffect(() => {
        setSchema([]); setData([]); setTotalRows(0); setCurrentPage(1); setError(null); setPrimaryKeyName(null);
        setLoadingSchema(true); setLoadingData(true);

        console.log(`GalleryView: Fetching schema for DB: ${dbId}, Table: ${tableName}`);
        api.fetchSchema(dbId, tableName)
            .then((fetchedSchema) => {
                if (!Array.isArray(fetchedSchema)) throw new Error("Invalid schema format.");
                setSchema(fetchedSchema);
                const pk = fetchedSchema.find(col => col.isPrimaryKey);
                setPrimaryKeyName(pk?.name || null);
            })
            .catch((err) => { setError(`Schema Error: ${err.message}`); setData([]); setTotalRows(0); })
            .finally(() => setLoadingSchema(false));

    }, [dbId, tableName]);
    useEffect(() => {
        if (loadingSchema || error || !dbId || !tableName) {
             if (!loadingSchema && !error) setLoadingData(false);
            return;
        }

        setLoadingData(true);
        console.log(`GalleryView: Fetching data page ${currentPage}, size ${GALLERY_PAGE_SIZE}`);
        const fetchParams = { page: currentPage, limit: GALLERY_PAGE_SIZE };

        api.fetchData(dbId, tableName, fetchParams)
            .then((response) => {
                if (!response || !Array.isArray(response.data) || typeof response.total !== 'number') {
                    throw new Error("Invalid data format received.");
                }
                 const processedData = response.data.map((row, index) => ({
                    ...row,
                    gallery_view_key: primaryKeyName && row[primaryKeyName] != null
                        ? `gallery-${dbId}-${tableName}-${row[primaryKeyName]}`
                        : `gallery-idx-${dbId}-${tableName}-${currentPage}-${index}`
                }));
                setData(processedData);
                setTotalRows(response.total);
            })
            .catch((err) => { setError(`Data Error: ${err.message}`); setData([]); setTotalRows(0); })
            .finally(() => setLoadingData(false));

    }, [dbId, tableName, currentPage, loadingSchema, schema, error, primaryKeyName]);
    const handlePageChange = (page: number) => {
        setCurrentPage(page);
    };
    const formatDisplayValue = (value: any, columnType: string): string => {
        const colTypeLC = columnType.toLowerCase().split('(')[0].split(' ')[0];
        const dateTypesLC = ['date', 'timestamp', 'datetime', 'timestamptz', 'timestamp with time zone'];

        if (value === null || value === undefined) return 'NULL';
        if (dateTypesLC.includes(colTypeLC)) {
            try {
                const date = dayjs(value);
                if (date.isValid()) {
                    const showTime = colTypeLC.includes('timestamp') || colTypeLC.includes('datetime');
                    return date.format(showTime ? 'YYYY-MM-DD HH:mm:ss' : 'YYYY-MM-DD');
                } else { return 'Invalid Date'; }
            } catch { /* fallback */ }
        }
        return String(value); // Default to string
    };

    // --- 2f. RENDER LOGIC ---
    if (loadingSchema) {
        return <div style={{ padding: 50, textAlign: 'center' }}><Spin tip="Loading schema..." /></div>;
    }
    if (error) {
        return <Alert message="Error" description={error} type="error" showIcon style={{ margin: 20 }}/>;
    }
     if (!loadingSchema && schema.length === 0 && !error) {
         return <Empty description={`Table "${tableName}" has no columns defined or schema load failed.`} style={{ marginTop: 50 }} />;
    }

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Title level={5} style={{ marginBottom: '15px', flexShrink: 0 }}>Gallery View: {tableName}</Title>

            {/* Main content area with scrolling */}
            <div style={{ flexGrow: 1, overflowY: 'auto', padding: '0 5px' }}>
                <Spin spinning={loadingData && !error} tip="Loading data...">
                    {data.length === 0 && !loadingData ? (
                        <Empty description={`No data found for table "${tableName}".`} style={{ marginTop: 50 }} />
                    ) : (
                        <Row gutter={[16, 16]}> {/* Grid layout for cards */}
                            {data.map((row) => (
                                // Responsive column sizing
                                <Col key={row.gallery_view_key} xs={24} sm={12} md={12} lg={8} xl={6}>
                                    <Card size="small" bordered hoverable style={{ height: '100%' }}>
                                        {/* Iterate over schema to display key-value pairs */}
                                        {schema.map((col) => (
                                            <div key={col.name} style={{ marginBottom: '6px', borderBottom: '1px dashed #eee', paddingBottom: '4px' }}>
                                                {/* Display Column Name (maybe highlight PK) */}
                                                <Text strong style={{ display: 'block', fontSize: '11px', color: '#555', marginBottom: '2px' }}>
                                                    {col.name}
                                                    {col.isPrimaryKey && <Tag color="blue" style={{ marginLeft: 4, transform: 'scale(0.8)' }}>PK</Tag>}
                                                </Text>
                                                {/* Display Formatted Value */}
                                                <Tooltip title={String(row[col.name] ?? 'NULL')} placement="topLeft">
                                                    <Paragraph style={{ margin: 0, fontSize: '12px', wordBreak: 'break-word' }} ellipsis={{ rows: 2, expandable: false }}>
                                                        {formatDisplayValue(row[col.name], col.type)}
                                                    </Paragraph>
                                                </Tooltip>
                                            </div>
                                        ))}
                                    </Card>
                                </Col>
                            ))}
                        </Row>
                    )}
                </Spin>
            </div>

            {/* Pagination controls */}
            {!loadingData && totalRows > GALLERY_PAGE_SIZE && (
                <div style={{ marginTop: '16px', textAlign: 'center', flexShrink: 0, padding: '10px 0' }}>
                    <Pagination
                        current={currentPage}
                        pageSize={GALLERY_PAGE_SIZE}
                        total={totalRows}
                        onChange={handlePageChange}
                        showSizeChanger={false} // Fixed page size for gallery
                        size="small"
                        disabled={loadingData}
                    />
                </div>
            )}
        </div>
    );
};

export default GalleryView;